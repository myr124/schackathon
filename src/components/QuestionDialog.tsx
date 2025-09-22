"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Pause, Play, Square, RotateCcw } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const questions = [
    "What qualities are you looking for in a partner?",
    "What are your hobbies and interests?",
    "How would your friends describe you to a stranger?",
];

const QuestionsDialog = () => {
    const [step, setStep] = useState(0);
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState("00:00");
    const [continuousWaveform] = useState(true);

    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const recordPluginRef = useRef<any>(null);
    const waveformRef = useRef<HTMLDivElement | null>(null);

    // Create or recreate WaveSurfer instance for recording
    const createRecorder = () => {
        // Require container to exist (Dialog must be open)
        if (!waveformRef.current) {
            console.warn("Waveform container not ready yet; delaying recorder init");
            return false;
        }
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }
        wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "#93c5fd",
            progressColor: "#2563eb",
            height: 60,
            interact: false,
        });
        recordPluginRef.current = wavesurferRef.current.registerPlugin(
            RecordPlugin.create({
                renderRecordedAudio: false,
                continuousWaveform: true,
                continuousWaveformDuration: 30,
            })
        );
        recordPluginRef.current.on("record-end", async (blob: Blob) => {
            console.log("record-end", blob?.size, blob?.type);
            setAudioBlob(blob);
            setAudioURL(URL.createObjectURL(blob));
            setIsRecording(false);
            setIsPaused(false);
            setProgress("00:00");
            // Switch to playback view
            createPlayer(blob);

            // Save with question as key and blob as value
            try {
                const formData = new FormData();
                formData.append("audio", blob, `audio-${Date.now()}.webm`);
                formData.append("question", questions[step]);
                console.log("Uploading audio to /api/audio", {
                    question: questions[step],
                    blobSize: blob.size,
                });
                const res = await fetch("/api/audio", {
                    method: "POST",
                    body: formData,
                });
                const json = await res.json();
                console.log("audio response", json);
            } catch (err) {
                console.error("Error uploading audio", err);
            }
        });
        recordPluginRef.current.on("record-progress", (time: number) => {
            // time in ms
            const formatted = [
                Math.floor((time % 3600000) / 60000),
                Math.floor((time % 60000) / 1000),
            ]
                .map((v) => (v < 10 ? "0" + v : v))
                .join(":");
            setProgress(formatted);
        });
        return true;
    };

    // Create player for a recorded blob
    const createPlayer = (blob: Blob) => {
        if (!waveformRef.current) return;
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }
        wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "#93c5fd",
            progressColor: "#2563eb",
            height: 60,
        });
        wavesurferRef.current.loadBlob(blob);
        wavesurferRef.current.on("finish", () => setIsPlaying(false));
    };

    // Start recording
    const handleStartRecording = async () => {
        setAudioURL(null);
        setAudioBlob(null);
        setIsRecording(true);
        setIsPaused(false);
        setProgress("00:00");
        const ok = createRecorder();
        if (!ok || !recordPluginRef.current) {
            console.error("Recorder not initialized; ensure dialog is open and container is mounted.");
            setIsRecording(false);
            return;
        }
        await recordPluginRef.current.startRecording();
    };

    // Stop recording and save audio
    const handleStopRecording = async () => {
        recordPluginRef.current?.stopRecording();
        setIsRecording(false);
        setIsPaused(false);
    };

    // Pause/Resume recording
    const handlePauseResume = () => {
        if (!isRecording) return;
        if (isPaused) {
            recordPluginRef.current?.resumeRecording();
            setIsPaused(false);
        } else {
            recordPluginRef.current?.pauseRecording();
            setIsPaused(true);
        }
    };

    // Play audio
    const handlePlayAudio = () => {
        if (!audioBlob || !wavesurferRef.current) return;
        setIsPlaying(true);
        wavesurferRef.current.play();
    };

    // Next question
    const handleNext = () => {
        setStep((s) => Math.min(questions.length - 1, s + 1));
        setAudioURL(null);
        setAudioBlob(null);
        setIsRecording(false);
        setIsPaused(false);
        setIsPlaying(false);
        setProgress("00:00");
        wavesurferRef.current?.destroy();
        // Prepare fresh recorder for the next question (hidden until recording starts)
    };

    // Previous question
    const handleBack = () => {
        setStep((s) => Math.max(0, s - 1));
        setAudioURL(null);
        setAudioBlob(null);
        setIsRecording(false);
        setIsPaused(false);
        setIsPlaying(false);
        setProgress("00:00");
        wavesurferRef.current?.destroy();
    };

    // Retake handler
    const handleRetake = () => {
        setAudioBlob(null);
        setAudioURL(null);
        setIsRecording(false);
        setIsPaused(false);
        setIsPlaying(false);
        setProgress("00:00");
        wavesurferRef.current?.destroy();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            try {
                wavesurferRef.current?.destroy();
            } catch { }
            if (audioURL) URL.revokeObjectURL(audioURL);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="w-60 -mt-4  shadow-xl backdrop-blur-md border-none hover:scale-105 transition-transform">
                    Get Started
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Question {step + 1} of {questions.length}
                    </DialogTitle>
                    <DialogDescription className="text-xl">{questions[step]}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center w-full gap-2 mt-2">
                    {/* Waveform container is always in the DOM so the recorder can attach; hidden until audio is ready */}
                    <div className={`flex flex-col items-center w-full mt-2 ${audioBlob ? "" : "invisible h-0"}`}>
                        <div
                            ref={waveformRef}
                            className="border rounded bg-gray-100 w-[320px] h-[80px] mx-auto"
                        />
                        <span className="text-xs text-gray-500 mt-2">{progress}</span>
                    </div>

                    {/* Mic / Stop (shown only when audio not yet recorded) */}
                    {!audioBlob && (
                        <div className="flex flex-col items-center">
                            {!isRecording ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleStartRecording}
                                        className="bg-white border-2 border-blue-300 shadow-lg rounded-full w-20 h-20 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all"
                                        aria-label="Start recording"
                                    >
                                        <Mic size={40} />
                                    </button>
                                    <span className="mt-2 text-sm text-gray-500">
                                        Tap to Speak
                                    </span>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleStopRecording}
                                        className="bg-white border-2 border-red-300 shadow-lg rounded-full w-20 h-20 flex items-center justify-center text-red-600 hover:bg-red-50 transition-all"
                                        aria-label="Stop recording"
                                    >
                                        <Square size={40} />
                                    </button>
                                    <span className="mt-2 text-sm text-gray-500">Recording</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex justify-between align-center items-center mt-2 w-full">
                    <Button variant="outline" disabled={step === 0} onClick={handleBack}>
                        Back
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRetake}
                            aria-label="Retake"
                        >
                            <RotateCcw />
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePlayAudio}
                            aria-label="Play audio"
                            disabled={isPlaying}
                        >
                            <Play />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        {step === questions.length - 1 ? (
                            <DialogTrigger asChild>
                                <Button variant="destructive" className="bg-blue-500">
                                    Done
                                </Button>
                            </DialogTrigger>
                        ) : (
                            <Button
                                onClick={handleNext}
                            // disabled={!audioBlob}
                            >
                                Next
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default QuestionsDialog;
