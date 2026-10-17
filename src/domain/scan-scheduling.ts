import { DomainError } from "@/lib/errors";

/** Scan types that need a machine slot. Each one is booked against a specific room, not a general center slot. */
export const SCAN_MODALITIES = {
  XR: "X-ray",
  CT: "CT scan",
  MR: "MRI",
  US: "Ultrasound",
} as const;

export type ScanModality = keyof typeof SCAN_MODALITIES;

export function isScanModality(value: string | null | undefined): value is ScanModality {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(SCAN_MODALITIES, value!);
}

export function modalityLabel(value: string | null | undefined) {
  return isScanModality(value) ? SCAN_MODALITIES[value] : value || "Scan";
}

/**
 * The machine type a booking needs, or null when it has no scan.
 * One booking can hold one scan type, because each scan type runs in its own room.
 */
export function scanModalityFor(services: { kind: string; modality?: string | null }[]): ScanModality | null {
  const found = new Set<ScanModality>();
  for (const service of services) {
    if (service.kind === "IMAGING" && isScanModality(service.modality)) found.add(service.modality);
  }
  if (found.size > 1) {
    throw new DomainError("SCAN_MIX", "Book each scan type separately. An X-ray, CT, MRI and ultrasound each use a different room.", 400);
  }
  return found.size ? [...found][0]! : null;
}

export const SLOT_MINUTES_RANGE = { min: 5, max: 120 } as const;
export const SLOT_CAPACITY_RANGE = { min: 1, max: 10 } as const;
export const MAX_SLOTS_PER_RUN = 60;

export type PlannedSlot = { startsAt: Date; endsAt: Date };

function istDate(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) throw new DomainError("DATE", "Enter a valid date and time", 400);
  const value = new Date(`${day}T${time}:00+05:30`);
  if (Number.isNaN(value.getTime())) throw new DomainError("DATE", "Enter a valid date and time", 400);
  return value;
}

/** Split an IST time range into back-to-back slots of `minutes`. A last slot that would run past `to` is dropped. */
export function planScanSlots(input: { day: string; from: string; to: string; minutes: number; capacity: number }): PlannedSlot[] {
  const minutes = Math.trunc(input.minutes);
  const capacity = Math.trunc(input.capacity);
  if (!(minutes >= SLOT_MINUTES_RANGE.min && minutes <= SLOT_MINUTES_RANGE.max)) {
    throw new DomainError("SLOT", `Slot length must be ${SLOT_MINUTES_RANGE.min} to ${SLOT_MINUTES_RANGE.max} minutes`, 400);
  }
  if (!(capacity >= SLOT_CAPACITY_RANGE.min && capacity <= SLOT_CAPACITY_RANGE.max)) {
    throw new DomainError("SLOT", `Patients per slot must be ${SLOT_CAPACITY_RANGE.min} to ${SLOT_CAPACITY_RANGE.max}`, 400);
  }
  const start = istDate(input.day, input.from);
  const end = istDate(input.day, input.to);
  if (end <= start) throw new DomainError("SLOT", "The end time must be after the start time", 400);
  const slots: PlannedSlot[] = [];
  for (let at = start.getTime(); at + minutes * 60_000 <= end.getTime(); at += minutes * 60_000) {
    slots.push({ startsAt: new Date(at), endsAt: new Date(at + minutes * 60_000) });
  }
  if (slots.length === 0) throw new DomainError("SLOT", "The time range is shorter than one slot", 400);
  if (slots.length > MAX_SLOTS_PER_RUN) throw new DomainError("SLOT", `That makes ${slots.length} slots. Create at most ${MAX_SLOTS_PER_RUN} at a time.`, 400);
  return slots;
}

export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** True when every slot lies inside at least one technician shift. */
export function coveredByShifts(slots: PlannedSlot[], shifts: { startsAt: Date; endsAt: Date }[]) {
  return slots.every((slot) => shifts.some((shift) => shift.startsAt <= slot.startsAt && shift.endsAt >= slot.endsAt));
}
