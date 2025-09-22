import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET || "recordings";

function slugFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // List all objects directly under user's folder
    const prefix = `${user.id}`;
    const { data: objects, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(prefix, {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

    if (listErr) {
      console.error("storage.list error:", listErr);
      return NextResponse.json(
        { error: "Failed to list audio" },
        { status: 500 }
      );
    }

    const audioItems = (objects || []).filter((o) => {
      const n = (o?.name || "").toLowerCase();
      return (
        n.endsWith(".webm") ||
        n.endsWith(".ogg") ||
        n.endsWith(".wav") ||
        n.endsWith(".mp3") ||
        n.endsWith(".m4a")
      );
    });

    // Create signed URLs for each item (one per slug due to upsert design)
    const results: Array<{
      key: string;
      slug: string;
      url: string;
      updatedAt?: string;
      size?: number;
    }> = [];

    for (const obj of audioItems) {
      const key = `${prefix}/${obj.name}`;
      const slug = slugFromName(obj.name);

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(key, 60 * 60); // 1 hour

      if (error || !data?.signedUrl) {
        // Skip if we can't sign (likely not found or permissions)
        continue;
      }

      results.push({
        key,
        slug,
        url: data.signedUrl,
        updatedAt: (obj as any)?.updated_at || undefined,
        size: (obj as any)?.metadata?.size || undefined,
      });
    }

    // Sort by slug to produce stable output (only one per slug given upsert)
    results.sort((a, b) => a.slug.localeCompare(b.slug));

    return NextResponse.json({ items: results });
  } catch (err) {
    console.error("/api/audio/list GET error:", err);
    return NextResponse.json(
      { error: "Failed to list audio" },
      { status: 500 }
    );
  }
}
