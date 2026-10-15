import { Prisma } from "@prisma/client";
import { prismaPrivileged } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { publicCode } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { paymentProvider } from "@/lib/adapters/payment";
import { getBooking, openClinicalWork } from "@/lib/services/booking";
import { enqueue } from "@/lib/services/notify";
import { creditWallet, debitWallet } from "@/lib/services/patient-extras";
import { getEnv } from "@/lib/env";
import type { Actor } from "@/domain/actor";
import { assertPermission } from "@/domain/actor";
import type { ServiceKind } from "@prisma/client";

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createPaymentOrder(actor: Actor, bookingId: string, idempotencyKey: string) {
  const booking = await getBooking(actor, bookingId);
  if (booking.patient.userId !== actor.userId && !actor.memberships.some((membership) => membership.tenantId === booking.tenantId && membership.permissions.includes("invoices.manage"))) {
    throw new DomainError("FORBIDDEN", "You cannot pay this invoice", 403);
  }
  if (booking.status !== "PENDING") throw new DomainError("PAYMENT", "This booking is not awaiting payment", 409);
  const invoice = booking.invoice;
  if (!invoice) throw new DomainError("PAYMENT", "Invoice is missing", 500);
  const key = `${booking.tenantId}:payment:${idempotencyKey}`;
  const existing = await prismaPrivileged.payment.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    return { orderId: existing.providerOrderId, amountPaise: existing.amountPaise, currency: "INR" as const, keyId: paymentProvider().name === "razorpay" ? getEnv().RAZORPAY_KEY_ID ?? null : null, paymentId: existing.id };
  }
  const order = await paymentProvider().createOrder({
    amountPaise: invoice.totalPaise,
    receipt: invoice.number,
    notes: { bookingId: booking.id, tenantId: booking.tenantId },
  });
  try {
    const payment = await withScope({ tenantId: booking.tenantId, userId: actor.userId, patientId: actor.patientId }, (tx) =>
      tx.payment.create({
        data: {
          tenantId: booking.tenantId,
          invoiceId: invoice.id,
          provider: paymentProvider().name,
          providerOrderId: order.orderId,
          amountPaise: invoice.totalPaise,
          status: "CREATED",
          idempotencyKey: key,
        },
      }),
    );
    return { orderId: order.orderId, amountPaise: order.amountPaise, currency: order.currency, keyId: order.keyId, paymentId: payment.id };
  } catch (error) {
    if (!isUnique(error)) throw error;
    const again = await prismaPrivileged.payment.findUnique({ where: { idempotencyKey: key } });
    if (!again) throw error;
    return { orderId: again.providerOrderId, amountPaise: again.amountPaise, currency: "INR" as const, keyId: order.keyId, paymentId: again.id };
  }
}

async function capturePayment(providerOrderId: string, providerPaymentId: string, amountPaise: number) {
  const payment = await prismaPrivileged.payment.findUnique({
    where: { providerOrderId },
    include: { invoice: { include: { booking: { include: { items: { include: { service: true, package: { include: { items: { include: { service: true } } } } } }, patient: { include: { user: { select: { id: true, email: true, phone: true, name: true } } } }, tenant: true } } } } },
  });
  if (!payment || !payment.invoice.booking) throw new DomainError("NOT_FOUND", "Payment order not found", 404);
  if (payment.amountPaise !== amountPaise) throw new DomainError("AMOUNT", "Payment amount does not match the invoice", 409);
  if (payment.status === "CAPTURED") return { duplicate: true as const, bookingId: payment.invoice.booking.id };
  await withScope({ tenantId: payment.tenantId }, async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED", providerPaymentId } });
    await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: "PAID" } });
    if (payment.invoice.booking?.status === "PENDING") {
      await tx.booking.update({ where: { id: payment.invoice.booking.id }, data: { status: "CONFIRMED" } });
      await tx.bookingStatusHistory.create({
        data: { tenantId: payment.tenantId, bookingId: payment.invoice.booking.id, fromStatus: "PENDING", toStatus: "CONFIRMED", reason: "Payment captured" },
      });
      const items = payment.invoice.booking.items.map((item) => ({
        serviceId: item.serviceId ?? undefined,
        packageId: item.packageId ?? undefined,
        name: item.name,
        pricePaise: item.pricePaise,
        expanded: item.service
          ? [{ serviceId: item.service.id, kind: item.service.kind, name: item.service.name }]
          : (item.package?.items.map((pkg) => ({ serviceId: pkg.serviceId, kind: pkg.service.kind as ServiceKind, name: pkg.service.name })) ?? []),
      }));
      await openClinicalWork(tx, payment.tenantId, payment.invoice.booking.id, payment.invoice.booking.branchId, items, payment.invoice.booking.createdById);
      const confirmPayload = {
        publicCode: payment.invoice.booking.publicCode,
        centerName: payment.invoice.booking.tenant.name,
        when: payment.invoice.booking.scheduledAt.toISOString(),
        link: `${getEnv().APP_URL}/bookings/${payment.invoice.booking.id}`,
      };
      await enqueue(tx, {
        tenantId: payment.tenantId,
        userId: payment.invoice.booking.patient.userId,
        channel: "EMAIL",
        templateKey: "booking_confirmed",
        to: payment.invoice.booking.patient.user.email,
        payload: confirmPayload,
      });
      await enqueue(tx, {
        tenantId: payment.tenantId,
        userId: payment.invoice.booking.patient.userId,
        channel: "IN_APP",
        templateKey: "booking_confirmed",
        to: payment.invoice.booking.patient.user.email,
        payload: confirmPayload,
      });
    }
    await writeAudit(tx, { tenantId: payment.tenantId, action: "UPDATE", entityType: "Payment", entityId: payment.id, metadata: { providerPaymentId } });
  });
  const patientId = payment.invoice.booking!.patientId;
  const credit = Math.floor(payment.amountPaise * 0.01);
  if (credit > 0) await creditWallet(patientId, credit, "1% loyalty on captured payment", payment.invoice.booking!.id);
  return { duplicate: false as const, bookingId: payment.invoice.booking.id };
}

export async function verifyCheckoutPayment(actor: Actor, input: { orderId: string; paymentId: string; signature: string }) {
  const payment = await prismaPrivileged.payment.findUnique({ where: { providerOrderId: input.orderId }, include: { invoice: { include: { booking: true } } } });
  if (!payment?.invoice.booking) throw new DomainError("NOT_FOUND", "Payment order not found", 404);
  const owns = payment.invoice.booking.patientId === actor.patientId;
  const staff = actor.memberships.some((membership) => membership.tenantId === payment.tenantId && membership.permissions.includes("invoices.manage"));
  if (!owns && !staff && !actor.isSuperAdmin) throw new DomainError("FORBIDDEN", "You cannot verify this payment", 403);
  if (!paymentProvider().verifyCheckoutSignature(input)) throw new DomainError("SIGNATURE", "Payment signature could not be verified", 400);
  return capturePayment(input.orderId, input.paymentId, payment.amountPaise);
}

export async function handlePaymentWebhook(rawBody: string, signature: string | null) {
  if (!paymentProvider().verifyWebhook(rawBody, signature)) throw new DomainError("SIGNATURE", "Webhook signature could not be verified", 401);
  let event: { id?: string; event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new DomainError("BAD_JSON", "Webhook body must be JSON", 400);
  }
  if (!event.id) throw new DomainError("WEBHOOK", "Webhook event id is required", 400);
  const provider = paymentProvider().name;
  const seen = await prismaPrivileged.webhookEvent.findUnique({ where: { provider_eventId: { provider, eventId: event.id } } });
  if (seen) return { duplicate: true as const };
  try {
    await prismaPrivileged.webhookEvent.create({ data: { provider, eventId: event.id, payload: event } });
  } catch (error) {
    if (isUnique(error)) return { duplicate: true as const };
    throw error;
  }
  if (event.event !== "payment.captured") return { ignored: true as const, duplicate: false as const };
  const entity = event.payload?.payment?.entity;
  if (!entity?.order_id || !entity.id || entity.amount == null) throw new DomainError("WEBHOOK", "Captured payment payload is incomplete", 400);
  const result = await capturePayment(entity.order_id, entity.id, entity.amount);
  return { duplicate: result.duplicate, bookingId: result.bookingId };
}

export async function applyWalletToInvoice(actor: Actor, invoiceId: string, amountPaise: number, reason: string) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "invoices.manage", tenantId);
  if (amountPaise <= 0) throw new DomainError("AMOUNT", "Amount must be positive", 400);
  const invoice = await withScope({ tenantId, userId: actor.userId }, (tx) =>
    tx.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { booking: true } }),
  );
  if (!invoice?.patientId) throw new DomainError("NOT_FOUND", "Invoice not found", 404);
  if (invoice.status === "PAID") throw new DomainError("INVOICE", "Invoice is already paid", 409);
  const captured = await withScope({ tenantId, userId: actor.userId }, (tx) =>
    tx.payment.findMany({ where: { invoiceId: invoice.id, status: "CAPTURED" } }),
  );
  const paid = captured.reduce((sum, row) => sum + row.amountPaise, 0);
  const due = invoice.totalPaise - paid;
  const redeem = Math.min(amountPaise, due);
  if (redeem <= 0) throw new DomainError("WALLET", "Nothing left to apply wallet to", 409);
  await debitWallet(invoice.patientId, redeem, reason || "Desk wallet redemption", invoice.bookingId ?? undefined);
  const lines = Array.isArray(invoice.lines) ? [...(invoice.lines as Array<{ name: string; amountPaise: number }>)] : [];
  lines.push({ name: "Wallet redemption (desk)", amountPaise: -redeem });
  const newTotal = invoice.totalPaise - redeem;
  await withScope({ tenantId, userId: actor.userId }, async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { totalPaise: newTotal, walletRedeemPaise: invoice.walletRedeemPaise + redeem, lines, status: newTotal <= 0 ? "PAID" : invoice.status },
    });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Invoice", entityId: invoice.id, metadata: { walletRedeem: redeem } });
  });
  if (newTotal <= 0 && invoice.booking && invoice.booking.status === "PENDING") {
    const { transitionBooking } = await import("@/lib/services/booking");
    await transitionBooking(actor, invoice.booking.id, "CONFIRMED", reason || "Paid via wallet");
  }
  return { redeemedPaise: redeem, duePaise: Math.max(0, newTotal) };
}

export async function recordManualPayment(actor: Actor, invoiceId: string, reason: string) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "invoices.manage", tenantId);
  const invoice = await withScope({ tenantId, userId: actor.userId }, (tx) => tx.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { booking: true, payments: true } }));
  if (!invoice) throw new DomainError("NOT_FOUND", "Invoice not found", 404);
  if (invoice.status === "PAID") return invoice;
  const captured = invoice.payments.filter((payment) => payment.status === "CAPTURED").reduce((sum, payment) => sum + payment.amountPaise, 0);
  const due = invoice.totalPaise - captured;
  if (due <= 0) return invoice;
  await withScope({ tenantId, userId: actor.userId }, async (tx) => {
    await tx.payment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        provider: "manual",
        providerPaymentId: publicCode("CASH"),
        amountPaise: due,
        status: "CAPTURED",
        idempotencyKey: `${tenantId}:manual:${invoice.id}:${Date.now()}`,
      },
    });
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Invoice", entityId: invoice.id, metadata: { reason, mode: "manual" } });
  });
  if (invoice.booking && invoice.booking.status === "PENDING") {
    const { transitionBooking } = await import("@/lib/services/booking");
    await transitionBooking(actor, invoice.booking.id, "CONFIRMED", reason || "Manual payment recorded");
  }
  return invoice;
}

export async function refundPayment(actor: Actor, paymentId: string, amountPaise: number, reason: string) {
  const payment = await prismaPrivileged.payment.findUnique({ where: { id: paymentId }, include: { refunds: true, invoice: { include: { booking: true } } } });
  if (!payment) throw new DomainError("NOT_FOUND", "Payment not found", 404);
  assertPermission(actor, "payments.refund", payment.tenantId);
  if (payment.status !== "CAPTURED" && payment.status !== "REFUNDED") throw new DomainError("PAYMENT", "Only captured payments can be refunded", 409);
  const already = payment.refunds.filter((refund) => refund.status === "SUCCEEDED").reduce((sum, refund) => sum + refund.amountPaise, 0);
  if (amountPaise <= 0 || amountPaise > payment.amountPaise - already) throw new DomainError("AMOUNT", "Refund amount exceeds the captured balance", 400);
  if (!reason.trim()) throw new DomainError("REASON", "A refund reason is required", 400);
  const providerRefund = payment.provider === "manual" || !payment.providerPaymentId
    ? { refundId: publicCode("RFND") }
    : await paymentProvider().refund({ providerPaymentId: payment.providerPaymentId, amountPaise });
  await withScope({ tenantId: payment.tenantId, userId: actor.userId }, async (tx) => {
    await tx.refund.create({
      data: { tenantId: payment.tenantId, paymentId: payment.id, amountPaise, status: "SUCCEEDED", reason, providerRefundId: providerRefund.refundId },
    });
    const full = already + amountPaise >= payment.amountPaise;
    if (full) await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    if (full && payment.invoice.booking && ["CANCELLED", "COMPLETED", "CONFIRMED"].includes(payment.invoice.booking.status)) {
      await tx.booking.update({ where: { id: payment.invoice.booking.id }, data: { status: "REFUNDED" } });
      await tx.bookingStatusHistory.create({
        data: { tenantId: payment.tenantId, bookingId: payment.invoice.booking.id, fromStatus: payment.invoice.booking.status, toStatus: "REFUNDED", actorId: actor.userId, reason },
      });
    }
    await writeAudit(tx, { tenantId: payment.tenantId, actorId: actor.userId, action: "REFUND", entityType: "Payment", entityId: payment.id, metadata: { amountPaise, reason } });
  });
  return { refundId: providerRefund.refundId };
}

export async function listInvoices(actor: Actor) {
  if (actor.patientId && !actor.activeTenantId) {
    return withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) =>
      tx.invoice.findMany({ where: { patientId: actor.patientId! }, include: { payments: true, booking: true }, orderBy: { issuedAt: "desc" } }),
    );
  }
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "invoices.read", tenantId);
  return withScope({ tenantId, userId: actor.userId }, (tx) =>
    tx.invoice.findMany({ where: { tenantId }, include: { payments: { include: { refunds: true } }, booking: true, patient: { include: { user: { select: { id: true, name: true, email: true, phone: true, status: true } } } } }, orderBy: { issuedAt: "desc" }, take: 100 }),
  );
}
