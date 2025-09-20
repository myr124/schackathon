"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Home() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [texts, setTexts] = useState<string[]>([]);

    async function handleRunGemini() {
        setLoading(true);
        setError(null);
        setTexts([]);
        try {
            const res = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input: "Say hello to Wes, Eric and Linh" }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error ?? "Request failed");
            }
            setTexts(Array.isArray(data?.texts) ? data.texts : []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unexpected error";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="container mx-auto px-4 py-10">
            <h1 className="mb-4 text-2xl font-semibold">Home</h1>
            <></>
            <Button onClick={handleRunGemini} disabled={loading} variant="default">
                {loading ? "Running..." : "Run Gemini"}
            </Button>

            {error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}

            {texts.length > 0 ? (
                <div className="mt-4 space-y-2">
                    {texts.map((t, i) => (
                        <p key={i} className="whitespace-pre-wrap text-sm">
                            {t}
                        </p>
                    ))}
                </div>
            ) : null}
        </main>
    );
}
