"use client";

import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored as Theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

    // Apply theme and persist
    useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        root.style.colorScheme = theme;
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Respond to system preference changes if no explicit preference is set
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
            const stored = localStorage.getItem("theme");
            if (!stored) {
                setTheme(e.matches ? "dark" : "light");
            }
        };
        try {
            mql.addEventListener("change", handleChange);
        } catch {
            // Safari <14 fallback
            // @ts-ignore
            mql.addListener(handleChange);
        }

        const onStorage = (e: StorageEvent) => {
            if (e.key === "theme" && e.newValue) {
                setTheme(e.newValue === "dark" ? "dark" : "light");
            }
        };
        window.addEventListener("storage", onStorage);

        return () => {
            try {
                mql.removeEventListener("change", handleChange);
            } catch {
                // @ts-ignore
                mql.removeListener(handleChange);
            }
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggle}
            className="relative [&_svg]:size-6"
        >
            <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
