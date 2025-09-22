"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import FadeInOnView from "@/components/FadeInOnView";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";

type ChatMessage = { role: "user" | "model" | "system"; content: string };

export default function Home() {
    const [connecting, setConnecting] = useState(false);
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interim, setInterim] = useState<string>("");
    const [finals, setFinals] = useState<string[]>([]);
    const [texts, setTexts] = useState<string[]>([]);
    const [history, setHistory] = useState<ChatMessage[]>([]);
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

    // Auto-connect on mount, cleanup on unmount
    useEffect(() => {
        void startLive();
        return () => {
            try {
                mediaRecorderRef.current?.stop();
            } catch { }
            try {
                if (socketRef.current) {
                    socketRef.current.emit("stt:stop");
                    socketRef.current.disconnect();
                }
            } catch { }
            cleanupStream();
        };
    }, []);

    async function startLive() {
        try {
            setError(null);
            autoStopTriggeredRef.current = false;
            setTexts([]);
            setInterim("");
            setFinals([]);
            setConnecting(true);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType =
                MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                    ? "audio/webm;codecs=opus"
                    : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
                        ? "audio/ogg;codecs=opus"
                        : MediaRecorder.isTypeSupported("audio/webm")
                            ? "audio/webm"
                            : "";
            const encoding = mimeType.includes("ogg") ? "OGG_OPUS" : "WEBM_OPUS";
            mimeRef.current = mimeType;
            encodingRef.current = encoding;

            const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = rec;

            const socket = io("http://localhost:5001", { transports: ["websocket"] });
            socketRef.current = socket;

            socket.on("connect", () => {
                try {
                    socket.emit("stt:start", {
                        config: {
                            encoding,
                            languageCode: "en-US",
                            enableAutomaticPunctuation: true,
                        },
                    });
                } catch { }
                rec.ondataavailable = async (e) => {
                    if (e.data && e.data.size > 0) {
                        const buf = await e.data.arrayBuffer();
                        socket.emit("stt:audio", buf);
                    }
                };
                rec.start(250);
                setRecording(true);
                setConnecting(false);
                startVAD(stream);
                setStatus("listening");
            });

            socket.on("stt:error", (payload: any) => {
                setError(String(payload?.message ?? "Unknown streaming error"));
            });
            socket.on("stt:transcript", (payload: any) => {
                const t = String(payload?.text ?? "");
                const isFinal = Boolean(payload?.isFinal);
                if (isFinal) {
                    if (t) {
                        setFinals((prev) => {
                            const next = [...prev, t];
                            lastUtteranceRef.current = next.join(" ").trim();
                            return next;
                        });
                    }
                    setInterim("");
                } else {
                    setInterim(t);
                    lastUtteranceRef.current = [finals.join(" ").trim(), t].filter(Boolean).join(" ");
                }
            });

            socket.on("connect_error", (err: any) => {
                setError(`Socket.IO connect_error: ${err?.message || String(err)}`);
                console.error("Socket.IO connect_error:", err);
            });
            socket.on("error", (err: any) => {
                setError(`Socket.IO error: ${err?.message || String(err)}`);
                console.error("Socket.IO error:", err);
            });

            socket.on("disconnect", () => {
                try {
                    if (rec.state !== "inactive") rec.stop();
                } catch { }
                cleanupStream();
                setRecording(false);
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to start live transcription";
            setError(msg);
            cleanupStream();
            setConnecting(false);
        }
    }

    async function stopLiveAndRunGemini() {
        try {
            mediaRecorderRef.current?.stop();
        } catch { }
        try {
            if (socketRef.current) {
                socketRef.current.emit("stt:stop");
                socketRef.current.disconnect();
            }
        } catch { }
        cleanupStream();
        setRecording(false);

        const finalTextCandidate = finals.join(" ").trim();
        const finalText = (finalTextCandidate || lastUtteranceRef.current).trim();
        if (!finalText) return;

        try {
            setTexts([]);
            setStatus("processing");
            await streamGeminiAudio(finalText, history);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Gemini streaming failed";
            setError(msg);
        } finally {
            setStatus("idle");
        }
    }

    function cleanupStream() {
        mediaRecorderRef.current = null;
        stopVAD();
        if (streamRef.current) {
            try {
                for (const track of streamRef.current.getTracks()) {
                    track.stop();
                }
            } catch { }
        }
        streamRef.current = null;
    }

    async function streamGeminiAudio(input: string, historyArr: ChatMessage[]) {
        const res = await fetch("/api/gemini/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input, history: historyArr }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        if (!res.body) {
            throw new Error("No response body from stream");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let replyChunks: string[] = [];
        let gotText = false;

        ensureAudioContext();
        scheduledAtRef.current = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });

                let idx: number;
                while ((idx = buf.indexOf("\n")) !== -1) {
                    const line = buf.slice(0, idx).trim();
                    buf = buf.slice(idx + 1);
                    if (!line) continue;

                    let obj: any;
                    try {
                        obj = JSON.parse(line);
                    } catch {
                        continue;
                    }

                    if (obj.type === "audio" && obj.data) {
                        setStatus("speaking");
                        try {
                            await enqueueAudioChunk(obj.data, obj.mime || "audio/L16; rate=16000");
                        } catch (e) {
                            console.warn("Failed to enqueue audio chunk:", e);
                        }
                    } else if (obj.type === "text" && typeof obj.text === "string") {
                        gotText = true;
                        replyChunks.push(obj.text);
                        setTexts((prev) => [...prev, obj.text]);
                    } else if (obj.type === "error") {
                        throw new Error(String(obj.message || "Stream error"));
                    } else if (obj.type === "done") {
                        const ctxNow = ensureAudioContext();
                        const waitMs = Math.max(0, (scheduledAtRef.current - ctxNow.currentTime) * 1000);
                        if (waitMs > 0) {
                            await new Promise((r) => setTimeout(r, waitMs));
                        }

                        let replyText = replyChunks.join(" ").trim();

                        if (!gotText) {
                            try {
                                const r2 = await fetch("/api/gemini", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ input, history: historyArr }),
                                });
                                const d2 = await r2.json().catch(() => ({}));
                                if (r2.ok && Array.isArray(d2?.texts) && d2.texts.length > 0) {
                                    setTexts((prev) => [...prev, ...d2.texts]);
                                    replyText = d2.texts.join(" ");
                                    try {
                                        await speakText(replyText);
                                    } catch { }
                                }
                            } catch (e) {
                                console.warn("Fallback Gemini text failed:", e);
                            }
                        }

                        if (replyText) {
                            setHistory((prev) => [
                                ...prev,
                                { role: "user", content: input },
                                { role: "model", content: replyText },
                            ]);
                        }
                        return;
                    }
                }
            }
        } finally {
            const tail = decoder.decode();
            if (tail) {
                buf += tail;
            }
        }
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
        try {
            const ctx = ensureAudioContext();
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => { });
            }
            mediaSourceRef.current = ctx.createMediaStreamSource(stream);
            analyserRef.current = ctx.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0.1;
            mediaSourceRef.current.connect(analyserRef.current);

            const data = new Float32Array(analyserRef.current.fftSize);
            const loop = () => {
                const analyser = analyserRef.current;
                if (!analyser) return;
                analyser.getFloatTimeDomainData(data);

                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = data[i];
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                const threshold = vadThresholdRef.current;
                const now = performance.now();

                if (rms < threshold) {
                    if (vadSilenceStartedAtRef.current == null) {
                        vadSilenceStartedAtRef.current = now;
                    } else {
                        const dur = now - vadSilenceStartedAtRef.current;
                        if (dur >= vadMinMsRef.current) {
                            autoStopOnce();
                            return;
                        }
                    }
                } else {
                    vadSilenceStartedAtRef.current = null;
                }

                vadRAFRef.current = requestAnimationFrame(loop);
            };

            vadSilenceStartedAtRef.current = null;
            vadRAFRef.current = requestAnimationFrame(loop);
        } catch { }
    }

    function stopVAD() {
        try {
            if (vadRAFRef.current != null) {
                cancelAnimationFrame(vadRAFRef.current);
            }
        } catch { }
        vadRAFRef.current = null;
        vadSilenceStartedAtRef.current = null;
        try {
            if (analyserRef.current && mediaSourceRef.current) {
                mediaSourceRef.current.disconnect();
                analyserRef.current.disconnect();
            }
        } catch { }
        analyserRef.current = null;
        mediaSourceRef.current = null;
    }

    function autoStopOnce() {
        if (autoStopTriggeredRef.current) return;
        autoStopTriggeredRef.current = true;
        stopVAD();
        void autoProcessTurn();
    }

    async function autoProcessTurn() {
        if (processingRef.current) return;
        processingRef.current = true;
        console.log("autoProcessTurn: start");
        setStatus("processing");

        try {
            const rec = mediaRecorderRef.current;
            if (rec) {
                try { (rec as any).ondataavailable = null; } catch { }
                if (rec.state !== "inactive") rec.stop();
            }
        } catch { }

        const socket = socketRef.current;
        if (!socket) {
            processingRef.current = false;
            autoStopTriggeredRef.current = false;
            return;
        }

        const stoppedPromise = new Promise<void>((resolve) => {
            const handler = () => {
                socket.off("stt:stopped", handler);
                resolve();
            };
            socket.on("stt:stopped", handler);
        });
        const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(resolve, 1500);
        });

        try { socket.emit("stt:stop"); } catch { }

        await Promise.race([stoppedPromise, timeoutPromise]);

        const candidate = [finals.join(" ").trim(), interim.trim()].filter(Boolean).join(" ");
        let utterance = (candidate || lastUtteranceRef.current).trim();
        console.log("autoProcessTurn: finalText length", utterance.length);

        setInterim("");
        setFinals([]);
        lastUtteranceRef.current = "";

        if (!utterance) {
            await resumeListeningTurn();
            processingRef.current = false;
            autoStopTriggeredRef.current = false;
            return;
        }

        try {
            await streamGeminiAudio(utterance, history);
        } catch (e: any) {
            const msg = e instanceof Error ? e.message : String(e ?? "Gemini streaming failed");
            setError(msg);
        }

        await resumeListeningTurn();
        setStatus("listening");

        processingRef.current = false;
        autoStopTriggeredRef.current = false;
    }

    async function resumeListeningTurn() {
        const stream = streamRef.current;
        const socket = socketRef.current;
        if (!stream || !socket) return;

        try {
            socket.emit("stt:start", {
                config: {
                    encoding: encodingRef.current,
                    languageCode: "en-US",
                    enableAutomaticPunctuation: true,
                },
            });
        } catch { }

        const rec = new MediaRecorder(stream, mimeRef.current ? { mimeType: mimeRef.current } : undefined);
        mediaRecorderRef.current = rec;
        rec.ondataavailable = async (e) => {
            if (e.data && e.data.size > 0) {
                const buf = await e.data.arrayBuffer();
                socket.emit("stt:audio", buf);
            }
        };
        rec.start(250);
        setRecording(true);
        startVAD(stream);
        setStatus("listening");
    }

    function parseMime(mime: string) {
        const parts = mime.split(";").map((s) => s.trim());
        const opts = { sampleRate: 16000, bitsPerSample: 16, numChannels: 1 };
        for (const p of parts) {
            const [k, v] = p.split("=").map((s) => s.trim());
            if (k?.toLowerCase() === "rate" && v) {
                const n = parseInt(v, 10);
                if (!Number.isNaN(n)) opts.sampleRate = n;
            }
            if (k?.toLowerCase() === "channels" && v) {
                const n = parseInt(v, 10);
                if (!Number.isNaN(n)) (opts as any).numChannels = n;
            }
        }
        return opts;
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
        const { sampleRate } = parseMime(mime);
        const ab = base64ToArrayBuffer(b64);
        const view = new DataView(ab);
        const samples = view.byteLength / 2;
        const floatData = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const s = view.getInt16(i * 2, true);
            floatData[i] = Math.max(-1, Math.min(1, s / 32768));
        }

        const ctx = ensureAudioContext();
        const audioBuffer = ctx.createBuffer(1, samples, sampleRate);
        audioBuffer.getChannelData(0).set(floatData);

        const now = ctx.currentTime;
        const startAt = scheduledAtRef.current > now ? scheduledAtRef.current : now;

        const src = ctx.createBufferSource();
        src.buffer = audioBuffer;
        src.connect(ctx.destination);
        src.start(startAt);

        scheduledAtRef.current = startAt + audioBuffer.duration;
    }

    return (
        <main className="container mx-auto px-4 py-10">

            <div className="flex items-center justify-center py-6">
                <button
                    type="button"
                    onClick={() => {
                        if (!recording && !connecting) {
                            void startLive();
                        }
                    }}
                    disabled={connecting}
                    className={cn(
                        "h-28 w-28 rounded-full border-[3px] flex items-center justify-center transition-all",
                        connecting ? "opacity-60" : "",
                        status === "listening"
                            ? "bg-blue-50 ring-4 ring-blue-300 animate-pulse"
                            : status === "processing"
                                ? "bg-amber-50 ring-4 ring-amber-300 animate-pulse"
                                : status === "speaking"
                                    ? "bg-green-50 ring-4 ring-green-300 animate-pulse"
                                    : "bg-gray-50 ring-2 ring-gray-200"
                    )}
                    aria-label="Live talk microphone"
                    title={connecting ? "Connecting..." : status === "idle" ? "Tap to start" : status}
                >
                    <div className="h-16 w-16 rounded-full bg-black/80" />
                </button>
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
                        <FadeInOnView key={i} delayMs={i * 50} durationMs={400}>
                            <p className="whitespace-pre-wrap text-sm">
                                {t}
                            </p>
                        </FadeInOnView>
                    ))}
                </div>
            ) : null}
        </main>
    );
}
