"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
    children: React.ReactNode;
    className?: string;
    durationMs?: number;
    delayMs?: number;
    once?: boolean;
};

/**
 * Fades children in when they enter the viewport.
 * Useful for lists/cards that load dynamically.
 */
export default function FadeInOnView({
    children,
    className,
    durationMs = 700,
    delayMs = 0,
    once = true,
}: Props) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    if (once) observer.unobserve(entry.target);
                } else if (!once) {
                    setVisible(false);
                }
            },
            { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [once]);

    return (
        <div
            ref={ref}
            className={cn("transition-all ease-out will-change-transform", className)}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "none" : "translateY(6px)",
                transitionDuration: `${durationMs}ms`,
                transitionDelay: `${delayMs}ms`,
            }}
        >
            {children}
        </div>
    );
}
