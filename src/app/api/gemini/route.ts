import { runGemini } from "@/lib/gemini";

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

    const { texts } = await runGemini(input, hist);
    return new Response(JSON.stringify({ texts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected error while running Gemini.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
