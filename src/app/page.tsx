"use client";

import { useEffect, useMemo, useState } from "react";
import profilePicture from "../assets/adam.avif";
import QuestionDialog from "@/components/QuestionDialog";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ProfilePicture from "@/components/ProfilePicture";
import FadeInOnView from "@/components/FadeInOnView";

type ListItem = { key: string; slug: string; url: string; updatedAt?: string; size?: number };

// Keep section order aligned with the dialog questions
const QUESTIONS_IN_ORDER = [
    "What qualities are you looking for in a partner?",
    "What are your hobbies and interests?",
    "How would your friends describe you to a stranger?",
];

function slugify(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const SLUG_TO_QUESTION = new Map<string, string>(
    QUESTIONS_IN_ORDER.map((q) => [slugify(q), q] as const)
);

function useGroupedRecordings() {
    const [grouped, setGrouped] = useState<Record<string, ListItem[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const res = await fetch("/api/audio/list");
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !Array.isArray(data?.items)) {
                    if (!cancelled) {
                        setGrouped({});
                    }
                    return;
                }
                const items: ListItem[] = data.items;

                const map: Record<string, ListItem[]> = {};
                for (const it of items) {
                    const q = SLUG_TO_QUESTION.get(it.slug) ?? it.slug.replace(/-/g, " ");
                    if (!map[q]) map[q] = [];
                    map[q].push(it);
                }
                // If multiple somehow exist, keep newest first by updatedAt if present
                Object.keys(map).forEach((k) => {
                    map[k].sort((a, b) => {
                        const at = a.updatedAt ? Date.parse(a.updatedAt) : 0;
                        const bt = b.updatedAt ? Date.parse(b.updatedAt) : 0;
                        return bt - at;
                    });
                });

                if (!cancelled) setGrouped(map);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    return { grouped, loading };
}

export default function Home() {
    const [displayName, setDisplayName] = useState<string>("");
    const [avatarUrl, setAvatarUrl] = useState<string>("");

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getUser().then(({ data }) => {
            const user = data.user;
            if (user) {
                const md: any = user.user_metadata || {};
                const name =
                    md.full_name ||
                    md.name ||
                    md.username ||
                    user.email ||
                    user.phone ||
                    "User";
                setDisplayName(name);
                if (md.avatar_url) {
                    setAvatarUrl(md.avatar_url as string);
                }
            }
        });
    }, []);

    const { grouped, loading } = useGroupedRecordings();

    // Compute section order: known questions first (even if empty), then any extras encountered
    const extraQuestions = useMemo(() => {
        const extras: string[] = [];
        Object.keys(grouped).forEach((q) => {
            if (!QUESTIONS_IN_ORDER.includes(q)) extras.push(q);
        });
        return extras.sort();
    }, [grouped]);

    const allSections = [...QUESTIONS_IN_ORDER, ...extraQuestions];

    return (
        <main className="flex flex-col items-center justify-baseline min-h-screen px-4 py-8 bg-background">
            <ProfilePicture
                src={avatarUrl}
                alt="Profile"
                editable
                onUploaded={(url: string) => setAvatarUrl(url)}
            />

            {/* Capture UI */}
            <div className="mt-6 w-full max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Let's get to know you in your own words</CardTitle>
                    </CardHeader>
                    <div className="w-full flex justify-center pb-4">
                        <QuestionDialog />
                    </div>
                </Card>
            </div>

            {/* Recorded Q&A sections (one per question; newest replaces older in storage) */}
            <div className="mt-8 w-full max-w-2xl">
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading your recordings…</p>
                ) : (
                    allSections.map((q) => {
                        const items = grouped[q] ?? [];
                        const latest = items[0]; // by design we upsert, so at most one; safeguard if multiple
                        return (
                            <section key={q} className="mb-8">
                                <FadeInOnView>
                                    <h2 className="font-semibold">{q}</h2>
                                </FadeInOnView>
                                {!latest ? (
                                    <p className="mt-2 text-sm text-muted-foreground">No recording yet.</p>
                                ) : (
                                    <div className="mt-3">
                                        <FadeInOnView>
                                            <audio controls src={latest.url} className="w-full" />
                                        </FadeInOnView>
                                    </div>
                                )}
                            </section>
                        );
                    })
                )}
            </div>
        </main>
    );
}
