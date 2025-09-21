import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // Clone request headers for NextResponse.next to preserve them
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env is missing, just continue
    return res;
  }

  // Create a Supabase client configured to read and write cookies in middleware
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        // Write to the response so the browser updates its cookies
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // This calls the Auth endpoint and refreshes the session if it's expired,
  // ensuring SSR pages can access a fresh session via cookies.
  await supabase.auth.getSession();

  return res;
}

// Protect all paths except Next internals and public assets.
// Adjust as needed if you have a custom public directory or routes to skip.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
