"use client";

import { useEffect } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "list";
const PREFIX = "ms_view_";

function remember(page: string, view: ViewMode) {
  document.cookie = `${PREFIX}${page}=${view}; path=/; max-age=31536000; samesite=lax`;
  try {
    window.localStorage.setItem(`${PREFIX}${page}`, view);
  } catch {
    // Private mode: the cookie still works.
  }
}

/**
 * Card/List segmented control. Plain links, so it works without JavaScript; a click also remembers the
 * choice (cookie for the server render, localStorage as a backup) so the page opens the same way next time.
 */
export function ViewToggle({ page, view, hrefs, className }: { page: string; view: ViewMode; hrefs: Record<ViewMode, string>; className?: string }) {
  // If the cookie was cleared but localStorage still has a choice, restore the cookie for the next visit.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`${PREFIX}${page}`);
      if ((saved === "cards" || saved === "list") && !document.cookie.includes(`${PREFIX}${page}=`)) remember(page, saved);
    } catch {
      // ignore
    }
  }, [page]);
  const options: Array<{ value: ViewMode; label: string; Icon: typeof List }> = [
    { value: "cards", label: "Card view", Icon: LayoutGrid },
    { value: "list", label: "List view", Icon: List },
  ];
  return (
    <div role="group" aria-label="View" className={cn("inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border bg-muted/60 p-0.5", className)} data-view-toggle>
      {options.map(({ value, label, Icon }) => {
        const active = view === value;
        // Full navigation on purpose: in-place client transitions can stall on the prod build.
        return (
          <a
            key={value}
            href={hrefs[value]}
            role="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => remember(page, value)}
            onKeyDown={(event) => {
              // role="button" promises Space activation too.
              if (event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{value === "cards" ? "Cards" : "List"}</span>
          </a>
        );
      })}
    </div>
  );
}
