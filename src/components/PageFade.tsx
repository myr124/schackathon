"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
    children: React.ReactNode;
    className?: string;
    durationMs?: number;
};

/**
 * Fades page content in on initial mount and on every route change.
 * Drop this around {children} in the root layout.
 */
export default function PageFade({ children, className, durationMs = 250 }: Props) {
    const pathname = usePathname();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Reset and then show on the next frame to trigger the CSS transition
        setVisible(false);
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, [pathname]);

    return (
        <div
            className={cn("opacity-0 transition-opacity ease-out", className)}
            style={{ opacity: visible ? 1 : 0, transitionDuration: `${durationMs}ms` }}
        >
            {children}
        </div>
    );
}
