import { describe, expect, it } from "vitest";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { prismaPrivileged } from "@/lib/db";
import { createBooking, rescheduleBooking } from "@/lib/services/booking";
import { createSlots } from "@/lib/services/catalog";
import { addMaintenanceBlock, addTechnicianShift, createScanSlots, listScanRooms, listScanSlots, removeScanSlot, saveScanRoom, setScanRoomActive } from "@/lib/services/scan-rooms";
import { coveredByShifts, planScanSlots, scanModalityFor } from "@/domain/scan-scheduling";
import { permissionForReportTransition } from "@/domain/state";
import { ROLE_PERMISSIONS } from "@/domain/permissions";

const actor = (userId: string, tenantId: string | null) => loadActor(userId, tenantId, null);
const CT_BRAIN = "80000000-0000-4000-8000-000000000012";
const MRI_KNEE = "80000000-0000-4000-8000-000000000013";
const XRAY = "80000000-0000-4000-8000-000000000011";
const key = (tag: string) => `${tag}-${Date.now()}-${Math.random()}`;

function istDay(offset: number) {
  return new Date(Date.now() + 5.5 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
}

async function room(modality: string, branchId: string = ID.jubilee) {
  return prismaPrivileged.equipment.findFirstOrThrow({ where: { tenantId: ID.apex, branchId, modality } });
}

/** Free scan slots on one machine, skipping any inside a maintenance block. */
async function freeSlots(equipmentId: string, n = 1) {
  const blocks = await prismaPrivileged.equipmentBlock.findMany({ where: { equipmentId } });
  const slots = await prismaPrivileged.availabilitySlot.findMany({ where: { equipmentId, startsAt: { gt: new Date(Date.now() + 3600_000) }, bookedCount: 0 }, orderBy: { startsAt: "desc" } });
  const free = slots.filter((slot) => !blocks.some((block) => block.startsAt < slot.endsAt && block.endsAt > slot.startsAt));
  if (free.length < n) throw new Error("Seed did not leave enough free scan slots");
  return free.slice(0, n);
}

async function centerSlot() {
  return prismaPrivileged.availabilitySlot.findFirstOrThrow({ where: { branchId: ID.jubilee, kind: "CENTER", startsAt: { gt: new Date() }, id: { not: ID.slotRace } }, orderBy: { startsAt: "desc" } });
}

describe("scan scheduling rules", () => {
  it("knows which machine a booking needs and splits a shift into slots", () => {
    expect(scanModalityFor([{ kind: "LAB" }, { kind: "IMAGING", modality: "CT" }])).toBe("CT");
    expect(scanModalityFor([{ kind: "LAB" }])).toBeNull();
    expect(() => scanModalityFor([{ kind: "IMAGING", modality: "CT" }, { kind: "IMAGING", modality: "MR" }])).toThrow(/separately/);
    const slots = planScanSlots({ day: "2026-11-02", from: "14:00", to: "15:00", minutes: 20, capacity: 1 });
    expect(slots).toHaveLength(3);
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-11-02T08:30:00.000Z");
    expect(planScanSlots({ day: "2026-11-02", from: "14:00", to: "15:10", minutes: 40, capacity: 1 })).toHaveLength(1);
    expect(() => planScanSlots({ day: "2026-11-02", from: "14:00", to: "15:00", minutes: 2, capacity: 1 })).toThrow();
    expect(() => planScanSlots({ day: "2026-11-02", from: "14:00", to: "13:00", minutes: 20, capacity: 1 })).toThrow();
    expect(() => planScanSlots({ day: "2026-11-02", from: "14:00", to: "15:00", minutes: 20, capacity: 0 })).toThrow();
    expect(coveredByShifts(slots, [{ startsAt: slots[0]!.startsAt, endsAt: slots[2]!.endsAt }])).toBe(true);
    expect(coveredByShifts(slots, [{ startsAt: slots[1]!.startsAt, endsAt: slots[2]!.endsAt }])).toBe(false);
  });

  it("lets radiology submit an imaging-only report (it was stuck in draft before)", () => {
    expect(ROLE_PERMISSIONS.RADIOLOGY).toContain(permissionForReportTransition("ENTERED", true));
    expect(ROLE_PERMISSIONS.RADIOLOGY).not.toContain(permissionForReportTransition("ENTERED", false));
  });
});

describe("booking X-ray, CT and MRI against machine slots", () => {
  it("refuses general, home or wrong-machine slots and accepts the right scan slot", async () => {
    const asha = await actor(ID.asha, null);
    const base = { branchId: ID.jubilee, serviceIds: [CT_BRAIN], packageIds: [], visitType: "CENTER_VISIT" as const };
    const general = await centerSlot();
    await expect(createBooking(asha, { ...base, slotId: general.id, idempotencyKey: key("ct-general") })).rejects.toMatchObject({ status: 400, code: "SLOT_TYPE" });
    const [mri] = await freeSlots((await room("MR")).id);
    await expect(createBooking(asha, { ...base, slotId: mri!.id, idempotencyKey: key("ct-mri") })).rejects.toMatchObject({ status: 400, code: "SLOT_TYPE" });
    const [ct] = await freeSlots((await room("CT")).id);
    await expect(createBooking(asha, { ...base, visitType: "HOME_COLLECTION", address: "Flat 3, Banjara Hills", slotId: ct!.id, idempotencyKey: key("ct-home") })).rejects.toMatchObject({ status: 400, code: "VISIT" });
    await expect(createBooking(asha, { ...base, serviceIds: [CT_BRAIN, MRI_KNEE], slotId: ct!.id, idempotencyKey: key("ct-mix") })).rejects.toMatchObject({ status: 400, code: "SCAN_MIX" });
    const created = await createBooking(asha, { ...base, serviceIds: [CT_BRAIN, ID.cbc], slotId: ct!.id, idempotencyKey: key("ct-ok") });
    const booking = await prismaPrivileged.booking.findUniqueOrThrow({ where: { id: created.bookingId } });
    expect(booking.slotId).toBe(ct!.id);
    expect(booking.scheduledAt.toISOString()).toBe(ct!.startsAt.toISOString());
    expect((await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: ct!.id } })).bookedCount).toBe(1);
    // Nothing was held by the refused attempts.
    expect((await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: general.id } })).bookedCount).toBe(general.bookedCount);
    expect((await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: mri!.id } })).bookedCount).toBe(0);
  });

  it("gives the last place in a scan slot to exactly one of two racing patients", async () => {
    const [slot] = await freeSlots((await room("MR")).id);
    const [ravi, meera] = await Promise.all([actor(ID.ravi, null), actor(ID.meera, null)]);
    const input = { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [MRI_KNEE], packageIds: [], visitType: "CENTER_VISIT" as const };
    const results = await Promise.allSettled([
      createBooking(ravi, { ...input, idempotencyKey: key("mr-race-a") }),
      createBooking(meera, { ...input, idempotencyKey: key("mr-race-b") }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409, code: "SLOT_FULL" });
    expect((await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: slot!.id } })).bookedCount).toBe(1);
  });

  it("hides and refuses slots during maintenance or when the machine is out of use", async () => {
    const xr = await room("XR");
    const [slot] = await freeSlots(xr.id);
    const radio = await actor(ID.radioApex, ID.apex);
    const day = new Date(slot!.startsAt.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
    expect((await listScanSlots(ID.jubilee, day, "XR")).map((row) => row.id)).toContain(slot!.id);
    const { block, affectedBookings } = await addMaintenanceBlock(radio, { equipmentId: xr.id, startsAt: slot!.startsAt, endsAt: slot!.endsAt, reason: "Detector calibration" });
    expect(affectedBookings).toBe(0);
    expect((await listScanSlots(ID.jubilee, day, "XR")).map((row) => row.id)).not.toContain(slot!.id);
    const asha = await actor(ID.asha, null);
    await expect(createBooking(asha, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [XRAY], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: key("xr-block") })).rejects.toMatchObject({ status: 409 });
    await prismaPrivileged.equipmentBlock.delete({ where: { id: block.id } });

    await setScanRoomActive(radio, xr.id, false);
    expect(await listScanSlots(ID.jubilee, day, "XR")).toHaveLength(0);
    await expect(createBooking(asha, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [XRAY], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: key("xr-off") })).rejects.toMatchObject({ status: 409 });
    await setScanRoomActive(radio, xr.id, true);
    const ok = await createBooking(asha, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [XRAY], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: key("xr-on") });
    expect(ok.bookingId).toBeTruthy();
    // A later block over a booked slot reports the patient so staff can call them.
    const again = await addMaintenanceBlock(radio, { equipmentId: xr.id, startsAt: slot!.startsAt, endsAt: slot!.endsAt, reason: "Breakdown" });
    expect(again.affectedBookings).toBe(1);
    await prismaPrivileged.equipmentBlock.delete({ where: { id: again.block.id } });
  });

  it("moves a scan booking only to another slot of the same scan type", async () => {
    const ct = await room("CT");
    const [first, second] = await freeSlots(ct.id, 2);
    const meera = await actor(ID.meera, null);
    const created = await createBooking(meera, { branchId: ID.jubilee, slotId: first!.id, serviceIds: [CT_BRAIN], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: key("ct-move") });
    await expect(rescheduleBooking(meera, created.bookingId, (await centerSlot()).id)).rejects.toMatchObject({ status: 400, code: "SLOT_TYPE" });
    await rescheduleBooking(meera, created.bookingId, second!.id);
    const [a, b] = await Promise.all([first, second].map((slot) => prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: slot!.id } })));
    expect([a!.bookedCount, b!.bookedCount]).toEqual([0, 1]);
  });
});

describe("staff managing scan rooms", () => {
  it("needs a technician shift, refuses overlaps and maintenance, and keeps booked slots", async () => {
    const radio = await actor(ID.radioApex, ID.apex);
    const created = await saveScanRoom(radio, { branchId: ID.jubilee, name: "Portable X-ray", modality: "XR", room: "Ward block", slotMinutes: 15 });
    const day = istDay(10);
    await expect(createScanSlots(radio, { equipmentId: created.id, day, from: "09:00", to: "10:00", capacity: 1 })).rejects.toMatchObject({ code: "NO_TECHNICIAN" });
    await addTechnicianShift(radio, { equipmentId: created.id, staffUserId: ID.radio3Apex, startsAt: new Date(`${day}T08:00:00+05:30`), endsAt: new Date(`${day}T12:00:00+05:30`) });
    await expect(addTechnicianShift(radio, { equipmentId: created.id, staffUserId: ID.radio3Apex, startsAt: new Date(`${day}T11:00:00+05:30`), endsAt: new Date(`${day}T13:00:00+05:30`) })).rejects.toMatchObject({ code: "SHIFT_CLASH" });
    await expect(addTechnicianShift(radio, { equipmentId: created.id, staffUserId: ID.deskApex, startsAt: new Date(`${day}T13:00:00+05:30`), endsAt: new Date(`${day}T14:00:00+05:30`) })).rejects.toMatchObject({ code: "STAFF" });
    expect(await createScanSlots(radio, { equipmentId: created.id, day, from: "09:00", to: "10:00", capacity: 2 })).toEqual({ count: 4 });
    await expect(createScanSlots(radio, { equipmentId: created.id, day, from: "09:30", to: "10:30", capacity: 1 })).rejects.toMatchObject({ code: "SLOT_CLASH" });
    await addMaintenanceBlock(radio, { equipmentId: created.id, startsAt: new Date(`${day}T10:30:00+05:30`), endsAt: new Date(`${day}T11:00:00+05:30`), reason: "Battery swap" });
    await expect(createScanSlots(radio, { equipmentId: created.id, day, from: "10:15", to: "11:00", capacity: 1 })).rejects.toMatchObject({ code: "MAINTENANCE" });
    const slots = await prismaPrivileged.availabilitySlot.findMany({ where: { equipmentId: created.id }, orderBy: { startsAt: "asc" } });
    expect(slots.every((slot) => slot.kind === "IMAGING" && slot.capacity === 2 && slot.endsAt.getTime() - slot.startsAt.getTime() === 15 * 60_000)).toBe(true);
    await prismaPrivileged.availabilitySlot.update({ where: { id: slots[0]!.id }, data: { bookedCount: 1 } });
    await expect(removeScanSlot(radio, slots[0]!.id)).rejects.toMatchObject({ status: 409, code: "SLOT_BOOKED" });
    await removeScanSlot(radio, slots[1]!.id);
    const listed = await listScanRooms(radio, 14);
    expect(listed.find((item) => item.id === created.id)?.slots).toHaveLength(3);
  });

  it("keeps scan rooms to the right roles, branches and center", async () => {
    const ct = await room("CT");
    const input = { equipmentId: ct.id, day: istDay(11), from: "09:00", to: "10:00", capacity: 1 };
    await expect(createScanSlots(await actor(ID.deskApex, ID.apex), input)).rejects.toMatchObject({ status: 403 });
    await expect(listScanRooms(await actor(ID.accountsApex, ID.apex))).rejects.toMatchObject({ status: 403 });
    // Suresh works at Gachibowli only.
    await expect(createScanSlots(await actor(ID.radio2Apex, ID.apex), input)).rejects.toMatchObject({ status: 403 });
    const own = await listScanRooms(await actor(ID.radio2Apex, ID.apex));
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((item) => item.branchId === ID.gachibowli)).toBe(true);
    await expect(createScanSlots(await actor(ID.ownerNimbus, ID.nimbus), input)).rejects.toMatchObject({ status: 404 });
    await expect(setScanRoomActive(await actor(ID.ownerNimbus, ID.nimbus), ct.id, false)).rejects.toMatchObject({ status: 404 });
    await expect(createSlots(await actor(ID.ownerApex, ID.apex), { branchId: ID.jubilee, kind: "IMAGING", date: istDay(12), times: ["09:00"], capacity: 1 })).rejects.toMatchObject({ status: 400 });
  });
});
