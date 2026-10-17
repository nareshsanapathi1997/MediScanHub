import { cookies } from "next/headers";

export type ViewMode = "cards" | "list";
export const VIEW_COOKIE_PREFIX = "ms_view_";

function parse(value: unknown): ViewMode | undefined {
  return value === "cards" || value === "list" ? value : undefined;
}

/**
 * The listing view for a page: the ?view= URL param wins, then the remembered cookie, then the default.
 * Read on the server so the first paint already has the right layout (no flash or layout shift).
 */
export async function resolveView(page: string, param?: string | string[], fallback: ViewMode = "cards"): Promise<ViewMode> {
  const fromUrl = parse(Array.isArray(param) ? param[0] : param);
  if (fromUrl) return fromUrl;
  const jar = await cookies();
  return parse(jar.get(`${VIEW_COOKIE_PREFIX}${page}`)?.value) ?? fallback;
}

/** Hrefs for both views, keeping the page's other query params. */
export function viewHrefs(pathname: string, params: Record<string, string | string[] | undefined>) {
  const build = (view: ViewMode) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "view" || value === undefined) continue;
      for (const item of [value].flat()) if (item) query.append(key, item);
    }
    query.set("view", view);
    return `${pathname}?${query}`;
  };
  return { cards: build("cards"), list: build("list") };
}
