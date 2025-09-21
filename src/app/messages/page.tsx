"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DM = {
    id: number;
    sender_id: string;
    recipient_id: string;
    content: string;
    created_at: string;
};

export default function MessagesPage() {
    const [recipientEmail, setRecipientEmail] = useState("");
    const [messages, setMessages] = useState<DM[]>([]);
    const [me, setMe] = useState<string | null>(null);
    const [loadingThread, setLoadingThread] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // Try to prefill recipient from ?to=email@example.com
    useEffect(() => {
        try {
            const sp = new URLSearchParams(window.location.search);
            const to = sp.get("to");
            if (to) setRecipientEmail(to);
        } catch { }
    }, []);

    // Get current user id via Supabase browser client for basic "You" vs "Them" UI
    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getUser().then(({ data }) => {
            setMe(data.user?.id ?? null);
        });
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        try {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        } catch { }
    }, [messages]);

    const canSend = useMemo(() => {
        return recipientEmail.trim().length > 0 && content.trim().length > 0 && !sending;
    }, [recipientEmail, content, sending]);

    async function loadThread() {
        if (!recipientEmail.trim()) return;
        setLoadingThread(true);
        setError(null);
        try {
            const url = `/api/dm?recipientEmail=${encodeURIComponent(recipientEmail.trim())}`;
            const res = await fetch(url, { method: "GET" });
            if (res.status === 401) {
                setError("You must be logged in to view messages. Go to the Login page first.");
                setMessages([]);
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Failed to load messages");
            }
            if (Array.isArray(data?.messages)) {
                setMessages(data.messages as DM[]);
            } else {
                setMessages([]);
            }
        } catch (e: any) {
            setError(e?.message || "Unexpected error while loading the thread");
            setMessages([]);
        } finally {
            setLoadingThread(false);
        }
    }

    async function sendMessage() {
        if (!canSend) return;
        setSending(true);
        setError(null);
        try {
            const res = await fetch("/api/dm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientEmail: recipientEmail.trim(),
                    content: content.trim(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                setError("You must be logged in to send messages. Go to the Login page first.");
                return;
            }
            if (!res.ok) {
                throw new Error(data?.error || "Failed to send message");
            }
            if (data?.message) {
                setMessages((prev) => [...prev, data.message as DM]);
            }
            setContent("");
        } catch (e: any) {
            setError(e?.message || "Unexpected error while sending the message");
        } finally {
            setSending(false);
        }
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendMessage();
        }
    }

    return (
        <main className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="mb-4 text-2xl font-semibold">Direct Messages</h1>

            {/* Recipient selector */}
            <div className="mb-4 rounded border p-4">
                <label className="block text-sm font-medium">
                    Recipient Email
                    <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.currentTarget.value)}
                        placeholder="friend@example.com"
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    />
                </label>
                <div className="mt-3 flex items-center gap-2">
                    <button
                        onClick={loadThread}
                        disabled={loadingThread || recipientEmail.trim().length === 0}
                        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
                    >
                        {loadingThread ? "Loading..." : "Load Conversation"}
                    </button>
                    <button
                        onClick={loadThread}
                        disabled={loadingThread || recipientEmail.trim().length === 0}
                        className="rounded border px-4 py-2 text-sm disabled:opacity-60"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Messages thread */}
            <div className="h-80 overflow-y-auto rounded border p-3 mb-4 bg-white">
                {messages.length === 0 ? (
                    <p className="text-sm text-gray-600">No messages yet. Load a conversation or send the first message.</p>
                ) : (
                    <ul className="space-y-2">
                        {messages.map((m) => {
                            const mine = me && m.sender_id === me;
                            return (
                                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-[75%] rounded px-3 py-2 text-sm ${mine ? "bg-black text-white" : "bg-gray-100 text-gray-900"
                                            }`}
                                        title={new Date(m.created_at).toLocaleString()}
                                    >
                                        <div className="text-[10px] opacity-70 mb-1">{mine ? "You" : "Them"}</div>
                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                    </div>
                                </li>
                            );
                        })}
                        <div ref={bottomRef} />
                    </ul>
                )}
            </div>

            {/* Composer */}
            <div className="rounded border p-4">
                <label className="block text-sm font-medium">
                    Message
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.currentTarget.value)}
                        onKeyDown={onKeyDown}
                        rows={3}
                        placeholder="Type your message and press Enter to send"
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    />
                </label>
                <div className="mt-3">
                    <button
                        onClick={sendMessage}
                        disabled={!canSend}
                        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
                    >
                        {sending ? "Sending..." : "Send"}
                    </button>
                </div>
                {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>

            <p className="mt-6 text-xs text-gray-500">
                Tip: after logging in, ensure you have created your profile row automatically by following the magic link.
                Then enter a recipient's email who has also logged in at least once.
            </p>
        </main>
    );
}
