"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, Home, LogInIcon, MessageCircle, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function NavButton({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const active =
        pathname === href || (href !== "/" && pathname.startsWith(href));

    return (
        <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
                "[&_svg]:size-10 focus-visible:ring-0 focus-visible:border-transparent focus:outline-none active:bg-accent/70 active:text-accent-foreground",
                active && "bg-accent text-accent-foreground"
            )}
        >
            <Link href={href} aria-current={active ? "page" : undefined} className="font-medium">
                {children}
            </Link>
        </Button>
    );
}

export default function HeaderNav() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data }) => {
            if (mounted) setAuthed(!!data.session?.user);
        });
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthed(!!session?.user);
        });
        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, [supabase]);

    return (
        <nav className="flex items-center gap-6">
            <NavButton href="/"><Home /></NavButton>
            <NavButton href="/matches"><Heart /></NavButton>
            <NavButton href="/messages"><MessageCircle /></NavButton>
            <NavButton href="/ai-chat"><Sparkles /></NavButton>
            {authed ? (
                <NavButton href="/account"><User /></NavButton>
            ) : (
                <NavButton href="/login"><LogInIcon /></NavButton>
            )}
        </nav>
    );
}
