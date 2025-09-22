// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node
import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
} from "@google/genai";
import mime from "mime";
import { writeFile } from "fs";
const responseQueue: LiveServerMessage[] = [];
let session: Session | undefined = undefined;

async function handleTurn(): Promise<LiveServerMessage[]> {
  const turn: LiveServerMessage[] = [];
  let done = false;
  while (!done) {
    const message = await waitMessage();
    turn.push(message);
    if (message.serverContent && message.serverContent.turnComplete) {
      done = true;
    }
  }
  return turn;
}

async function waitMessage(): Promise<LiveServerMessage> {
  let done = false;
  let message: LiveServerMessage | undefined = undefined;
  while (!done) {
    message = responseQueue.shift();
    if (message) {
      handleModelTurn(message);
      done = true;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return message!;
}

const audioParts: string[] = [];
const collectedTexts: string[] = [];
function handleModelTurn(message: LiveServerMessage) {
  const parts = message.serverContent?.modelTurn?.parts;
  if (!parts || parts.length === 0) return;

  for (const part of parts) {
    if (part?.fileData?.fileUri) {
      console.log(`File: ${part.fileData.fileUri}`);
    }

    if (part?.inlineData) {
      const fileName = "audio.wav";
      const inlineData = part.inlineData;

      audioParts.push(inlineData?.data ?? "");

      const buffer = convertToWav(audioParts, inlineData.mimeType ?? "");
      saveBinaryFile(fileName, buffer);
    }

    if (typeof part?.text === "string" && part.text.length > 0) {
      collectedTexts.push(part.text);
      console.log(part.text);
    }
  }
}

function saveBinaryFile(fileName: string, content: Buffer) {
  writeFile(fileName, content, "utf8", (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`Appending stream content to file ${fileName}.`);
  });
}

function saveTextFile(fileName: string, content: string) {
  writeFile(fileName, content, "utf8", (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`Writing text transcript to file ${fileName}.`);
  });
}

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function convertToWav(rawData: string[], mimeType: string) {
  const options = parseMimeType(mimeType);
  const dataLength = rawData.reduce((a, b) => a + b.length, 0);
  const wavHeader = createWavHeader(dataLength, options);
  const buffer = Buffer.concat(
    rawData.map((data) => Buffer.from(data, "base64"))
  );

  return Buffer.concat([wavHeader, buffer]);
}

function parseMimeType(mimeType: string) {
  const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
  const [_, format] = fileType.split("/");

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
    bitsPerSample: 16,
  };

  if (format && format.startsWith("L")) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split("=").map((s) => s.trim());
    if (key === "rate") {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options as WavConversionOptions;
}

function createWavHeader(dataLength: number, options: WavConversionOptions) {
  const { numChannels, sampleRate, bitsPerSample } = options;

  // http://soundfile.sapp.org/doc/WaveFormat

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0); // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
  buffer.write("WAVE", 8); // Format
  buffer.write("fmt ", 12); // Subchunk1ID
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  buffer.write("data", 36); // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return buffer;
}

interface ChatMessage {
  role: "user" | "model" | "system";
  content: string;
}

function buildPromptFromHistory(
  history: ChatMessage[] | undefined,
  input: string
) {
  const MAX_TURNS = 8;
  const turns = Array.isArray(history) ? history.slice(-MAX_TURNS) : [];
  const lines: string[] = [];
  for (const m of turns) {
    const role =
      m.role === "model"
        ? "Assistant"
        : m.role === "system"
        ? "System"
        : "User";
    lines.push(`${role}: ${m.content}`);
  }
  lines.push(`User: ${input}`);
  lines.push("Assistant:");
  return lines.join("\n");
}

export async function runGemini(input: string, history?: ChatMessage[]) {
  collectedTexts.length = 0;
  audioParts.length = 0;
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const model = "models/gemini-2.0-flash-live-001";

  const config = {
    responseModalities: [Modality.AUDIO, Modality.TEXT],
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Zephyr",
        },
      },
    },
    contextWindowCompression: {
      triggerTokens: "25600",
      slidingWindow: { targetTokens: "12800" },
    },
  };

  session = await ai.live.connect({
    model,
    callbacks: {
      onopen: function () {
        console.debug("Opened");
      },
      onmessage: function (message: LiveServerMessage) {
        responseQueue.push(message);
      },
      onerror: function (e: ErrorEvent) {
        console.debug("Error:", e.message);
      },
      onclose: function (e: CloseEvent) {
        console.debug("Close:", e.reason);
      },
    },
    config,
  });

  const prompt = buildPromptFromHistory(history, input);

  session.sendClientContent({
    turns: [prompt],
  });

  await handleTurn();

  // Also save a text transcript alongside the audio for convenience
  const transcript = collectedTexts.join("\n");
  if (transcript.trim()) {
    saveTextFile("audio.wav.txt", transcript);
  }

  session.close();
  return { texts: collectedTexts };
}

export async function runGeminiText(input: string, history?: ChatMessage[]) {
  collectedTexts.length = 0;
  audioParts.length = 0;

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const model = "models/gemini-2.0-flash-live-001";

  const config = {
    responseModalities: [Modality.TEXT],
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Zephyr",
        },
      },
    },
    contextWindowCompression: {
      triggerTokens: "25600",
      slidingWindow: { targetTokens: "12800" },
    },
  };

  session = await ai.live.connect({
    model,
    callbacks: {
      onopen: function () {
        console.debug("Opened (text-only)");
      },
      onmessage: function (message: LiveServerMessage) {
        responseQueue.push(message);
      },
      onerror: function (e: ErrorEvent) {
        console.debug("Error:", e.message);
      },
      onclose: function (e: CloseEvent) {
        console.debug("Close:", e.reason);
      },
    },
    config,
  });

  const prompt = buildPromptFromHistory(history, input);

  session.sendClientContent({
    turns: [prompt],
  });

  await handleTurn();

  try {
    session.close();
  } catch {}

  return { texts: collectedTexts };
}
