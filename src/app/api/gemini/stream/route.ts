import {
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Session,
} from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { input, history } = await req.json();
    if (!input || typeof input !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'input' string." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Normalize and validate optional chat history
    const rawHistory: any = history;
    const hist = Array.isArray(rawHistory)
      ? rawHistory
          .filter(
            (m: any) =>
              m &&
              typeof m.content === "string" &&
              (m.role === "user" || m.role === "model" || m.role === "system")
          )
          .map((m: any) => ({ role: m.role, content: m.content }))
      : undefined;

    function buildPromptFromHistory(
      historyArr:
        | { role: "user" | "model" | "system"; content: string }[]
        | undefined,
      latest: string
    ): string {
      const MAX_TURNS = 8;
      const turns = Array.isArray(historyArr)
        ? historyArr.slice(-MAX_TURNS)
        : [];
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
      lines.push(`User: ${latest}`);
      lines.push("Assistant:");
      return lines.join("\n");
    }

    const prompt = buildPromptFromHistory(hist, input);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let session: Session | undefined;

        const sendLine = (obj: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          } catch {
            // no-op
          }
        };

        try {
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
              onopen() {
                // Connected
              },
              onmessage(message: LiveServerMessage) {
                const sc = message.serverContent;
                const mt = sc?.modelTurn;
                if (mt?.parts) {
                  for (const part of mt.parts) {
                    if (part.inlineData?.data) {
                      // Stream raw audio bytes (typically PCM/L16) as base64
                      sendLine({
                        type: "audio",
                        mime: part.inlineData.mimeType,
                        data: part.inlineData.data,
                      });
                    }
                    if (part.text) {
                      // Also forward any text content
                      sendLine({
                        type: "text",
                        text: part.text,
                      });
                    }
                    if (part.fileData?.fileUri) {
                      sendLine({
                        type: "file",
                        uri: part.fileData.fileUri,
                      });
                    }
                  }
                }
                if (sc?.turnComplete) {
                  sendLine({ type: "done" });
                  try {
                    session?.close();
                  } catch {
                    // no-op
                  }
                  try {
                    controller.close();
                  } catch {
                    // no-op
                  }
                }
              },
              onerror(e: ErrorEvent) {
                sendLine({ type: "error", message: e.message });
                try {
                  controller.error(e);
                } catch {
                  // no-op
                }
              },
              onclose() {
                // Ensure stream finishes
                try {
                  controller.close();
                } catch {
                  // no-op
                }
              },
            },
            config,
          });

          session.sendClientContent({
            turns: [prompt],
          });
        } catch (e: unknown) {
          const msg =
            e instanceof Error
              ? e.message
              : "Failed to start Gemini live session";
          sendLine({ type: "error", message: msg });
          try {
            controller.error(new Error(msg));
          } catch {
            // no-op
          }
          try {
            session?.close();
          } catch {
            // no-op
          }
        }
      },
      cancel() {
        // If client disconnects
        try {
          // Nothing extra here; the onclose will run if session is active.
        } catch {
          // no-op
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected error while starting Gemini stream.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
