import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream for new DMs between the authenticated user and a specific recipient.
// GET /api/dm/stream?recipientEmail=... | recipientId=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const recipientEmail = url.searchParams.get("recipientEmail") || undefined;
    const recipientId = url.searchParams.get("recipientId") || undefined;

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Resolve recipient id by email if needed
    let toId: string | null = recipientId ?? null;
    if (!toId && recipientEmail) {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", recipientEmail)
        .maybeSingle();
      if (profErr) {
        return new Response(
          JSON.stringify({
            error: profErr.message || "Failed to lookup recipient",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      toId = prof?.id ?? null;
    }

    if (!toId) {
      return new Response(
        JSON.stringify({ error: "Provide recipientEmail or recipientId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    let keepalive: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    // Prepare the SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Helper to send SSE events
        const send = (payload: unknown) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };

        // Initial ready event so the client knows the stream is open
        send({ type: "ready" });

        // Keep-alive comments to prevent proxy timeouts
        keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch {
            // ignore if already closed
          }
        }, 15000);

        // Subscribe to all INSERTs on messages and filter in handler
        const channel = supabase.channel(`dm-stream-${user.id}-${toId}`).on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload: any) => {
            const row = payload?.new as {
              id: number;
              sender_id: string;
              recipient_id: string;
              content: string;
              created_at: string;
            };

            if (!row) return;

            const isBetweenPair =
              (row.sender_id === user.id && row.recipient_id === toId) ||
              (row.sender_id === toId && row.recipient_id === user.id);

            if (isBetweenPair) {
              send({
                type: "message",
                message: {
                  id: row.id,
                  sender_id: row.sender_id,
                  recipient_id: row.recipient_id,
                  content: row.content,
                  created_at: row.created_at,
                },
              });
            }
          }
        );

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            send({ type: "subscribed" });
          }
        });

        // Cleanup when client disconnects
        const cleanup = () => {
          if (closed) return;
          closed = true;
          try {
            if (keepalive) clearInterval(keepalive);
          } catch {
            // ignore
          }
          try {
            supabase.removeChannel(channel);
          } catch {
            // ignore
          }
          try {
            controller.close();
          } catch {
            // ignore
          }
        };

        (req as any).signal?.addEventListener?.("abort", cleanup);

        // Provide a way for the stream to be cancelled
        // Note: cancel is called on client disconnect in many runtimes
        (stream as any)._cleanup = cleanup;
      },
      cancel() {
        // try to call cleanup if set in start
        try {
          (this as any)?._cleanup?.();
        } catch {
          // ignore
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
