"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import profilePicture from "../assets/adam.avif";
import { Mic, Pause, Play, Square, RotateCcw } from 'lucide-react';
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import QuestionDialog from "@/components/QuestionDialog";
import {
    Card,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,

} from "@/components/ui/dialog";

export default function Home() {
    return (
        <main className="flex flex-col items-center justify-baseline min-h-screen px-4 py-8 bg-white">
            <h1 className="mb-2 text-2xl font-bold text-center">Adam</h1>
            <img
                src={profilePicture.src}
                alt="Profile"
                className="w-60 h-60 sm:w-64 sm:h-64 rounded-md object-cover shadow-md border"
                style={{ maxWidth: "80vw", maxHeight: "40vh" }}
            />
            <div>
                <Card className="w-60 mt-6">
                    <CardHeader>
                        <CardTitle>Let's get to know you in your own words</CardTitle>
                    </CardHeader>
                    <div className="w-full flex justify-center">
                        <QuestionDialog />
                    </div>
                </Card>
            </div>
        </main>
    );
}
