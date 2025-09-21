"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Heart, Home, MessageCircle } from "lucide-react";

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
    return (
        <nav className="flex items-center gap-20">
            <NavButton href="/"><Home></Home></NavButton>
            <NavButton href="/matches"><Heart></Heart></NavButton>
            <NavButton href="/messages"><MessageCircle></MessageCircle></NavButton>
        </nav>
    );
}
