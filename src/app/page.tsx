"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { io, Socket } from "socket.io-client";
import profilePicture from "../assets/photo-woman.avif";

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

function QuestionsDialog() {
    const questions = [
        "What qualities are you looking for in a partner?",
        "What are your hobbies and interests?",
        "How would your friends describe you to a stranger?",
    ];
    const [step, setStep] = useState(0);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="mt-4">Get Started</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Question {step + 1} of {questions.length}</DialogTitle>
                    <DialogDescription>
                        {questions[step]}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-between mt-6">
                    <Button
                        variant="outline"
                        disabled={step === 0}
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                        Back
                    </Button>
                    <Button
                        disabled={step === questions.length - 1}
                        onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
                    >
                        Next
                    </Button>
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
      <div className="flex justify-center w-full mt-6">
        <Card className="max-w-sm w-full flex items-center shadow-md">
          <CardHeader className="w-full flex flex-col items-center p-0">
            <CardTitle >Let's get to know you in your own words</CardTitle>
          </CardHeader>
          <div className="w-full flex justify-center">
            <QuestionsDialog/>
          </div>
        </Card>
      </div>
    </main>
  );
}

"What qualities are you looking for in a partner?"
"What are your hobbies and interests?"
"How would your friends describe you to a stranger?"