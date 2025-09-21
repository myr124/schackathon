"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { io, Socket } from "socket.io-client";

export default function Messages() {
    const [connecting, setConnecting] = useState(false);
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interim, setInterim] = useState<string>("");
    const [finals, setFinals] = useState<string[]>([]);
    const [texts, setTexts] = useState<string[]>([]);
    const [status, setStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const scheduledAtRef = useRef(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const vadRAFRef = useRef<number | null>(null);
    const vadSilenceStartedAtRef = useRef<number | null>(null);
    const vadMinMsRef = useRef(1200);
    const vadThresholdRef = useRef(0.015);
    const autoStopTriggeredRef = useRef(false);
    const mimeRef = useRef<string>("");
    const encodingRef = useRef<"WEBM_OPUS" | "OGG_OPUS">("WEBM_OPUS");
    const processingRef = useRef(false);
    const lastUtteranceRef = useRef<string>("");

    const fullTranscript = [finals.join(" ").trim(), interim.trim()].filter(Boolean).join(" ");

    // ...existing code from Home page implementation...
    async function startLive() {
        // ...existing code...
    }

    async function stopLiveAndRunGemini() {
        // ...existing code...
    }

    function cleanupStream() {
        // ...existing code...
    }

    async function streamGeminiAudio(input: string) {
        // ...existing code...
    }

    function ensureAudioContext(): AudioContext {
        if (!audioCtxRef.current) {
            const Ctor: any =
                (window as any).AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new Ctor();
            scheduledAtRef.current = 0;
        }
        return audioCtxRef.current!;
    }

    function speakText(text: string): Promise<void> {
        return new Promise((resolve) => {
            try {
                const u = new SpeechSynthesisUtterance(text);
                u.onend = () => resolve();
                u.onerror = () => resolve();
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            } catch {
                resolve();
            }
        });
    }

    function startVAD(stream: MediaStream) {
        // ...existing code...
    }

    function stopVAD() {
        // ...existing code...
    }

    function autoStopOnce() {
        // ...existing code...
    }

    async function autoProcessTurn() {
        // ...existing code...
    }

    async function resumeListeningTurn() {
        // ...existing code...
    }

    function parseMime(mime: string) {
        // ...existing code...
    }

    function base64ToArrayBuffer(b64: string): ArrayBuffer {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async function enqueueAudioChunk(b64: string, mime: string) {
        // ...existing code...
    }

    return (
        <main className="container mx-auto px-4 py-10">
            <h1 className="mb-4 text-2xl font-semibold">Messages</h1>

            <div className="flex gap-3 items-center">
                {!recording ? (
                    <Button onClick={startLive} disabled={connecting}>
                        {connecting ? "Connecting..." : "Start Listening"}
                    </Button>
                ) : (
                    <Button onClick={stopLiveAndRunGemini} variant="destructive">
                        Stop and Process
                    </Button>
                )}
            </div>

            {status !== "idle" ? (
                <p className="mt-2 text-sm text-gray-700">Status: {status}</p>
            ) : null}

            {error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}

            {fullTranscript ? (
                <div className="mt-5">
                    <h2 className="font-medium">Live Transcript</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                        <span>{finals.join(" ")}</span>{" "}
                        {interim ? <span className="opacity-60">{interim}</span> : null}
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