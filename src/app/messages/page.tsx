"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

    // track SSE connection + seen message ids to avoid duplicates
    const sseRef = useRef<EventSource | null>(null);
    const seenIdsRef = useRef<Set<number>>(new Set());

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
        return (
            recipientEmail.trim().length > 0 && content.trim().length > 0 && !sending
        );
    }, [recipientEmail, content, sending]);

    async function loadThread() {
        if (!recipientEmail.trim()) return;
        setLoadingThread(true);
        setError(null);
        try {
            const url = `/api/dm?recipientEmail=${encodeURIComponent(
                recipientEmail.trim()
            )}`;
            const res = await fetch(url, { method: "GET" });
            if (res.status === 401) {
                setError(
                    "You must be logged in to view messages. Go to the Login page first."
                );
                setMessages([]);
                seenIdsRef.current = new Set();
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Failed to load messages");
            }
            const list = Array.isArray(data?.messages) ? (data.messages as DM[]) : [];
            setMessages(list);
            seenIdsRef.current = new Set(list.map((m) => m.id));
        } catch (e: any) {
            setError(e?.message || "Unexpected error while loading the thread");
            setMessages([]);
            seenIdsRef.current = new Set();
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
                setError(
                    "You must be logged in to send messages. Go to the Login page first."
                );
                return;
            }
            if (!res.ok) {
                throw new Error(data?.error || "Failed to send message");
            }
            if (data?.message) {
                const msg = data.message as DM;
                // guard against SSE duplicate
                if (!seenIdsRef.current.has(msg.id)) {
                    seenIdsRef.current.add(msg.id);
                    setMessages((prev) => [...prev, msg]);
                }
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

    function formatTime(iso: string) {
        try {
            return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        } catch {
            return "";
        }
    }

    // Server-Sent Events: auto-update as new messages arrive on the server
    useEffect(() => {
        // close any previous stream
        if (sseRef.current) {
            try {
                sseRef.current.close();
            } catch { }
            sseRef.current = null;
        }

        const to = recipientEmail.trim();
        if (!to) return;

        const streamUrl = `/api/dm/stream?recipientEmail=${encodeURIComponent(to)}`;
        const es = new EventSource(streamUrl);
        sseRef.current = es;

        es.onmessage = (ev: MessageEvent) => {
            try {
                const data = JSON.parse(ev.data);
                if (data?.type === "message" && data.message) {
                    const m = data.message as DM;
                    if (!seenIdsRef.current.has(m.id)) {
                        seenIdsRef.current.add(m.id);
                        setMessages((prev) => {
                            // keep sorted ascending by created_at
                            const next = [...prev, m];
                            next.sort(
                                (a, b) =>
                                    new Date(a.created_at).getTime() -
                                    new Date(b.created_at).getTime()
                            );
                            return next;
                        });
                    }
                }
            } catch {
                // ignore malformed events
            }
        };

        es.onerror = () => {
            // Optional: could surface a transient error, but keep the UI resilient
            // Some environments auto-reconnect EventSource internally
        };

        return () => {
            try {
                es.close();
            } catch { }
            if (sseRef.current === es) {
                sseRef.current = null;
            }
        };
    }, [recipientEmail]);

    return (
        <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Direct Messages</CardTitle>
                    <CardDescription>
                        Select a recipient to load or refresh your conversation.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <label className="block text-sm font-medium">
                        Recipient Email
                        <input
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.currentTarget.value)}
                            placeholder="friend@example.com"
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button
                        onClick={loadThread}
                        disabled={loadingThread || recipientEmail.trim().length === 0}
                    >
                        {loadingThread ? "Loading..." : "Load Conversation"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={loadThread}
                        disabled={loadingThread || recipientEmail.trim().length === 0}
                    >
                        Refresh
                    </Button>
                </CardFooter>
            </Card>

            <Card className="bg-white">
                <CardHeader className="flex flex-row items-center gap-3">
                    <div
                        className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700"
                        aria-hidden="true"
                    >
                        {recipientEmail ? (recipientEmail[0]?.toUpperCase?.() ?? "?") : "?"}
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="leading-tight truncate">
                            {recipientEmail || "No recipient"}
                        </CardTitle>
                        <CardDescription>Direct Message</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-80 overflow-y-auto rounded bg-background px-3 py-2">
                        {messages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No messages yet. Load a conversation or send the first message.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {messages.map((m, idx) => {
                                    const mine = me && m.sender_id === me;
                                    const time = formatTime(m.created_at);
                                    const prev = idx > 0 ? messages[idx - 1] : null;
                                    const next = idx < messages.length - 1 ? messages[idx + 1] : null;
                                    const isFirstOfGroup = !prev || prev.sender_id !== m.sender_id;
                                    const isLastOfGroup = !next || next.sender_id !== m.sender_id;
                                    const showAvatar = !mine && isLastOfGroup;
                                    const dateStr = new Date(m.created_at).toDateString();
                                    const prevDateStr = prev ? new Date(prev.created_at).toDateString() : null;
                                    const showDaySep = !prev || dateStr !== prevDateStr;
                                    const initials =
                                        (recipientEmail?.[0]?.toUpperCase?.() || "?") +
                                        (recipientEmail?.split("@")[0]?.[1]?.toUpperCase?.() || "");
                                    return (
                                        <React.Fragment key={m.id}>
                                            {showDaySep ? (
                                                <li className="mx-auto my-3 w-fit rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                                                    {dateStr}
                                                </li>
                                            ) : null}
                                            <li
                                                className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                                            >
                                                {showAvatar ? (
                                                    <div
                                                        className="h-6 w-6 shrink-0 rounded-full bg-gray-200 text-[10px] font-medium text-gray-700 flex items-center justify-center"
                                                        title={recipientEmail}
                                                        aria-hidden="true"
                                                    >
                                                        {initials}
                                                    </div>
                                                ) : (
                                                    !mine ? <div className="h-6 w-6 shrink-0" aria-hidden="true" /> : null
                                                )}
                                                <div className="max-w-[75%] flex flex-col">
                                                    <div
                                                        className={`px-3 py-2 text-sm shadow ${mine
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-gray-100 text-gray-900"
                                                            } ${isLastOfGroup ? (mine ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm") : "rounded-2xl"}`}
                                                        title={new Date(m.created_at).toLocaleString()}
                                                    >
                                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                                    </div>
                                                    {isLastOfGroup ? (
                                                        <span className="mt-1 text-[10px] text-muted-foreground self-end">
                                                            {time}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </li>
                                        </React.Fragment>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </ul>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Composer</CardTitle>
                    <CardDescription>
                        Type your message and press Enter to send. Shift+Enter for newline.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-full border px-3 py-1.5 flex items-center gap-2">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.currentTarget.value)}
                            onKeyDown={onKeyDown}
                            rows={1}
                            placeholder="Message..."
                            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        <Button size="sm" onClick={sendMessage} disabled={!canSend}>
                            {sending ? "Sending..." : "Send"}
                        </Button>
                    </div>
                    {error ? (
                        <p className="mt-3 text-sm text-red-600">{error}</p>
                    ) : null}
                </CardContent>
                <CardFooter></CardFooter>
            </Card>

            <p className="mt-2 text-xs text-muted-foreground">
                Tip: after logging in, ensure you have created your profile row
                automatically by following the magic link. Then enter a recipient's
                email who has also logged in at least once.
            </p>
        </main>
    );
}
