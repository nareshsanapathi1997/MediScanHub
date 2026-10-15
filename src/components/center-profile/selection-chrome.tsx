"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { formatInr } from "@/lib/format";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { PULSE_KEY, SCROLL_KEY } from "./profile-toggle-link";

export function SelectionPanel({ count, className, children }: { count: number; className?: string; children: React.ReactNode }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(PULSE_KEY)) return;
      sessionStorage.removeItem(PULSE_KEY);
    } catch {
      return;
    }
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 2400);
    return () => window.clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SCROLL_KEY)) return;
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById("selection-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [count]);

  return (
    <aside
      id="selection-panel"
      aria-label="Your booking"
      className={cn(
        className,
        pulse && "border-primary bg-primary/5 shadow-md shadow-primary/15 transition-colors duration-500",
      )}
    >
      {children}
    </aside>
  );
}

export function MobileBookingBar({ count, totalPaise }: { count: number; totalPaise: number }) {
  if (count === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <ShoppingBag className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-medium">
              {count} item{count === 1 ? "" : "s"} in booking
            </p>
            <p className="truncate text-muted-foreground">Est. {formatInr(totalPaise)}</p>
          </div>
        </div>
        <Link href="#book" className={cn(buttonVariants(), "h-10 shrink-0 px-4")}>
          Review &amp; book
        </Link>
      </div>
    </div>
  );
}
