"use client";

import React, { useEffect, useMemo, useState } from "react";
import FadeInOnView from "@/components/FadeInOnView";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Prompt = { text: string; audioUrl?: string };

type ListItem = { key: string; slug: string; url: string; updatedAt?: string; size?: number };

function slugify(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// Keep these aligned with Home page to map slugs->questions nicely
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

export default function RecordedPrompts({
    viewedUserId,
    staticPrompts,
}: {
    viewedUserId: string;
    staticPrompts?: Prompt[];
}) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [me, setMe] = useState<string | null>(null);
    const [items, setItems] = useState<ListItem[] | null>(null);
    const [loading, setLoading] = useState(false);


    // Who am I?
    useEffect(() => {
        let mounted = true;
        supabase.auth.getUser().then(({ data }) => {
            if (mounted) setMe(data.user?.id ?? null);
        });
        return () => {
            mounted = false;
        };
    }, [supabase]);

    const isSelf = me && viewedUserId === me;

    // If this is the signed-in user, fetch their recordings
    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!isSelf) {
                setItems(null);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch("/api/audio/list");
                const data = await res.json().catch(() => ({}));
                if (!cancelled) {
                    const list = Array.isArray(data?.items) ? (data.items as ListItem[]) : [];
                    // Keep the newest (by updatedAt) per slug
                    const perSlug = new Map<string, ListItem>();
                    for (const it of list) {
                        const current = perSlug.get(it.slug);
                        const t = it.updatedAt ? Date.parse(it.updatedAt) : 0;
                        const ct = current?.updatedAt ? Date.parse(current.updatedAt) : -1;
                        if (!current || t >= ct) perSlug.set(it.slug, it);
                    }
                    setItems(Array.from(perSlug.values()).sort((a, b) => a.slug.localeCompare(b.slug)));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
        };
    }, [isSelf]);

    // Build the sections to render
    const sections = useMemo(() => {
        if (isSelf && items && items.length > 0) {
            // From recordings; show by slug mapped to question label
            return items.map((it) => ({
                key: it.slug,
                title: labelFromSlug(it.slug),
                url: it.url,
            }));
        }

        // Fallback to static prompts (but avoid broken demo URLs)
        const list = Array.isArray(staticPrompts) ? staticPrompts : [];
        return list.map((p, i) => ({
            key: `static-${i}`,
            title: p.text,
            // Only use audioUrl if it looks like a valid absolute/signed URL; otherwise omit to avoid 404s
            url: /^https?:\/\//i.test(p.audioUrl || "") ? (p.audioUrl as string) : undefined,
        }));
    }, [isSelf, items, staticPrompts]);

    return (
        <div className="mt-8 max-w-2xl mx-auto w-full">
            {loading ? (
                <p className="text-sm text-muted-foreground">Loading recordings…</p>
            ) : sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recordings yet.</p>
            ) : (
                sections.map((s, idx) => (
                    <section key={s.key} className="mb-8">
                        <FadeInOnView>
                            <h2 className="font-semibold">{s.title}</h2>
                        </FadeInOnView>
                        <div className="mt-3">
                            <FadeInOnView>
                                {s.url ? (
                                    <audio controls src={s.url} className="w-full" />
                                ) : (
                                    <p className="text-sm text-muted-foreground">No recording yet.</p>
                                )}
                            </FadeInOnView>
                        </div>
                    </section>
                ))
            )}
        </div>
    );
}
