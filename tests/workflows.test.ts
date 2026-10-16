import { describe, expect, it, vi } from "vitest";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { createBooking, getBooking, listBookings, rescheduleBooking, transitionBooking } from "@/lib/services/booking";
import { createPaymentOrder, handlePaymentWebhook, refundPayment, verifyCheckoutPayment } from "@/lib/services/billing";
import { enterResults, listReports, listSamples, readReportPdf, transitionReport, transitionSample } from "@/lib/services/lab";
import { prismaPrivileged } from "@/lib/db";
import { mockCheckoutSignature, mockWebhookSignature, paymentProvider } from "@/lib/adapters/payment";

const actor = (userId: string, tenantId: string | null) => loadActor(userId, tenantId, null);

async function openSlots(n: number) {
  const slots = await prismaPrivileged.availabilitySlot.findMany({
    where: { branchId: ID.jubilee, kind: "CENTER", startsAt: { gt: new Date() }, id: { not: ID.slotRace } },
    orderBy: { startsAt: "asc" },
  });
  const free = slots.filter((slot) => slot.capacity - slot.bookedCount >= 1);
  if (free.length < n) throw new Error("Seed did not leave enough open slots");
  return free.slice(0, n);
}

async function paidBooking(userId: string, serviceIds: string[], tag: string) {
  const patient = await actor(userId, null);
  const [slot] = await openSlots(1);
  const created = await createBooking(patient, { branchId: ID.jubilee, slotId: slot!.id, serviceIds, packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `${tag}-${Date.now()}-${Math.random()}` });
  const order = await createPaymentOrder(patient, created.bookingId, `ord-${tag}-${Date.now()}-${Math.random()}`);
  const body = JSON.stringify({ id: `evt_${tag}_${created.bookingId}`, event: "payment.captured", payload: { payment: { entity: { id: `pay_${tag}_${created.bookingId}`, order_id: order.orderId, amount: created.totalPaise } } } });
  await handlePaymentWebhook(body, mockWebhookSignature(body));
  return { patient, created, order, slot: slot! };
}

describe("cross-tenant isolation on clinical and finance writes", () => {
  it("refuses another center's booking, samples, and reports", async () => {
    const nimbus = await actor(ID.ownerNimbus, ID.nimbus);
    await expect(transitionBooking(nimbus, ID.bookingAsha, "CANCELLED", "x")).rejects.toMatchObject({ status: 404 });
    const apexSample = await prismaPrivileged.sample.findFirstOrThrow({ where: { tenantId: ID.apex } });
    await expect(transitionSample(nimbus, apexSample.id, "REJECTED", "x")).rejects.toMatchObject({ status: 404 });
    const apexReport = await prismaPrivileged.medicalReport.findFirstOrThrow({ where: { tenantId: ID.apex } });
    await expect(transitionReport(nimbus, apexReport.id, "VERIFIED")).rejects.toMatchObject({ status: 404 });
    await expect(readReportPdf(nimbus, apexReport.id)).rejects.toMatchObject({ status: 404 });
    const samples = await listSamples(nimbus);
    expect(samples.every((sample) => sample.tenantId === ID.nimbus)).toBe(true);
    const reports = await listReports(nimbus);
    expect(reports.every((report) => report.tenantId === ID.nimbus)).toBe(true);
  });

  it("keeps a branch manager's booking list inside the assigned branch", async () => {
    const manager = await actor(ID.managerApex, ID.apex);
    const list = await listBookings(manager, { pageSize: 100 });
    expect(list.rows.length).toBeGreaterThan(0);
    expect(list.rows.every((row) => row.branchId === ID.jubilee)).toBe(true);
  });

  it("refuses a refund from another center's accountant", async () => {
    const payment = await prismaPrivileged.payment.findFirst({ where: { tenantId: ID.apex, status: "CAPTURED" } });
    if (!payment) return;
    const nimbus = await actor(ID.ownerNimbus, ID.nimbus);
    await expect(refundPayment(nimbus, payment.id, 100, "x")).rejects.toMatchObject({ status: 403 });
  });
});

describe("concurrent booking changes", () => {
  it("releases a slot only once when the same booking is cancelled twice at once", async () => {
    const asha = await actor(ID.asha, null);
    const [slot] = await openSlots(1);
    const created = await createBooking(asha, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [ID.tsh], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `dbl-${Date.now()}` });
    const held = await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: slot!.id } });
    const results = await Promise.allSettled([transitionBooking(asha, created.bookingId, "CANCELLED", "a"), transitionBooking(asha, created.bookingId, "CANCELLED", "b")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await prismaPrivileged.availabilitySlot.findUniqueOrThrow({ where: { id: slot!.id } });
    expect(after.bookedCount).toBe(held.bookedCount - 1);
  });

  it("does not let two reschedules both move a booking and leak a slot", async () => {
    const asha = await actor(ID.asha, null);
    const [a, b, c] = await openSlots(3);
    const created = await createBooking(asha, { branchId: ID.jubilee, slotId: a!.id, serviceIds: [ID.tsh], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `rs-${Date.now()}` });
    const before = await prismaPrivileged.availabilitySlot.findMany({ where: { id: { in: [a!.id, b!.id, c!.id] } } });
    const sum = (rows: typeof before) => rows.reduce((t, r) => t + r.bookedCount, 0);
    await Promise.allSettled([rescheduleBooking(asha, created.bookingId, b!.id), rescheduleBooking(asha, created.bookingId, c!.id)]);
    const after = await prismaPrivileged.availabilitySlot.findMany({ where: { id: { in: [a!.id, b!.id, c!.id] } } });
    expect(sum(after)).toBe(sum(before));
    const booking = await getBooking(asha, created.bookingId);
    expect([b!.id, c!.id]).toContain(booking.slotId);
  });
});

describe("booking state rules", () => {
  it("refuses a bare REFUNDED status change and a cancel without a reason", async () => {
    const owner = await actor(ID.ownerApex, ID.apex);
    await expect(transitionBooking(owner, ID.bookingMeera, "REFUNDED", "x")).rejects.toMatchObject({ code: "REFUND" });
    await expect(transitionBooking(owner, ID.bookingRavi, "CANCELLED", "")).rejects.toMatchObject({ code: "REASON" });
    await expect(transitionBooking(owner, ID.bookingRavi, "BOGUS" as never, "x")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("payment idempotency", () => {
  it("opens clinical work once when checkout verify and webhook race", async () => {
    const ravi = await actor(ID.ravi, null);
    const [slot] = await openSlots(1);
    const created = await createBooking(ravi, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [ID.cbc], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `racepay-${Date.now()}` });
    const order = await createPaymentOrder(ravi, created.bookingId, `racepay-ord-${Date.now()}`);
    const again = await createPaymentOrder(ravi, created.bookingId, `racepay-ord-${Date.now()}-x`);
    expect(again.orderId).not.toBe("");
    const paymentId = `pay_race_${created.bookingId}`;
    const body = JSON.stringify({ id: `evt_race_${created.bookingId}`, event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: order.orderId, amount: created.totalPaise } } } });
    if (!order.orderId) throw new Error("mock order id missing");
    const results = await Promise.allSettled([
      handlePaymentWebhook(body, mockWebhookSignature(body)),
      verifyCheckoutPayment(ravi, { orderId: order.orderId!, paymentId, signature: mockCheckoutSignature(order.orderId!, paymentId) }),
      handlePaymentWebhook(body, mockWebhookSignature(body)),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const fresh = results.filter((r) => r.status === "fulfilled" && (r.value as { duplicate: boolean }).duplicate === false);
    expect(fresh).toHaveLength(1);
    expect(await prismaPrivileged.labOrder.count({ where: { bookingId: created.bookingId } })).toBe(1);
    expect(await prismaPrivileged.medicalReport.count({ where: { bookingId: created.bookingId } })).toBe(1);
    expect(await prismaPrivileged.bookingStatusHistory.count({ where: { bookingId: created.bookingId, toStatus: "CONFIRMED" } })).toBe(1);
  });

  it("rejects a tampered amount and lets the provider retry the same event", async () => {
    const ravi = await actor(ID.ravi, null);
    const [slot] = await openSlots(1);
    const created = await createBooking(ravi, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [ID.tsh], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `amt-${Date.now()}` });
    const order = await createPaymentOrder(ravi, created.bookingId, `amt-ord-${Date.now()}`);
    const evt = `evt_amt_${created.bookingId}`;
    const bad = JSON.stringify({ id: evt, event: "payment.captured", payload: { payment: { entity: { id: "p1", order_id: order.orderId, amount: 1 } } } });
    await expect(handlePaymentWebhook(bad, mockWebhookSignature(bad))).rejects.toMatchObject({ code: "AMOUNT" });
    const good = JSON.stringify({ id: evt, event: "payment.captured", payload: { payment: { entity: { id: "p1", order_id: order.orderId, amount: created.totalPaise } } } });
    await expect(handlePaymentWebhook(good, mockWebhookSignature(good))).resolves.toMatchObject({ duplicate: false });
    expect((await getBooking(ravi, created.bookingId)).status).toBe("CONFIRMED");
  });

  it("never refunds more than was captured, even concurrently", async () => {
    const { created } = await paidBooking(ID.ravi, [ID.tsh], "rf");
    const accounts = await actor(ID.accountsApex, ID.apex);
    const payment = await prismaPrivileged.payment.findFirstOrThrow({ where: { invoice: { bookingId: created.bookingId }, status: "CAPTURED" } });
    const part = Math.ceil(payment.amountPaise * 0.6);
    await Promise.allSettled([refundPayment(accounts, payment.id, part, "a"), refundPayment(accounts, payment.id, part, "b")]);
    const refunded = await prismaPrivileged.refund.aggregate({ where: { paymentId: payment.id, status: "SUCCEEDED" }, _sum: { amountPaise: true } });
    expect(refunded._sum.amountPaise).toBeLessThanOrEqual(payment.amountPaise);
  });

  it("automatically refunds a payment captured after the booking was cancelled", async () => {
    const patient = await actor(ID.ravi, null);
    const owner = await actor(ID.ownerApex, ID.apex);
    const [slot] = await openSlots(1);
    const created = await createBooking(patient, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [ID.tsh], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `late-${Date.now()}` });
    const order = await createPaymentOrder(patient, created.bookingId, `late-ord-${Date.now()}`);
    await transitionBooking(owner, created.bookingId, "CANCELLED", "Patient called to cancel");
    const body = JSON.stringify({ id: `evt_late_${created.bookingId}`, event: "payment.captured", payload: { payment: { entity: { id: `pay_late_${created.bookingId}`, order_id: order.orderId, amount: created.totalPaise } } } });
    await expect(handlePaymentWebhook(body, mockWebhookSignature(body))).resolves.toMatchObject({ autoRefunded: true });
    const payment = await prismaPrivileged.payment.findFirstOrThrow({ where: { providerOrderId: order.orderId }, include: { refunds: true } });
    expect(payment.status).toBe("REFUNDED");
    expect(payment.refunds.map((r) => [r.status, r.amountPaise])).toEqual([["SUCCEEDED", created.totalPaise]]);
    expect((await prismaPrivileged.booking.findUniqueOrThrow({ where: { id: created.bookingId } })).status).toBe("REFUNDED");
  });

  it("flags a late capture for finance when the automatic refund fails", async () => {
    const patient = await actor(ID.ravi, null);
    const owner = await actor(ID.ownerApex, ID.apex);
    const [slot] = await openSlots(1);
    const created = await createBooking(patient, { branchId: ID.jubilee, slotId: slot!.id, serviceIds: [ID.tsh], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `late2-${Date.now()}` });
    const order = await createPaymentOrder(patient, created.bookingId, `late2-ord-${Date.now()}`);
    await transitionBooking(owner, created.bookingId, "CANCELLED", "Duplicate booking");
    const spy = vi.spyOn(paymentProvider(), "refund").mockRejectedValueOnce(new Error("gateway down"));
    try {
      const body = JSON.stringify({ id: `evt_late2_${created.bookingId}`, event: "payment.captured", payload: { payment: { entity: { id: `pay_late2_${created.bookingId}`, order_id: order.orderId, amount: created.totalPaise } } } });
      await expect(handlePaymentWebhook(body, mockWebhookSignature(body))).resolves.toMatchObject({ refundRequired: true });
    } finally {
      spy.mockRestore();
    }
    const payment = await prismaPrivileged.payment.findFirstOrThrow({ where: { providerOrderId: order.orderId } });
    expect(payment.status).toBe("CAPTURED");
    const flag = await prismaPrivileged.auditLog.findFirst({ where: { entityId: payment.id, metadata: { path: ["flag"], equals: "REFUND_REQUIRED" } } });
    expect(flag).not.toBeNull();
  });

  it("reserves the refund under the payment lock before calling the provider", async () => {
    const { created } = await paidBooking(ID.ravi, [ID.tsh], "rf-lock");
    const accounts = await actor(ID.accountsApex, ID.apex);
    const payment = await prismaPrivileged.payment.findFirstOrThrow({ where: { invoice: { bookingId: created.bookingId }, status: "CAPTURED" } });
    expect(payment.providerPaymentId).toBeTruthy();
    const spy = vi.spyOn(paymentProvider(), "refund");
    try {
      const part = Math.ceil(payment.amountPaise * 0.6);
      const results = await Promise.allSettled([refundPayment(accounts, payment.id, part, "a"), refundPayment(accounts, payment.id, part, "b")]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      // The losing request is refused before the provider is ever asked.
      expect(spy).toHaveBeenCalledTimes(1);
      const rows = await prismaPrivileged.refund.findMany({ where: { paymentId: payment.id } });
      expect(rows.map((r) => r.status)).toEqual(["SUCCEEDED"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("releases the reservation when the provider refuses a refund", async () => {
    const { created } = await paidBooking(ID.ravi, [ID.tsh], "rf-fail");
    const accounts = await actor(ID.accountsApex, ID.apex);
    const payment = await prismaPrivileged.payment.findFirstOrThrow({ where: { invoice: { bookingId: created.bookingId }, status: "CAPTURED" } });
    const spy = vi.spyOn(paymentProvider(), "refund").mockRejectedValueOnce(new Error("gateway down"));
    try {
      await expect(refundPayment(accounts, payment.id, payment.amountPaise, "x")).rejects.toMatchObject({ status: 502 });
      expect((await prismaPrivileged.refund.findFirstOrThrow({ where: { paymentId: payment.id } })).status).toBe("FAILED");
      await expect(refundPayment(accounts, payment.id, payment.amountPaise, "retry")).resolves.toBeTruthy();
      expect((await prismaPrivileged.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("REFUNDED");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("report approval gating", () => {
  it("walks a lab report through maker-checker review and only then releases it to the patient", async () => {
    const { patient, created } = await paidBooking(ID.meera, [ID.cbc], "rep");
    const tech = await actor(ID.techApex, ID.apex);
    const path = await actor(ID.pathApex, ID.apex);
    const desk = await actor(ID.deskApex, ID.apex);
    const sample = await prismaPrivileged.sample.findFirstOrThrow({ where: { labOrder: { bookingId: created.bookingId } } });
    const report = await prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId: created.bookingId } });
    const params = await prismaPrivileged.testParameter.findMany({ where: { serviceId: ID.cbc }, orderBy: { position: "asc" } });
    expect(params.length).toBeGreaterThan(1);

    await expect(enterResults(tech, sample.id, [{ parameterId: params[0]!.id, numericValue: 13 }])).rejects.toMatchObject({ status: 409 });
    for (const to of ["COLLECTED", "RECEIVED", "PROCESSING"] as const) await transitionSample(tech, sample.id, to);
    await enterResults(tech, sample.id, [{ parameterId: params[0]!.id, numericValue: 13 }]);
    await expect(transitionSample(tech, sample.id, "RESULTED")).rejects.toMatchObject({ code: "RESULT" });
    await transitionReport(tech, report.id, "ENTERED");
    await expect(transitionReport(path, report.id, "VERIFIED")).rejects.toMatchObject({ code: "REPORT" });

    const values = params.map((p) => (p.resultType === "NUMERIC" ? { parameterId: p.id, numericValue: 5 } : { parameterId: p.id, textValue: "Synthetic" }));
    await enterResults(tech, sample.id, values);
    await transitionSample(tech, sample.id, "RESULTED");
    await expect(transitionReport(path, report.id, "REJECTED")).rejects.toMatchObject({ code: "REASON" });
    await expect(transitionReport(tech, report.id, "VERIFIED")).rejects.toMatchObject({ status: 403 });
    await expect(transitionReport(desk, report.id, "VERIFIED")).rejects.toMatchObject({ status: 404 });
    await expect(transitionReport(path, report.id, "RELEASED")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await transitionReport(path, report.id, "VERIFIED");
    await expect(enterResults(tech, sample.id, values)).rejects.toMatchObject({ code: "REPORT_LOCKED" });
    await expect(readReportPdf(patient, report.id)).rejects.toMatchObject({ status: 404 });
    await transitionReport(path, report.id, "APPROVED");
    await expect(readReportPdf(patient, report.id)).rejects.toMatchObject({ status: 404 });

    const releases = await Promise.allSettled([transitionReport(path, report.id, "RELEASED"), transitionReport(path, report.id, "RELEASED")]);
    expect(releases.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prismaPrivileged.reportVersion.count({ where: { reportId: report.id } })).toBe(1);
    const file = await readReportPdf(patient, report.id);
    expect(file.bytes.subarray(0, 4).toString()).toBe("%PDF");
    const other = await actor(ID.asha, null);
    await expect(readReportPdf(other, report.id)).rejects.toMatchObject({ status: 404 });
  });
});
