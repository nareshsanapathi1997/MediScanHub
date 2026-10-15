import type { getCenterBySlug } from "@/lib/services/catalog";

export type CenterProfile = NonNullable<Awaited<ReturnType<typeof getCenterBySlug>>>;
export type CenterBranch = CenterProfile["branches"][number];
export type CenterService = CenterProfile["services"][number];
export type CenterPackage = CenterProfile["packages"][number];

export type VisitMode = "CENTER_VISIT" | "HOME_COLLECTION";

/** Everything the profile keeps in the URL, so every state stays deep-linkable. */
export type ProfileState = {
  slug: string;
  services: string[];
  packages: string[];
  branchId: string;
  day: string;
  visit: VisitMode;
  kind?: "LAB" | "IMAGING";
};

export function splitIds(value?: string) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

/** Build a profile URL from the current state plus overrides, optionally with a #hash. */
export function profileHref(state: ProfileState, overrides: Partial<ProfileState> = {}, hash?: string) {
  const next = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (next.services.length) params.set("service", next.services.join(","));
  if (next.packages.length) params.set("package", next.packages.join(","));
  if (next.branchId) params.set("branch", next.branchId);
  if (next.day) params.set("day", next.day);
  if (next.visit === "HOME_COLLECTION") params.set("visit", next.visit);
  if (next.kind) params.set("kind", next.kind);
  const query = params.toString();
  return `/centers/${next.slug}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function mapsUrl(input: { address: string; city: string; state?: string; latitude?: number | null; longitude?: number | null }) {
  const query = input.latitude != null && input.longitude != null
    ? `${input.latitude},${input.longitude}`
    : [input.address, input.city, input.state].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Append city/state only when the stored address doesn't already mention them. */
export function fullAddress(input: { address: string; city: string; state: string }) {
  const lower = input.address.toLowerCase();
  return [input.address, ...[input.city, input.state].filter((part) => !lower.includes(part.toLowerCase()))].join(", ");
}

export function formatClock(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (hours === undefined || Number.isNaN(hours)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, "0")} ${suffix}`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

/** Brand colours are tenant-supplied; only accept plain hex values before using them in inline styles. */
export function safeColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function tatLabel(hours: number) {
  if (hours <= 0) return "Same day";
  if (hours < 24) return `${hours}h report`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} report`;
}

export function servicePrice(service: CenterService, branchId?: string) {
  const price = service.prices.find((item) => item.branchId === branchId) ?? service.prices[0];
  if (!price) return null;
  return { final: price.pricePaise - price.discountPaise, original: price.pricePaise, discounted: price.discountPaise > 0 };
}

export function summarize(text: string, max = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max).trimEnd()}…`;
}

const IST_HOUR = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" });

export function slotPeriod(startsAt: Date | string): "Morning" | "Afternoon" | "Evening" {
  const hour = Number(IST_HOUR.format(new Date(startsAt))) % 24;
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function shiftDay(day: string, offset: number) {
  // Noon IST keeps the UTC calendar date identical to the IST one.
  const base = new Date(`${day}T12:00:00.000+05:30`);
  return new Date(base.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}

export function validDay(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00.000+05:30`).getTime()) ? value : fallback;
}

export function todayIst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function bookingTotal(center: CenterProfile, state: ProfileState) {
  const services = center.services.filter((service) => state.services.includes(service.id));
  const packages = center.packages.filter((pkg) => state.packages.includes(pkg.id));
  const total =
    services.reduce((sum, service) => sum + (servicePrice(service, state.branchId)?.final ?? 0), 0) +
    packages.reduce((sum, pkg) => sum + pkg.pricePaise, 0);
  return { services, packages, total, count: services.length + packages.length };
}
