"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

    async function startLive() {
        try {
            setError(null);
            autoStopTriggeredRef.current = false;
            setTexts([]);
            setInterim("");
            setFinals([]);
            setConnecting(true);

            // 1) Get mic stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Prefer webm/opus or ogg/opus for compatibility with backend (maps to WEBM_OPUS or OGG_OPUS)
            const mimeType =
                MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                    ? "audio/webm;codecs=opus"
                    : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
                        ? "audio/ogg;codecs=opus"
                        : MediaRecorder.isTypeSupported("audio/webm")
                            ? "audio/webm"
                            : "";
            // Choose matching Speech-to-Text encoding based on container
            const encoding = mimeType.includes("ogg") ? "OGG_OPUS" : "WEBM_OPUS";
            // Remember chosen formats for turn-taking restarts
            mimeRef.current = mimeType;
            encodingRef.current = encoding;

            const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = rec;

            // 2) Open Socket.IO connection to backend streaming STT
            const socket = io("http://localhost:5001", { transports: ["websocket"] });
            socketRef.current = socket;

            socket.on("connect", () => {
                // Tell server to start recognition
                try {
                    socket.emit("stt:start", {
                        config: {
                            encoding,
                            languageCode: "en-US",
                            enableAutomaticPunctuation: true,
                        },
                    });
                } catch { }
                // Send periodic blobs to server
                rec.ondataavailable = async (e) => {
                    if (e.data && e.data.size > 0) {
                        const buf = await e.data.arrayBuffer();
                        socket.emit("stt:audio", buf);
                    }
                };
                // Collect chunks every 250ms for low-latency streaming
                rec.start(250);
                setRecording(true);
                setConnecting(false);
                // Enable auto turn-taking: detect end-of-speech and process
                startVAD(stream);
                setStatus("listening");
            });

            // Socket.IO event handlers
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

            // Connection errors
            socket.on("connect_error", (err: any) => {
                setError(`Socket.IO connect_error: ${err?.message || String(err)}`);
                console.error("Socket.IO connect_error:", err);
            });
            socket.on("error", (err: any) => {
                setError(`Socket.IO error: ${err?.message || String(err)}`);
                console.error("Socket.IO error:", err);
            });

            socket.on("disconnect", () => {
                // Ensure recorder stops if socket closes
                try {
                    if (rec.state !== "inactive") rec.stop();
                } catch {
                    // no-op
                }
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
        // Stop recording and close socket
        try {
            mediaRecorderRef.current?.stop();
        } catch {
            // no-op
        }
        try {
            if (socketRef.current) {
                socketRef.current.emit("stt:stop");
                socketRef.current.disconnect();
            }
        } catch {
            // no-op
        }
        cleanupStream();
        setRecording(false);

        // Send final transcript to Gemini streaming endpoint and play audio in real time
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
            } catch {
                // no-op
            }
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
        let receivedAny = false;
        let replyChunks: string[] = [];

        // Ensure audio context is ready
        ensureAudioContext();
        // Reset scheduling so we start immediately
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
                        receivedAny = true;
                        setStatus("speaking");
                        try {
                            await enqueueAudioChunk(obj.data, obj.mime || "audio/L16; rate=16000");
                        } catch (e) {
                            console.warn("Failed to enqueue audio chunk:", e);
                        }
                    } else if (obj.type === "text" && typeof obj.text === "string") {
                        receivedAny = true;
                        replyChunks.push(obj.text);
                        setTexts((prev) => [...prev, obj.text]);
                    } else if (obj.type === "error") {
                        throw new Error(String(obj.message || "Stream error"));
                    } else if (obj.type === "done") {
                        // Finished producing audio/text
                        const ctxNow = ensureAudioContext();
                        const waitMs = Math.max(0, (scheduledAtRef.current - ctxNow.currentTime) * 1000);
                        if (waitMs > 0) {
                            await new Promise((r) => setTimeout(r, waitMs));
                        }

                        let replyText = replyChunks.join(" ").trim();

                        // Fallback: if no audio/text chunks were received, call non-streaming Gemini and speak via Web Speech
                        if (!receivedAny) {
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
                                    } catch {
                                        // no-op
                                    }
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
            // Flush any remaining decoder buffer
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
        } catch {
            // no-op
        }
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
        // Process current utterance, then resume listening (keep conversation open)
        void autoProcessTurn();
    }

    async function autoProcessTurn() {
        if (processingRef.current) return;
        processingRef.current = true;
        console.log("autoProcessTurn: start");
        setStatus("processing");

        // Stop recording to flush STT and avoid echo while we play TTS
        try {
            const rec = mediaRecorderRef.current;
            if (rec) {
                // Detach handler first to avoid late events
                try { (rec as any).ondataavailable = null; } catch { }
                if (rec.state !== "inactive") rec.stop();
            }
        } catch { }

        // Ask STT to stop and wait for 'stt:stopped' confirmation
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

        // Wait for finalization to complete (or timeout to avoid hanging)
        await Promise.race([stoppedPromise, timeoutPromise]);

        // Capture final utterance text (fallback to lastUtteranceRef to avoid races)
        const candidate = [finals.join(" ").trim(), interim.trim()].filter(Boolean).join(" ");
        let utterance = (candidate || lastUtteranceRef.current).trim();
        console.log("autoProcessTurn: finalText length", utterance.length);

        // Reset live transcript for next turn
        setInterim("");
        setFinals([]);
        lastUtteranceRef.current = "";

        // If nothing was said, just resume listening
        if (!utterance) {
            await resumeListeningTurn();
            processingRef.current = false;
            autoStopTriggeredRef.current = false;
            return;
        }

        // Stream Gemini audio reply and wait until playback finishes
        try {
            await streamGeminiAudio(utterance, history);
        } catch (e: any) {
            const msg = e instanceof Error ? e.message : String(e ?? "Gemini streaming failed");
            setError(msg);
        }

        // Resume mic and STT for the next turn
        await resumeListeningTurn();
        setStatus("listening");

        processingRef.current = false;
        autoStopTriggeredRef.current = false;
    }

    async function resumeListeningTurn() {
        const stream = streamRef.current;
        const socket = socketRef.current;
        if (!stream || !socket) return;

        // Restart STT on the existing socket
        try {
            socket.emit("stt:start", {
                config: {
                    encoding: encodingRef.current,
                    languageCode: "en-US",
                    enableAutomaticPunctuation: true,
                },
            });
        } catch { }

        // Create a fresh MediaRecorder for the next turn
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
        // Expect formats like "audio/L16; rate=16000"
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
        // Interpret as signed 16-bit little-endian PCM (L16)
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
            <h1 className="mb-4 text-2xl font-semibold">Home</h1>

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
