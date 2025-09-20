import { SpeechClient } from "@google-cloud/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new SpeechClient();

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const audioBuffer = Buffer.from(await req.arrayBuffer());
    if (!audioBuffer.length) {
      return new Response(JSON.stringify({ error: "Empty audio body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Determine encoding based on content-type
    // Common browser MediaRecorder mime for mic: audio/webm (Opus)
    // Also support WAV (LINEAR16) and OGG/Opus.
    let encoding: "WEBM_OPUS" | "LINEAR16" | "OGG_OPUS" | undefined = undefined;

    if (contentType.includes("webm")) encoding = "WEBM_OPUS";
    else if (contentType.includes("wav")) encoding = "LINEAR16";
    else if (contentType.includes("ogg") || contentType.includes("opus"))
      encoding = "OGG_OPUS";

    const request = {
      config: {
        // sampleRateHertz is optional for WEBM_OPUS/OGG_OPUS; Cloud infers it.
        encoding,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        // You can set model or diarization here if needed.
      },
      audio: {
        content: audioBuffer.toString("base64"),
      },
    };

    const [response] = await client.recognize(request as any);

    const transcript =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript ?? "")
        .join("\n")
        .trim() ?? "";

    return new Response(JSON.stringify({ transcript }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected error in Speech API.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
