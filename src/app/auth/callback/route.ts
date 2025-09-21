import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/account";

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // Ensure a profile row exists for this user for DM lookups
  if (!error) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase
        .from("profiles")
        .upsert(
          { id: user.id, email: user.email ?? user.id },
          { onConflict: "id" }
        );
    }
  }

  if (error) {
    const redirectUrl = new URL("/login", url.origin);
    redirectUrl.searchParams.set("error", error.message || "Auth failed");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
