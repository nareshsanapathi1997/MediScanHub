/** Server-side paging helpers. Pure functions, so they are unit tested in tests/pagination.test.ts. */

export type SearchParams = Record<string, string | string[] | undefined>;
export type PageArgs = { page: number; pageSize: number; skip: number; take: number };
export type Paged<T> = { items: T[]; total: number };

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads ?page= (1-based) and an optional ?size= from the URL. Bad values fall back to page 1 and the default size. */
export function parsePage(params: SearchParams, pageSize = DEFAULT_PAGE_SIZE, key = "page"): PageArgs {
  const rawPage = Number.parseInt(first(params[key]) ?? "", 10);
  const rawSize = Number.parseInt(first(params.size) ?? "", 10);
  const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, MAX_PAGE_SIZE) : pageSize;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100_000) : 1;
  return { page, pageSize: size, skip: (page - 1) * size, take: size };
}

/** Clamps the requested page into range once the total is known, so ?page=99 shows the last page. */
export function clampPage(args: PageArgs, total: number): PageArgs {
  const pages = pageCount(total, args.pageSize);
  if (args.page <= pages) return args;
  return { ...args, page: pages, skip: (pages - 1) * args.pageSize };
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** "Showing 1–12 of 57". Returns the 1-based first and last item numbers on this page. */
export function pageRange(total: number, page: number, pageSize: number) {
  if (total <= 0) return { from: 0, to: 0 };
  const from = Math.min((page - 1) * pageSize + 1, total);
  return { from, to: Math.min(page * pageSize, total) };
}

export function showingText(total: number, page: number, pageSize: number, noun = "results") {
  const { from, to } = pageRange(total, page, pageSize);
  if (total === 0) return `No ${noun}`;
  return `Showing ${from}–${to} of ${total.toLocaleString("en-IN")} ${noun}`;
}

/**
 * Page numbers to show, with "gap" for an ellipsis. Always shows the first and last page and
 * `siblings` pages on each side of the current one, e.g. 1 … 4 5 6 … 20.
 */
export function pageItems(current: number, pages: number, siblings = 1): (number | "gap")[] {
  if (pages <= 1) return [1];
  const window = siblings * 2 + 5;
  if (pages <= window) return Array.from({ length: pages }, (_, index) => index + 1);
  const page = Math.min(Math.max(current, 1), pages);
  let start = Math.max(2, page - siblings);
  let end = Math.min(pages - 1, page + siblings);
  // Keep the number of slots steady near the edges so the control does not jump in width.
  if (page - siblings <= 3) { start = 2; end = 3 + siblings * 2; }
  if (page + siblings >= pages - 2) { start = pages - 2 - siblings * 2; end = pages - 1; }
  const items: (number | "gap")[] = [1];
  if (start > 2) items.push("gap");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pages - 1) items.push("gap");
  items.push(pages);
  return items;
}

/** Link to another page of the same listing, keeping every other query param. Page 1 drops the param. */
export function pageHref(pathname: string, params: SearchParams, page: number, key = "page", hash = "") {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === key || value === undefined) continue;
    for (const item of [value].flat()) if (item) query.append(name, item);
  }
  if (page > 1) query.set(key, String(page));
  const text = query.toString();
  return `${pathname}${text ? `?${text}` : ""}${hash}`;
}

/** Pages an in-memory list (for lists that are built or filtered after the query). */
export function slicePage<T>(rows: T[], args: PageArgs): Paged<T> & { args: PageArgs } {
  const clamped = clampPage(args, rows.length);
  return { items: rows.slice(clamped.skip, clamped.skip + clamped.take), total: rows.length, args: clamped };
}

/**
 * Loads one page with `load` (skip/take + count). When ?page= is past the end, loads the
 * last page instead, so a stale link never shows an empty list.
 */
export async function fetchPage<R extends Paged<unknown>>(args: PageArgs, load: (args: PageArgs) => Promise<R>): Promise<R & { args: PageArgs }> {
  const first = await load(args);
  if (first.items.length > 0 || first.total === 0 || args.page === 1) return { ...first, args };
  const clamped = clampPage(args, first.total);
  return { ...(await load(clamped)), args: clamped };
}

/** What a service needs to load one page. */
export type Paging = { skip: number; take: number };
