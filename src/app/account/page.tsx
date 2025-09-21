import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error) {
        // If we fail to fetch session, send to login
        redirect("/login");
    }

    if (!session?.user) {
        redirect("/login");
    }

    const user = session.user;

    return (
        <main className="container mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-4 text-2xl font-semibold">Account</h1>

            <div className="rounded border p-4">
                <p className="text-sm">
                    Signed in as <span className="font-medium">{user.email ?? user.id}</span>
                </p>
                <div className="mt-4">
                    <form action={signOut}>
                        <button
                            type="submit"
                            className="rounded bg-black px-4 py-2 text-white"
                        >
                            Sign out
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
