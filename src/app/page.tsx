"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export default function Home() {
    const [recording, setRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<string>("");
    const [texts, setTexts] = useState<string[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    async function startRecording() {
        try {
            setError(null);
            setTranscript("");
            setTexts([]);

            // Request mic access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Prefer webm/opus if supported (works with our /api/speech)
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : "";

            const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = rec;
            chunksRef.current = [];

            rec.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            rec.start();
            setRecording(true);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Microphone access failed";
            setError(msg);
            cleanupStream();
        }
    }

    async function stopAndRun() {
        if (!mediaRecorderRef.current) return;
        try {
            setLoading(true);
            setError(null);
            setTexts([]);

            // Stop the recorder and wait for final data
            const rec = mediaRecorderRef.current;
            const stopped = new Promise<void>((resolve) => {
                rec.onstop = () => resolve();
            });
            rec.stop();
            await stopped;

            // Build Blob and send to Speech-to-Text
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            chunksRef.current = [];
            cleanupStream();
            setRecording(false);

            const sttRes = await fetch("/api/speech", {
                method: "POST",
                headers: { "Content-Type": "audio/webm" },
                body: blob,
            });
            const sttJson = await sttRes.json();
            if (!sttRes.ok) {
                throw new Error(sttJson?.error ?? "Speech recognition failed");
            }
            const t = String(sttJson?.transcript ?? "").trim();
            setTranscript(t);

            // If transcript exists, forward to Gemini
            if (t) {
                const res = await fetch("/api/gemini", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input: t }),
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error ?? "Gemini request failed");
                }
                setTexts(Array.isArray(data?.texts) ? data.texts : []);
            } else {
                setTexts([]);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unexpected error";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    function cleanupStream() {
        try {
            mediaRecorderRef.current = null;
            if (streamRef.current) {
                for (const track of streamRef.current.getTracks()) {
                    track.stop();
                }
            }
        } catch {
            // no-op
        } finally {
            streamRef.current = null;
        }
    }

    return (
        <main className="container mx-auto px-4 py-10">
            <h1 className="mb-4 text-2xl font-semibold">Home</h1>

            <div className="flex gap-3">
                {!recording ? (
                    <Button onClick={startRecording} disabled={loading}>
                        {loading ? "Please wait..." : "Start Recording"}
                    </Button>
                ) : (
                    <Button onClick={stopAndRun} variant="destructive">
                        Stop and Transcribe
                    </Button>
                )}
            </div>

            {error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}

            {transcript ? (
                <div className="mt-5">
                    <h2 className="font-medium">Transcript</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {transcript}
                    </p>
                </div>
            ) : null}

            {texts.length > 0 ? (
                <div className="mt-6 space-y-2">
                    <h2 className="font-medium">Gemini Response</h2>
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
