import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = (await cookies()) as any;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        // Note: cookies().set is only allowed in Route Handlers, Middleware, or Server Actions.
        // When used in a plain Server Component, this may no-op, but that's fine:
        // session refresh will be handled in middleware and route handlers.
        try {
          (cookieStore as any).set({ name, value, ...options });
        } catch {
          // ignore if not allowed in this context
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          (cookieStore as any).set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // ignore if not allowed in this context
        }
      },
    },
  });
}
