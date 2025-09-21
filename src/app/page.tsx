"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import profilePicture from "../assets/adam.avif";
import { Mic, Pause, Play, Square, RotateCcw } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import QuestionDialog from "@/components/QuestionDialog";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

import ProfilePicture from "@/components/ProfilePicture";
import VoiceCard from "@/components/VoiceCard";
import { useEffect } from "react";

type VoiceData = {
    filename: string;
    question: string;
    audio: string;
};

function useVoiceCards() {
    const [voiceCards, setVoiceCards] = useState<VoiceData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchVoiceCards() {
            setLoading(true);
            // Replace with your actual filenames or fetch from backend
            const filenames = ["audio1.wav", "audio2.wav", "audio3.wav"];
            const results: VoiceData[] = [];
            for (const filename of filenames) {
                try {
                    const res = await fetch(`/api/audio?filename=${filename}`);
                    if (res.ok) {
                        const data = await res.json();
                        results.push(data);
                    }
                } catch (e) {
                    // Handle error if needed
                }
            }
            setVoiceCards(results);
            setLoading(false);
        }
        fetchVoiceCards();
    }, []);

    return { voiceCards, loading };
}

function VoiceCardsList() {
    const { voiceCards, loading } = useVoiceCards();

    if (loading) return <div>Loading...</div>;
    return (
        <div className="flex flex-col gap-4 mt-4">
            {voiceCards.map((vc, idx) => (
                <VoiceCard
                    key={vc.filename}
                    question={vc.question}
                    audioBase64={vc.audio}
                />
            ))}
        </div>
    );
}
export default function Home() {
  return (
    <main className="flex flex-col items-center justify-baseline min-h-screen px-4 py-8 bg-white">
      <h1 className="mb-2 text-2xl font-bold text-center">Adam</h1>
      <ProfilePicture src={profilePicture.src} alt="Profile" />
      <div className="flex flex-col gap-4 mt-4">
        <VoiceCardsList />
      </div>
      <div>
        <Card className="w-70 ">
          <CardHeader>
            <CardTitle>Let's get to know you in your own words</CardTitle>
          </CardHeader>
          <div className="w-full flex justify-center">
            <QuestionDialog />
          </div>
        </Card>
        2
      </div>
    </main>
  );
}
