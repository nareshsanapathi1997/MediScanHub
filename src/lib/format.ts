/** Rupees with Indian digit grouping: ₹1,23,456 (paise shown only when present, e.g. ₹499.50). */
export function formatInr(paise: number) {
  const whole = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(paise / 100);
}

function istParts(value: Date | string, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...options }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
}

/** 16 Oct 2026 */
export function formatDate(value: Date | string) {
  const p = istParts(value, { day: "2-digit", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}`;
}

/** 9:30 am */
export function formatTime(value: Date | string) {
  const p = istParts(value, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toLowerCase()}`.trim();
}

/** 16 Oct 2026, 9:30 am IST */
export function formatWhen(value: Date | string) {
  return `${formatDate(value)}, ${formatTime(value)} IST`;
}

/** +91 98765 43210 for Indian mobile numbers; anything else is returned as typed. */
export function formatPhone(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : value;
}

/** 1.2 MB, 340 KB */
export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Start of the India (IST) calendar day containing `at`, as a UTC instant. Independent of the server's own time zone. */
export function istDayStart(at: Date = new Date(), offsetDays = 0) {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + offsetDays);
  return new Date(midnight - IST_OFFSET_MS);
}

export function istDayKey(at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
