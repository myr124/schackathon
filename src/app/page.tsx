"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { io, Socket } from "socket.io-client";
import profilePicture from "../assets/photo-woman.avif";
import { Mic } from 'lucide-react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { Textarea } from "@/components/ui/textarea"

function QuestionsDialog() {
    const questions = [
        "What qualities are you looking for in a partner?",
        "What are your hobbies and interests?",
        "How would your friends describe you to a stranger?",
    ];
    const [step, setStep] = useState(0);
    const [answer, setAnswer] = useState("");
    const [isRecording, setIsRecording] = useState(false);

    // Simple voice-to-text using Web Speech API
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const handleVoiceInput = () => {
        if (!("webkitSpeechRecognition" in window)) {
            alert("Voice input not supported in this browser.");
            return;
        }
        if (!recognitionRef.current) {
            // @ts-ignore
            recognitionRef.current = new window.webkitSpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = "en-US";
            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = event.results[0][0].transcript;
                setAnswer((prev) => prev ? prev + " " + transcript : transcript);
                setIsRecording(false);
            };
            recognitionRef.current.onerror = () => setIsRecording(false);
            recognitionRef.current.onend = () => setIsRecording(false);
        }
        setIsRecording(true);
        recognitionRef.current.start();
    };
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="w-50 -mt-4">Get Started</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Question {step + 1} of {questions.length}</DialogTitle>
                    <DialogDescription>
                        {questions[step]}
                    </DialogDescription>
                </DialogHeader>
                <div className="relative flex flex-col">
                    <Textarea
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        placeholder="Type your answer or use voice..."
                        className="min-h-[120px] mb-4"
                    />
                </div>
                <div className="flex justify-between items-center mt-6">
                    <Button
                        variant="outline"
                        disabled={step === 0}
                        onClick={() => {
                            setStep((s) => Math.max(0, s - 1));
                            setAnswer("");
                        }}
                    >
                        Back
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleVoiceInput}
                            disabled={isRecording}
                            aria-label="Start voice input"
                        >
                            <Mic />
                        </Button>
                        <Button
                            disabled={step === questions.length - 1}
                            onClick={() => {
                                setStep((s) => Math.min(questions.length - 1, s + 1));
                                setAnswer("");
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-baseline min-h-screen px-4 py-8 bg-white">
      <h1 className="mb-6 text-2xl font-bold text-center">Stephany</h1>
      <img
        src={profilePicture.src}
        alt="Profile"
        className="w-40 h-40 sm:w-64 sm:h-64 rounded-full object-cover shadow-md border"
        style={{ maxWidth: "80vw", maxHeight: "40vh" }}
      />
    <div>
      <Card className="w-60 mt-6">
        <CardHeader>
        <CardTitle>Let's get to know you in your own words</CardTitle>
        </CardHeader>
          <div className="w-full flex justify-center">
            <QuestionsDialog/>
          </div>
        </Card>
      </div>
    </main>
  );
}