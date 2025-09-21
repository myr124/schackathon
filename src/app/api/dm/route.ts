import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dm?recipientEmail=... | recipientId=...
// Returns a simple thread (messages) between the authenticated user and the recipient
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json(
          { error: profErr.message || "Failed to lookup recipient" },
          { status: 400 }
        );
      }
      toId = prof?.id ?? null;
    }

    if (!toId) {
      return NextResponse.json(
        { error: "Provide recipientEmail or recipientId" },
        { status: 400 }
      );
    }

    // Fetch the thread: all messages between user.id and toId sorted by created_at asc
    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${toId}),and(sender_id.eq.${toId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    if (msgErr) {
      return NextResponse.json(
        { error: msgErr.message || "Failed to fetch messages" },
        { status: 400 }
      );
    }

    return NextResponse.json({ messages }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/dm
// Body: { recipientEmail?: string, recipientId?: string, content: string }
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientEmail, recipientId, content } = (await req
      .json()
      .catch(() => ({}))) as {
      recipientEmail?: string;
      recipientId?: string;
      content?: string;
    };

    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Missing or invalid 'content'" },
        { status: 400 }
      );
    }

    // Resolve recipient
    let toId: string | null = recipientId ?? null;
    if (!toId && recipientEmail) {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", recipientEmail)
        .maybeSingle();
      if (profErr) {
        return NextResponse.json(
          { error: profErr.message || "Failed to lookup recipient" },
          { status: 400 }
        );
      }
      toId = prof?.id ?? null;
    }

    if (!toId) {
      return NextResponse.json(
        { error: "Provide recipientEmail or recipientId" },
        { status: 400 }
      );
    }

    const { data: inserted, error: insErr } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: toId,
        content: content.trim(),
      })
      .select("id, sender_id, recipient_id, content, created_at")
      .single();

    if (insErr) {
      return NextResponse.json(
        { error: insErr.message || "Failed to send message" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: inserted }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
