/**
 * Marketing surface images (home/auth/PageHero) — not used as runtime fallbacks
 * for center covers or galleries. Center media comes only from Tenant fields in the DB.
 */

export type MarketingImage = { url: string; caption: string; position: string };

/** Shared pool for marketing page heroes only (not injected into center profiles). */
export const DEFAULT_CENTER_IMAGES: MarketingImage[] = [
  { url: "/marketing/defaults/01-reception.jpg", caption: "Reception and waiting area", position: "object-[center_40%]" },
  { url: "/marketing/defaults/02-lab.jpg", caption: "Pathology lab", position: "object-[center_42%]" },
  { url: "/marketing/defaults/03-phlebotomy.jpg", caption: "Blood draw / phlebotomy", position: "object-top" },
  { url: "/marketing/defaults/04-imaging.jpg", caption: "Imaging suite", position: "object-[center_40%]" },
  { url: "/marketing/defaults/05-home-collection.jpg", caption: "Home sample collection", position: "object-top" },
  { url: "/marketing/defaults/06-checkup.jpg", caption: "Full body checkup bay", position: "object-[center_45%]" },
  { url: "/marketing/defaults/07-clinic-exterior.jpg", caption: "Clinic entrance", position: "object-[center_38%]" },
  { url: "/marketing/defaults/08-consultation.jpg", caption: "Doctor consultation", position: "object-[center_35%]" },
  { url: "/marketing/defaults/09-reports.jpg", caption: "Reports on tablet", position: "object-[center_42%]" },
  { url: "/marketing/defaults/10-sample-kit.jpg", caption: "Sample collection kit", position: "object-[center_48%]" },
];

function byUrl(...urls: string[]): MarketingImage[] {
  return urls.map((url) => {
    const fromPool = DEFAULT_CENTER_IMAGES.find((item) => item.url === url);
    if (fromPool) return fromPool;
    return { url, caption: "", position: "object-[center_40%]" };
  });
}

/**
 * Context-related hero subsets per marketing surface.
 * Heroes rotate only within a related set — never the full unrelated pool.
 */
const HOME_HERO_RELATED = byUrl(
  "/marketing/defaults/02-lab.jpg",
  "/marketing/defaults/04-imaging.jpg",
  "/marketing/defaults/03-phlebotomy.jpg",
  "/marketing/defaults/06-checkup.jpg",
  "/marketing/defaults/01-reception.jpg",
);

const AUTH_HERO_RELATED = byUrl(
  "/marketing/defaults/07-clinic-exterior.jpg",
  "/marketing/defaults/01-reception.jpg",
  "/marketing/defaults/08-consultation.jpg",
  "/marketing/defaults/02-lab.jpg",
);

/** pageKey → related images (defaults + dedicated section photos where useful). */
const PAGE_HERO_RELATED: Record<string, MarketingImage[]> = {
  tests: byUrl(
    "/marketing/defaults/02-lab.jpg",
    "/marketing/defaults/03-phlebotomy.jpg",
    "/marketing/defaults/10-sample-kit.jpg",
    "/marketing/path-lab.jpg",
  ),
  imaging: byUrl(
    "/marketing/defaults/04-imaging.jpg",
    "/marketing/path-imaging.jpg",
  ),
  packages: byUrl(
    "/marketing/defaults/06-checkup.jpg",
    "/marketing/path-checkup.jpg",
  ),
  "home-collection": byUrl(
    "/marketing/defaults/05-home-collection.jpg",
    "/marketing/path-home.jpg",
    "/marketing/defaults/03-phlebotomy.jpg",
  ),
  centers: byUrl(
    "/marketing/defaults/07-clinic-exterior.jpg",
    "/marketing/defaults/01-reception.jpg",
    "/marketing/feature-center.jpg",
  ),
  "centers-compare": byUrl(
    "/marketing/defaults/07-clinic-exterior.jpg",
    "/marketing/feature-center.jpg",
    "/marketing/defaults/01-reception.jpg",
  ),
  about: byUrl(
    "/marketing/page-about.jpg",
    "/marketing/defaults/08-consultation.jpg",
    "/marketing/defaults/02-lab.jpg",
  ),
  contact: byUrl(
    "/marketing/page-contact.jpg",
    "/marketing/defaults/01-reception.jpg",
    "/marketing/defaults/07-clinic-exterior.jpg",
  ),
  faq: byUrl(
    "/marketing/page-faq.jpg",
    "/marketing/defaults/09-reports.jpg",
    "/marketing/defaults/08-consultation.jpg",
  ),
};

/** Stable 32-bit hash (SSR-safe). */
export function hashCenterKey(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function isRasterImage(url: string) {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

/** Pick one image from a related pool using a stable string seed (SSR-safe). */
export function poolImageFor(seed: string, pool: readonly MarketingImage[] = DEFAULT_CENTER_IMAGES) {
  const list = pool.length > 0 ? pool : DEFAULT_CENTER_IMAGES;
  const idx = hashCenterKey(seed) % list.length;
  return list[idx]!;
}

/** Calendar day in Asia/Kolkata so home/auth heroes stay stable across a request day. */
export function marketingDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Home marketing hero — rotates daily within lab/diagnostics-related images only. */
export function homeHeroImage(now = new Date()) {
  return poolImageFor(`home:${marketingDayKey(now)}`, HOME_HERO_RELATED);
}

/** Auth aside hero — daily rotation within clinic/trust-related images. */
export function authHeroImage(now = new Date()) {
  return poolImageFor(`auth:${marketingDayKey(now)}`, AUTH_HERO_RELATED);
}

/**
 * Directory / marketing PageHero strip — stable per page key, always from a
 * context-related subset (not injected into center cards or profiles).
 */
export function pageHeroImage(pageKey: string) {
  const related = PAGE_HERO_RELATED[pageKey] ?? HOME_HERO_RELATED;
  return poolImageFor(`page:${pageKey}`, related);
}

/**
 * Cover URL from Tenant.coverImageUrl only — never a marketing-pool fallback.
 * Returns null when the center has not uploaded a cover.
 */
export function centerCoverSrc(center: { coverImageUrl?: string | null }): string | null {
  const cover = center.coverImageUrl?.trim();
  return cover || null;
}

/** Crop hint for hero/gallery fills — photos need a higher subject bias than abstract SVGs. */
export function imageObjectPosition(url: string) {
  if (!isRasterImage(url)) return "object-center";
  const fromPool = DEFAULT_CENTER_IMAGES.find((item) => item.url === url);
  if (fromPool) return fromPool.position;
  if (
    url.includes("feature-home") ||
    url.includes("path-home") ||
    url.includes("home-collection") ||
    url.includes("phlebotomy")
  ) {
    return "object-top";
  }
  return "object-[center_40%]";
}

export type GalleryItem = { url: string; caption: string };

/**
 * Gallery photos from Tenant.galleryUrls only — no shared defaults pool.
 */
export function galleryItems(center: { name: string; galleryUrls?: string[] | null }): {
  items: GalleryItem[];
} {
  const urls = (center.galleryUrls ?? []).map((url) => url.trim()).filter(Boolean);
  return {
    items: urls.map((url) => ({
      url,
      caption: center.name,
    })),
  };
}
