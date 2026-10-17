import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageCount, pageHref, pageItems, showingText, type SearchParams } from "@/lib/pagination";

/**
 * Server-rendered pager for card and list views. Uses plain links (full page loads) on purpose:
 * in-place client navigation can stall on the production build.
 */
export function Pagination({
  pathname,
  params,
  page,
  pageSize,
  total,
  noun = "results",
  pageKey = "page",
  hash = "",
  label = "Pages",
  className,
}: {
  pathname: string;
  params: SearchParams;
  page: number;
  pageSize: number;
  total: number;
  noun?: string;
  pageKey?: string;
  hash?: string;
  label?: string;
  className?: string;
}) {
  const pages = pageCount(total, pageSize);
  const href = (value: number) => pageHref(pathname, params, value, pageKey, hash);
  const base = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  const idle = "text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row", className)} data-pagination>
      <p className="text-sm text-muted-foreground" aria-live="polite">{showingText(total, page, pageSize, noun)}</p>
      {pages > 1 ? (
        <nav aria-label={label} className="flex items-center gap-1">
          {page > 1 ? (
            <a href={href(page - 1)} rel="prev" className={cn(base, idle, "gap-1 pr-3")} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden /><span className="hidden sm:inline">Previous</span></a>
          ) : (
            <span className={cn(base, "gap-1 pr-3 text-muted-foreground/50")} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden /><span className="hidden sm:inline">Previous</span></span>
          )}
          {/* Phones: a compact "3 / 9" instead of every number. */}
          <span className="px-2 text-sm tabular-nums text-muted-foreground sm:hidden">Page {page} of {pages}</span>
          <ol className="hidden items-center gap-1 sm:flex">
            {pageItems(page, pages).map((item, index) => (
              <li key={item === "gap" ? `gap-${index}` : item}>
                {item === "gap" ? (
                  <span className="inline-flex h-9 w-6 items-center justify-center text-muted-foreground" aria-hidden>…</span>
                ) : item === page ? (
                  <span className={cn(base, "bg-primary text-primary-foreground shadow-sm")} aria-current="page">{item}</span>
                ) : (
                  <a href={href(item)} className={cn(base, idle)} aria-label={`Page ${item}`}>{item}</a>
                )}
              </li>
            ))}
          </ol>
          {page < pages ? (
            <a href={href(page + 1)} rel="next" className={cn(base, idle, "gap-1 pl-3")} aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" aria-hidden /></a>
          ) : (
            <span className={cn(base, "gap-1 pl-3 text-muted-foreground/50")} aria-disabled="true"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" aria-hidden /></span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
