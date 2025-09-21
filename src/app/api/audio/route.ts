import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("audio");
        const question = formData.get("question");

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "No audio file uploaded" }, { status: 400 });
        }
        if (!question || typeof question !== "string") {
            return NextResponse.json({ error: "No question provided" }, { status: 400 });
        }

        // @ts-ignore - File from formData
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = file.name || `audio-${Date.now()}.webm`;
        const saveDir = path.join(process.cwd(), "src", "assets", "audio");

        // Ensure directory exists
        await mkdir(saveDir, { recursive: true });

        const savePath = path.join(saveDir, filename);
        await writeFile(savePath, buffer);

        // Optionally, save the question alongside the audio (e.g., as a .txt file)
        const questionPath = path.join(saveDir, `${filename}.txt`);
        await writeFile(questionPath, question);

        return NextResponse.json({ success: true, filename, question });
    } catch (err) {
        console.error("/api/save-audio error:", err);
        return NextResponse.json({ error: "Failed to save audio" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filename = searchParams.get("filename");
        if (!filename) {
            return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
        }

        const audioDir = path.join(process.cwd(), "src", "assets", "audio");
        const audioPath = path.join(audioDir, filename);
        const txtPath = path.join(audioDir, `${filename}.txt`);

        // Read audio file
        let audioBuffer;
        try {
            audioBuffer = await readFile(audioPath);
        } catch {
            return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
        }

        // Read question file
        let question;
        try {
            question = await readFile(txtPath, "utf8");
        } catch {
            question = null;
        }

        return NextResponse.json({
            filename,
            question,
            audio: audioBuffer.toString("base64"),
        });
    } catch (err) {
        console.error("/api/audio GET error:", err);
        return NextResponse.json({ error: "Failed to retrieve audio" }, { status: 500 });
    }
}
