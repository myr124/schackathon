import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "webm";
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("mp4")) return "m4a";
  return "webm";
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case "webm":
      return "audio/webm";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    default:
      return "audio/webm";
  }
}

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET || "recordings";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File | null;
    const question = formData.get("question");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No audio file uploaded" },
        { status: 400 }
      );
    }
    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "No question provided" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build storage key: one file per user per question slug. New upload replaces old.
    const qSlug = slugify(question);
    const ext =
      (file.name && file.name.split(".").pop()?.toLowerCase()) ||
      extFromMime(file.type);
    const contentType = file.type || mimeFromExt(ext);
    const key = `${user.id}/${qSlug}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload with upsert to replace any existing recording for this question
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(key, buffer, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("storage.upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to store audio" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      key,
      question,
      slug: qSlug,
    });
  } catch (err) {
    console.error("/api/audio POST error:", err);
    return NextResponse.json(
      { error: "Failed to save audio" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Backwards-compatible: support ?key= or ?filename=
    const providedKey = searchParams.get("key");
    const providedFilename = searchParams.get("filename");

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let key: string | null = null;
    if (providedKey) {
      // Lock down to user's namespace
      if (!providedKey.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      key = providedKey;
    } else if (providedFilename) {
      key = `${user.id}/${providedFilename}`;
    } else {
      return NextResponse.json(
        { error: "Missing key or filename parameter" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, 60 * 60); // 1 hour

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    return NextResponse.json({
      url: data.signedUrl,
      key,
    });
  } catch (err) {
    console.error("/api/audio GET error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve audio" },
      { status: 500 }
    );
  }
}
