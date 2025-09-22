import { runGeminiText } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 20000;

function extractText(resp: any): string {
  try {
    if (typeof resp?.output_text === "string") return resp.output_text;
    const parts =
      resp?.candidates?.flatMap((c: any) =>
        (c?.content?.parts || []).map((p: any) => p?.text).filter(Boolean)
      ) || [];
    const text = parts.join("\n").trim();
    if (text) return text;
  } catch {}
  return "";
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error(`Itinerary generation timed out after ${ms}ms`)),
      ms
    );
    p.then((v) => {
      clearTimeout(to);
      resolve(v);
    }).catch((e) => {
      clearTimeout(to);
      reject(e);
    });
  });
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'prompt' string." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // TEXT-ONLY generation with a firm timeout via our live helper (no audio).
    const { texts } = await withTimeout(runGeminiText(prompt), TIMEOUT_MS);
    const text =
      (Array.isArray(texts) ? texts.join("\n").trim() : "") ||
      "No response text received.";
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected error while generating itinerary.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
