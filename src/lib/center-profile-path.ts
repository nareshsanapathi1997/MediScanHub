const RESERVED = new Set(["compare"]);

/** Slug for a single center profile at `/centers/[slug]`, not list or compare. */
export function centerProfileSlugFromPath(pathname: string): string | null {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "centers") return null;
  const slug = segments[1];
  if (!slug || RESERVED.has(slug)) return null;
  return slug;
}

export function isCenterProfilePath(pathname: string): boolean {
  return centerProfileSlugFromPath(pathname) !== null;
}
