"use client";

import { useState } from "react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setStatus("sending");
        setError(null);
        try {
            const res = await fetch("/api/auth/magic-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Failed to send magic link");
            }
            setStatus("sent");
        } catch (e: any) {
            setError(e?.message || "Unexpected error");
            setStatus("error");
        }
    }

    return (
        <main className="container mx-auto max-w-md px-4 py-10">
            <h1 className="mb-4 text-2xl font-semibold">Login</h1>

            <form onSubmit={onSubmit} className="space-y-4">
                <label className="block text-sm font-medium">
                    Email
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        placeholder="you@example.com"
                    />
                </label>

                <button
                    type="submit"
                    disabled={status === "sending"}
                    className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
                >
                    {status === "sending" ? "Sending..." : "Send Magic Link"}
                </button>
            </form>

            {status === "sent" ? (
                <p className="mt-3 text-sm text-green-600">
                    Magic link sent. Check your email and return here after you click it.
                </p>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </main>
    );
}
