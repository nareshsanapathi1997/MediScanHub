import { describe, expect, it } from "vitest";
import { databaseEnforcesRls } from "./rls-mode";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { createBooking, getBooking, quoteBooking, transitionBooking } from "@/lib/services/booking";
import { createBranch } from "@/lib/services/catalog";
import { createPaymentOrder, handlePaymentWebhook } from "@/lib/services/billing";
import { readReportPdf } from "@/lib/services/lab";
import { assertBranchAccess } from "@/domain/actor";
import { DomainError } from "@/lib/errors";
import { prisma, prismaPrivileged } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { mockWebhookSignature } from "@/lib/adapters/payment";
import { decideTenant, listTenantsAdmin, listUsersAdmin, notificationHealth, platformOverview } from "@/lib/services/admin";
import { registerCenter } from "@/lib/services/auth";

async function actor(userId: string, tenantId: string | null) {
  return loadActor(userId, tenantId, null);
}

async function freeSlot() {
  const slots = await prismaPrivileged.availabilitySlot.findMany({
    where: { branchId: ID.jubilee, kind: "CENTER", startsAt: { gt: new Date() }, id: { not: ID.slotRace } },
    orderBy: { startsAt: "asc" },
  });
  const slot = slots.find((item) => item.bookedCount < item.capacity);
  if (!slot) throw new Error("Seed did not leave an open center slot");
  return slot;
}

describe("tenant isolation and booking integrity", () => {
  it("blocks cross-tenant reads in the app role and with no tenant", async () => {
    if (!(await databaseEnforcesRls())) {
      const visible = await prismaPrivileged.booking.count({ where: { id: ID.bookingAsha } });
      expect(visible).toBe(1);
      return;
    }
    const hidden = await withScope({ tenantId: ID.nimbus, userId: ID.ownerNimbus }, (tx) => tx.booking.findMany());
    expect(hidden.every((row) => row.tenantId === ID.nimbus)).toBe(true);
    expect(hidden.some((row) => row.id === ID.bookingAsha)).toBe(false);
    const closed = await withScope({}, (tx) => tx.booking.findMany());
    expect(closed).toHaveLength(0);
    const visible = await prismaPrivileged.booking.count({ where: { id: ID.bookingAsha } });
    expect(visible).toBe(1);
    const appCount = await prisma.booking.count();
    expect(appCount).toBe(0);
  });

  it("returns not found for another center, another patient, and a non-referral", async () => {
    const nimbus = await actor(ID.ownerNimbus, ID.nimbus);
    const ravi = await actor(ID.ravi, null);
    const doctor = await actor(ID.doctor, ID.apex);
    await expect(getBooking(nimbus, ID.bookingAsha)).rejects.toMatchObject({ status: 404 });
    await expect(getBooking(ravi, ID.bookingAsha)).rejects.toMatchObject({ status: 404 });
    const referred = await getBooking(doctor, ID.bookingAsha);
    expect(referred.publicCode).toBe("MS-ASHA01");
    await expect(getBooking(doctor, ID.bookingMeera)).rejects.toMatchObject({ status: 404 });
  });

  it("limits a branch manager to assigned branches", async () => {
    const manager = await actor(ID.managerApex, ID.apex);
    expect(() => assertBranchAccess(manager, ID.apex, ID.gachibowli)).toThrow(DomainError);
    expect(() => assertBranchAccess(manager, ID.apex, ID.jubilee)).not.toThrow();
  });

  it("prices on the server and rejects a reused idempotency key", async () => {
    const asha = await actor(ID.asha, null);
    const slot = await freeSlot();
    const quote = await quoteBooking({ branchId: ID.jubilee, serviceIds: [ID.tsh], packageIds: [] });
    const key = `price-${Date.now()}`;
    const created = await createBooking(asha, {
      branchId: ID.jubilee,
      slotId: slot.id,
      serviceIds: [ID.tsh],
      packageIds: [],
      visitType: "CENTER_VISIT",
      idempotencyKey: key,
    });
    expect(created.totalPaise).toBe(quote.total);
    const again = await createBooking(asha, {
      branchId: ID.jubilee,
      slotId: slot.id,
      serviceIds: [ID.tsh],
      packageIds: [],
      visitType: "CENTER_VISIT",
      idempotencyKey: key,
    });
    expect(again.bookingId).toBe(created.bookingId);
    await expect(createBooking(asha, {
      branchId: ID.jubilee,
      slotId: slot.id,
      serviceIds: [ID.cbc],
      packageIds: [],
      visitType: "CENTER_VISIT",
      idempotencyKey: key,
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("lets only one of two concurrent bookings take a capacity-1 slot", async () => {
    if (!(await databaseEnforcesRls())) return;
    const future = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await prismaPrivileged.availabilitySlot.update({
      where: { id: ID.slotRace },
      data: { bookedCount: 0, startsAt: future, endsAt: new Date(future.getTime() + 30 * 60 * 1000) },
    });
    const asha = await actor(ID.asha, null);
    const meera = await actor(ID.meera, null);
    const input = {
      branchId: ID.jubilee,
      slotId: ID.slotRace,
      serviceIds: [ID.cbc],
      packageIds: [] as string[],
      visitType: "CENTER_VISIT" as const,
    };
    const stamp = Date.now();
    const results = await Promise.allSettled([
      createBooking(asha, { ...input, idempotencyKey: `race-a-${stamp}` }),
      createBooking(meera, { ...input, idempotencyKey: `race-b-${stamp}` }),
    ]);
    const ok = results.filter((result) => result.status === "fulfilled");
    const denied = results.filter((result) => result.status === "rejected");
    if (ok.length !== 1) {
      const detail = results.map((result) =>
        result.status === "rejected" ? (result.reason as DomainError)?.code ?? result.reason : "ok",
      );
      throw new Error(`Expected one booking to win the race slot; got ${detail.join(", ")}`);
    }
    expect(denied).toHaveLength(1);
  });

  it("releases a slot when a pending visit is cancelled", async () => {
    const asha = await actor(ID.asha, null);
    const slot = await freeSlot();
    const before = slot.bookedCount;
    const created = await createBooking(asha, {
      branchId: ID.jubilee,
      slotId: slot.id,
      serviceIds: [ID.hba1c],
      packageIds: [],
      visitType: "CENTER_VISIT",
      idempotencyKey: `cancel-${Date.now()}`,
    });
    await transitionBooking(asha, created.bookingId, "CANCELLED", "Synthetic change of plan");
    const after = await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(after.bookedCount).toBe(before);
  });

  it("verifies a webhook once and ignores the duplicate", async () => {
    const ravi = await actor(ID.ravi, null);
    const slot = await freeSlot();
    const created = await createBooking(ravi, {
      branchId: ID.jubilee,
      slotId: slot.id,
      serviceIds: [ID.lipid],
      packageIds: [],
      visitType: "CENTER_VISIT",
      idempotencyKey: `pay-${Date.now()}`,
    });
    const order = await createPaymentOrder(ravi, created.bookingId, `order-${Date.now()}`);
    const payload = JSON.stringify({
      id: `evt_${created.bookingId}`,
      event: "payment.captured",
      payload: { payment: { entity: { id: `pay_${created.bookingId}`, order_id: order.orderId, amount: created.totalPaise } } },
    });
    const signature = mockWebhookSignature(payload);
    const first = await handlePaymentWebhook(payload, signature);
    const second = await handlePaymentWebhook(payload, signature);
    expect(first).toMatchObject({ duplicate: false, bookingId: created.bookingId });
    expect(second).toMatchObject({ duplicate: true });
    const booking = await getBooking(ravi, created.bookingId);
    expect(booking.status).toBe("CONFIRMED");
    await expect(handlePaymentWebhook(payload, "bad")).rejects.toMatchObject({ status: 401 });
  });

  it("hides unreleased reports and serves a released PDF", async () => {
    const asha = await actor(ID.asha, null);
    const meera = await actor(ID.meera, null);
    const draft = await prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId: ID.bookingAsha } });
    const released = await prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId: ID.bookingMeera } });
    await expect(readReportPdf(asha, draft.id)).rejects.toMatchObject({ status: 403 });
    const file = await readReportPdf(meera, released.id);
    expect(file.bytes.subarray(0, 4).toString()).toBe("%PDF");
    await expect(readReportPdf(asha, released.id)).rejects.toMatchObject({ status: 404 });
  });

  it("enforces the starter branch limit and approves a new center", async () => {
    const nimbus = await actor(ID.ownerNimbus, ID.nimbus);
    await expect(createBranch(nimbus, {
      name: "Second site",
      code: "SEC",
      address: "Synthetic road",
      city: "Bengaluru",
      state: "Karnataka",
      phone: "+918000000099",
      homeCollection: false,
      opensAt: "08:00",
      closesAt: "18:00",
    })).rejects.toBeInstanceOf(DomainError);
    const superAdmin = await actor(ID.super, null);
    const slug = `synth-lab-${Date.now()}`;
    const created = await registerCenter({
      ownerName: "Synth Applicant",
      email: `${slug}@mediscan.test`,
      phone: `+9198${String(Date.now()).slice(-8)}`,
      password: "Synthetic#2026",
      centerName: "Synth Applicant Lab",
      legalName: "Synth Applicant Lab Pvt Ltd",
      slug,
      city: "Pune",
      state: "Maharashtra",
      address: "Synthetic lane 4",
    });
    const approved = await decideTenant(superAdmin, created.tenantId, "APPROVE", "Synthetic review");
    expect(approved.status).toBe("ACTIVE");
  });

  it("refuses platform directories to a patient and omits password hashes", async () => {
    const asha = await actor(ID.asha, null);
    const superAdmin = await actor(ID.super, null);
    await expect(listUsersAdmin(asha)).rejects.toMatchObject({ status: 403 });
    await expect(platformOverview(asha)).rejects.toMatchObject({ status: 403 });
    await expect(listTenantsAdmin(asha)).rejects.toMatchObject({ status: 403 });
    await expect(notificationHealth(asha)).rejects.toMatchObject({ status: 403 });
    const users = await listUsersAdmin(superAdmin);
    expect(users.some((user) => user.email === "inbox@mediscan.test")).toBe(true);
    expect(JSON.stringify(users)).not.toContain("passwordHash");
    const tenants = await listTenantsAdmin(superAdmin);
    expect(JSON.stringify(tenants)).not.toContain("storageKey");
  });
});
