"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type GeoPoint = {
    type: "Point";
    coordinates: [number, number];
};
type Photo = { url: string; order: number };
type Prompt = { text: string; audioUrl?: string };
type VoiceProfile = { prompts: Prompt[]; personalityProfile: string };
export type UserDoc = {
    _id: string;
    userId: string;
    name: string;
    email: string;
    location: GeoPoint;
    photos: Photo[];
    voiceProfile: VoiceProfile;
    interests: string[];
    friends: string[];
};

// Map slugs from /api/audio/list to human-readable labels (aligned with Home)
function slugify(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
const QUESTIONS_IN_ORDER = [
    "What qualities are you looking for in a partner?",
    "What are your hobbies and interests?",
    "How would your friends describe you to a stranger?",
];
const SLUG_TO_QUESTION = new Map<string, string>(
    QUESTIONS_IN_ORDER.map((q) => [slugify(q), q] as const)
);
function labelFromSlug(slug: string) {
    return SLUG_TO_QUESTION.get(slug) ?? slug.replace(/-/g, " ");
}

function summarizeProfile(p: UserDoc) {
    const primaryPhoto = [...(p.photos || [])].sort((a, b) => a.order - b.order)[0]?.url;
    const promptTopics = (p.voiceProfile?.prompts || []).map((pr) => `- ${pr.text}`).join("\n");
    const hasRecordings = (p.voiceProfile?.prompts?.length ?? 0) > 0;
    return [
        `Name: ${p.name}`,
        `Email: ${p.email}`,
        `UserId: ${p.userId}`,
        `Interests: ${p.interests?.join(", ") || "N/A"}`,
        `Personality: ${p.voiceProfile?.personalityProfile || "N/A"}`,
        `Primary Photo: ${primaryPhoto || "N/A"}`,
        `Recorded prompts: ${hasRecordings ? "Some available (links may be unavailable)" : "None"}`,
        `Prompt topics:\n${promptTopics || "- None"}`,
        `Location (lon,lat): ${p.location?.coordinates?.join(", ") || "N/A"}`,
    ].join("\n");
}

function buildPrompt(you: UserDoc, match: UserDoc, recordedLabels: string[]) {
    const mutualInterests = (you.interests || []).filter((i) => (match.interests || []).includes(i));
    const mutual = mutualInterests.length ? mutualInterests.join(", ") : "None";
    const recordingsLine = recordedLabels.length ? recordedLabels.join(", ") : "None";

    return `
You are a concierge for planning thoughtful, realistic first dates.

Guidance:
- Some audio links may be missing or inaccessible; if recordings are missing or cannot be played, ignore them and rely on interests and personality instead.
- Do not reference audio URLs directly in the plan.

Mutual interests: ${mutual}
My recordings available for: ${recordingsLine}

My profile:
${summarizeProfile(you)}

Their profile:
${summarizeProfile(match)}

Task:
- Propose a complete first-date itinerary tailored to our mutual interests, personalities, and likely location.
- Keep it specific and actionable (venues/activities can be generic placeholders if needed).
- Consider time of day, budget, and accessibility.
- Include small personal touches referencing profile details.
- Provide alternative options (indoor/outdoor, quiet/lively).
- Provide 3–5 tailored conversation prompts.
- Provide a friendly, concise message I can send to invite them on this date.

Output format (Markdown):
# Title
## Overview
## Schedule
- 6:00 PM — ...
- 7:15 PM — ...
## Why this works for us
## Talking points
- ...
## Budget
## Alternatives
## Message to send
`;
}

function parseItinerary(markdown: string) {
    const out: {
        title?: string;
        overview?: string;
        schedule: { time?: string; text: string }[];
        talkingPoints?: string[];
        budget?: string;
        alternatives?: string[];
        inviteMessage?: string;
    } = { schedule: [] };

    if (!markdown) return out;

    try {
        // Title: first H1
        const titleMatch = markdown.match(/^#\s+(.+)$/m);
        if (titleMatch) out.title = titleMatch[1].trim();

        // Overview: text under "## Overview" until next ##
        const ov = markdown.split(/^##\s+Overview\s*$/m)[1];
        if (ov) {
            const ovBody = ov.split(/^##\s+/m)[0] || "";
            out.overview = ovBody.trim();
        }

        // Schedule: lines starting with "- " under "## Schedule"
        const sch = markdown.split(/^##\s+Schedule\s*$/m)[1];
        if (sch) {
            const schBody = sch.split(/^##\s+/m)[0] || "";
            const lines = schBody.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- "));
            for (const line of lines) {
                const item = line.replace(/^-+\s*/, "");
                // Try to extract time like "6:00 PM —" or "6:00 PM -"
                const timeMatch = item.match(/^([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)\s*[—-]\s*(.+)$/i);
                if (timeMatch) {
                    out.schedule.push({ time: timeMatch[1].trim(), text: timeMatch[2].trim() });
                } else {
                    out.schedule.push({ text: item });
                }
            }
        }

        // Talking points: bullets under "## Talking points"
        const tp = markdown.split(/^##\s+Talking points\s*$/m)[1];
        if (tp) {
            const tpBody = tp.split(/^##\s+/m)[0] || "";
            const lines = tpBody.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- "));
            const pts = lines.map((l) => l.replace(/^-+\s*/, "").trim()).filter(Boolean);
            if (pts.length) out.talkingPoints = pts;
        }

        // Budget
        const bd = markdown.split(/^##\s+Budget\s*$/m)[1];
        if (bd) {
            const bdBody = bd.split(/^##\s+/m)[0] || "";
            out.budget = bdBody.trim();
        }

        // Alternatives: bullets under "## Alternatives"
        const alt = markdown.split(/^##\s+Alternatives\s*$/m)[1];
        if (alt) {
            const altBody = alt.split(/^##\s+/m)[0] || "";
            const lines = altBody.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- "));
            const opts = lines.map((l) => l.replace(/^-+\s*/, "").trim()).filter(Boolean);
            if (opts.length) out.alternatives = opts;
        }

        // Message to send
        const msg = markdown.split(/^##\s+Message to send\s*$/m)[1];
        if (msg) {
            const msgBody = msg.split(/^##\s+/m)[0] || "";
            out.inviteMessage = msgBody.trim();
        }
    } catch {
        // noop
    }

    return out;
}

export default function CreateDateDialog({
    you,
    match,
    buttonClassName,
    label = "Create Date",
}: {
    you: UserDoc;
    match: UserDoc;
    buttonClassName?: string;
    label?: string;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [recordedLabels, setRecordedLabels] = useState<string[]>([]);

    // Fetch signed-in user's recordings and map slugs to labels for prompt context
    useEffect(() => {
        let cancelled = false;
        async function run() {
            try {
                const res = await fetch("/api/audio/list");
                if (!res.ok) return;
                const data = await res.json().catch(() => ({}));
                const items: Array<{ slug: string }> = Array.isArray(data?.items) ? data.items : [];
                const labels = Array.from(new Set(items.map((it) => labelFromSlug(it.slug))));
                if (!cancelled) setRecordedLabels(labels);
            } catch { }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, []);

    const input = useMemo(() => buildPrompt(you, match, recordedLabels), [you, match, recordedLabels]);
    const parsed = useMemo(() => parseItinerary(plan), [plan]);

    const generate = useCallback(async () => {
        setLoading(true);
        setError(null);
        setPlan("");
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000);
            const res = await fetch("/api/itinerary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: input }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || "Failed to generate itinerary");
            }
            const combined =
                (typeof data?.text === "string" && data.text.trim()) ||
                (Array.isArray(data?.texts) ? data.texts.join("\n").trim() : "");
            setPlan(combined || "No response text received.");
        } catch (e: any) {
            if (e?.name === "AbortError") {
                setError("Itinerary request timed out. Please try again.");
            } else {
                setError(e?.message || "Unexpected error generating itinerary.");
            }
        } finally {
            setLoading(false);
        }
    }, [input]);

    const onOpen = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setOpen(true);
        void generate();
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(plan);
        } catch {
            // ignore copy errors
        }
    };

    return (
        <>
            <Button
                type="button"
                variant="secondary"
                size="sm"
                className={buttonClassName}
                onClick={onOpen}
                title="Generate a tailored date itinerary"
            >
                {label}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create a date with {match.name}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Generating itinerary…</p>
                        ) : error ? (
                            <p className="text-sm text-red-600">{error}</p>
                        ) : (
                            <div className="space-y-5">
                                {parsed.title ? (
                                    <h3 className="text-lg font-semibold">{parsed.title}</h3>
                                ) : null}

                                {parsed.overview ? (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Overview</h4>
                                        <p className="mt-1 whitespace-pre-wrap text-sm">{parsed.overview}</p>
                                    </div>
                                ) : null}

                                {parsed.schedule.length > 0 ? (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Timeline</h4>
                                        <ol className="relative ml-3 border-l pl-4">
                                            {parsed.schedule.map((s, i) => (
                                                <li key={i} className="mb-4 ml-2">
                                                    <span className="absolute -left-[7px] mt-1 block h-3 w-3 rounded-full bg-primary" />
                                                    {s.time ? (
                                                        <div className="text-xs font-medium text-muted-foreground">{s.time}</div>
                                                    ) : null}
                                                    <div className="text-sm whitespace-pre-wrap">{s.text}</div>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ) : null}

                                {parsed.talkingPoints?.length ? (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Talking points</h4>
                                        <ul className="mt-1 list-disc pl-5 text-sm">
                                            {parsed.talkingPoints.map((t, i) => (
                                                <li key={i}>{t}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {parsed.budget ? (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Budget</h4>
                                        <p className="mt-1 whitespace-pre-wrap text-sm">{parsed.budget}</p>
                                    </div>
                                ) : null}

                                {parsed.alternatives?.length ? (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Alternatives</h4>
                                        <ul className="mt-1 list-disc pl-5 text-sm">
                                            {parsed.alternatives.map((a, i) => (
                                                <li key={i}>{a}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {parsed.inviteMessage ? (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground">Message to send</h4>
                                        <pre className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                                            {parsed.inviteMessage}
                                        </pre>
                                    </div>
                                ) : null}

                                {/* Fallback: show raw Markdown if we couldn't parse anything meaningful */}
                                {!parsed.title && !parsed.overview && parsed.schedule.length === 0 ? (
                                    <pre className="whitespace-pre-wrap text-sm">{plan}</pre>
                                ) : null}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={generate} disabled={loading}>
                            {loading ? "Generating…" : "Regenerate"}
                        </Button>
                        <Button onClick={copy} disabled={!plan}>
                            Copy
                        </Button>
                        <Button onClick={() => setOpen(false)} variant="secondary">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
