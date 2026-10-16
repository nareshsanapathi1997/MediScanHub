import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { fail, ok, readBody } from "@/server/http";
import { assertCsrf, assertSameOrigin, clearSessionCookies, currentSession, requestMeta, setSessionCookies } from "@/server/session";
import { homeFor, assertPermission } from "@/domain/actor";
import { createInvitation, login, registerCenter, registerPatient, requestPasswordReset, resetPassword, revokeSession } from "@/lib/services/auth";
import { createBooking, getBooking, listBookings, readBookingPrescription, rescheduleBooking, transitionBooking } from "@/lib/services/booking";
import { listGeoCountries, listGeoStates, searchGeoCities } from "@/lib/services/geo";
import {
  deleteChronicCondition,
  deleteDependent,
  deleteInsurance,
  getWallet,
  listChronicConditions,
  listDependents,
  listInAppNotifications,
  listInsurance,
  markAllNotificationsRead,
  markNotificationRead,
  saveChronicCondition,
  saveDependent,
  saveInsurance,
} from "@/lib/services/patient-extras";
import { applyWalletToInvoice } from "@/lib/services/billing";
import { listTpaClaims, submitTpaClaim, transitionTpaClaim } from "@/lib/services/tpa-claims";
import { getCenterBySlug, listCenters, listPublicPackages, listSlots, searchServices } from "@/lib/services/catalog";
import { createPaymentOrder, handlePaymentWebhook, verifyCheckoutPayment } from "@/lib/services/billing";
import { assignSampleTechnician, enterResults, listReports, listSamples, readReportPdf, transitionReport, transitionSample } from "@/lib/services/lab";
import { createTicket, decideTenant, exportBookingsCsv, exportPatientData, platformOverview, readVerification, tenantAnalytics } from "@/lib/services/admin";
import { changePlan, listPlans, refreshSubscriptionStates, subscriptionUsage } from "@/lib/services/subscription";
import { enqueueBookingReminders, processNotificationQueue } from "@/lib/services/notify";
import { transitionStudy } from "@/lib/services/imaging";
import { readFileLink, readReportLink } from "@/lib/adapters/storage";
import { readReportFile, removeReportFile, signedReportFileLink, signedReportPdfPath, uploadReportFile } from "@/lib/services/report-files";
import { getEnv } from "@/lib/env";
import type { Actor } from "@/domain/actor";
import type { BookingStatus, ReportFileKind, ReportStatus, SampleStatus, StudyStatus } from "@prisma/client";

const csrfExempt = new Set(["auth/login", "auth/register", "auth/forgot", "auth/recover", "auth/logout", "payments/webhook", "notifications/process", "centers/register"]);
const originExempt = new Set(["payments/webhook", "notifications/process"]);

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

function requireActor(actor: Actor | null): Actor {
  if (!actor) throw new DomainError("UNAUTHENTICATED", "Sign in required", 401);
  return actor;
}

async function dispatch(req: Request, slug: string, session: { sessionId: string; actor: Actor } | null) {
  const actor = session?.actor ?? null;
  const url = new URL(req.url);
  const q = url.searchParams;

  if (req.method === "GET" && slug === "auth/session") {
    if (!actor) return ok({ user: null });
    return ok({ user: { id: actor.userId, name: actor.name, email: actor.email, patientId: actor.patientId, activeTenantId: actor.activeTenantId, isSuperAdmin: actor.isSuperAdmin, home: homeFor(actor) } });
  }
  if (req.method === "POST" && slug === "auth/login") {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await readBody(req));
    const meta = await requestMeta();
    const result = await login({ ...body, ip: meta.ip, userAgent: meta.userAgent });
    await setSessionCookies(result.token, result.csrf);
    return ok({ csrf: result.csrf, home: homeFor(result.actor), user: { id: result.actor.userId, name: result.actor.name } });
  }
  if (req.method === "POST" && slug === "auth/logout") {
    if (session) await revokeSession(session.sessionId, session.actor.userId);
    await clearSessionCookies();
    return ok({ signedOut: true });
  }
  if (req.method === "POST" && slug === "auth/register") {
    const body = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(8),
      password: z.string().min(10),
      dateOfBirth: z.string(),
      sex: z.enum(["FEMALE", "MALE", "INTERSEX", "UNKNOWN"]),
      city: z.string().optional(),
    }).parse(await readBody(req));
    const meta = await requestMeta();
    await registerPatient({ ...body, dateOfBirth: new Date(body.dateOfBirth), ip: meta.ip });
    return ok({ registered: true }, 201);
  }
  if (req.method === "POST" && slug === "auth/forgot") {
    const body = z.object({ email: z.string().email() }).parse(await readBody(req));
    const result = await requestPasswordReset(body.email);
    return ok({ sent: true, devLink: result.devLink });
  }
  if (req.method === "POST" && slug === "auth/recover") {
    const body = z.object({ token: z.string().min(10), password: z.string().min(10) }).parse(await readBody(req));
    await resetPassword(body.token, body.password);
    return ok({ reset: true });
  }
  if (req.method === "GET" && slug === "geo/countries") {
    return ok(await listGeoCountries());
  }
  if (req.method === "GET" && slug === "geo/states") {
    const countryId = Number(q.get("countryId"));
    if (!countryId) throw new DomainError("VALIDATION", "countryId is required", 400);
    return ok(await listGeoStates(countryId));
  }
  if (req.method === "GET" && slug === "geo/cities") {
    const stateId = Number(q.get("stateId"));
    if (!stateId) throw new DomainError("VALIDATION", "stateId is required", 400);
    return ok(await searchGeoCities({ stateId, query: q.get("q") ?? undefined, limit: Number(q.get("limit") ?? "50") }));
  }
  if (req.method === "GET" && slug === "centers") {
    return ok(await listCenters(q.get("city") ?? undefined));
  }
  if (req.method === "GET" && slug.startsWith("centers/") && slug !== "centers/register") {
    const center = await getCenterBySlug(slug.slice("centers/".length));
    if (!center) throw new DomainError("NOT_FOUND", "Center not found", 404);
    return ok(center);
  }
  if (req.method === "POST" && slug === "centers/register") {
    const body = z.object({
      ownerName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(8),
      password: z.string().min(10),
      centerName: z.string().min(2),
      legalName: z.string().min(2),
      slug: z.string().min(2),
      city: z.string().min(2),
      state: z.string().min(2),
      address: z.string().min(4),
      gstin: z.string().optional(),
    }).parse(await readBody(req));
    const meta = await requestMeta();
    const created = await registerCenter({ ...body, ip: meta.ip });
    return ok(created, 201);
  }
  if (req.method === "POST" && /^admin\/tenants\/[^/]+\/decision$/.test(slug)) {
    const user = requireActor(actor);
    const tenantId = slug.split("/")[2]!;
    const body = z.object({ decision: z.enum(["APPROVE", "REJECT", "SUSPEND", "REACTIVATE"]), notes: z.string().optional() }).parse(await readBody(req));
    return ok(await decideTenant(user, tenantId, body.decision, body.notes));
  }
  if (req.method === "GET" && slug === "catalog/search") {
    const kind = q.get("kind");
    return ok(await searchServices({ query: q.get("q") ?? undefined, city: q.get("city") ?? undefined, kind: kind === "LAB" || kind === "IMAGING" ? kind : undefined }));
  }
  if (req.method === "GET" && slug === "packages") return ok(await listPublicPackages());
  if (req.method === "GET" && slug === "slots") {
    const branchId = z.string().uuid().parse(q.get("branchId"));
    const day = z.string().parse(q.get("day"));
    const kind = z.enum(["CENTER", "HOME", "IMAGING"]).parse(q.get("kind") ?? "CENTER");
    return ok(await listSlots(branchId, day, kind));
  }
  if (req.method === "GET" && slug === "plans") return ok(await listPlans());
  if (slug === "bookings" && req.method === "GET") {
    const user = requireActor(actor);
    const status = q.get("status") as BookingStatus | null;
    return ok(await listBookings(user, { status: status ?? undefined, query: q.get("q") ?? undefined, page: Number(q.get("page") ?? "1") }));
  }
  if (slug === "bookings" && req.method === "POST") {
    const user = requireActor(actor);
    const body = z.object({
      branchId: z.string().uuid(),
      slotId: z.string().uuid().optional(),
      serviceIds: z.array(z.string().uuid()).default([]),
      packageIds: z.array(z.string().uuid()).default([]),
      visitType: z.enum(["CENTER_VISIT", "HOME_COLLECTION"]),
      address: z.string().optional(),
      notes: z.string().optional(),
      idempotencyKey: z.string().min(8).max(120),
      referralEmail: z.string().email().optional(),
      dependentId: z.string().uuid().optional(),
      walletRedeemPaise: z.number().int().nonnegative().optional(),
      insurancePolicyId: z.string().uuid().optional(),
      tpaReference: z.string().optional(),
    }).parse(await readBody(req));
    const headerKey = req.headers.get("idempotency-key");
    const created = await createBooking(user, { ...body, idempotencyKey: headerKey || body.idempotencyKey });
    return ok(created, 201);
  }
  if (req.method === "GET" && slug.match(/^bookings\/[^/]+\/prescription$/)) {
    const id = slug.split("/")[1]!;
    const file = await readBookingPrescription(requireActor(actor), id);
    return new Response(new Uint8Array(file.bytes), {
      headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"` },
    });
  }
  const bookingId = slug.match(/^bookings\/([^/]+)$/)?.[1];
  if (bookingId && req.method === "GET") return ok(await getBooking(requireActor(actor), bookingId));
  if (req.method === "GET" && slug === "patient/dependents") return ok(await listDependents(requireActor(actor)));
  if (req.method === "POST" && slug === "patient/dependents") {
    const body = z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(2),
      dateOfBirth: z.string(),
      sex: z.enum(["FEMALE", "MALE", "INTERSEX", "UNKNOWN"]),
      relation: z.string().min(2),
    }).parse(await readBody(req));
    return ok(await saveDependent(requireActor(actor), { ...body, dateOfBirth: new Date(body.dateOfBirth) }), body.id ? 200 : 201);
  }
  const dependentId = slug.match(/^patient\/dependents\/([^/]+)$/)?.[1];
  if (dependentId && req.method === "DELETE") {
    await deleteDependent(requireActor(actor), dependentId);
    return ok({ deleted: true });
  }
  if (req.method === "GET" && slug === "patient/wallet") return ok(await getWallet(requireActor(actor)));
  if (req.method === "GET" && slug === "patient/insurance") return ok(await listInsurance(requireActor(actor)));
  if (req.method === "POST" && slug === "patient/insurance") {
    const body = z.object({
      provider: z.string().min(2),
      policyNumber: z.string().min(2),
      tpaName: z.string().optional(),
      validUntil: z.string().optional(),
    }).parse(await readBody(req));
    return ok(await saveInsurance(requireActor(actor), { ...body, validUntil: body.validUntil ? new Date(body.validUntil) : undefined }), 201);
  }
  const policyId = slug.match(/^patient\/insurance\/([^/]+)$/)?.[1];
  if (policyId && req.method === "DELETE") {
    await deleteInsurance(requireActor(actor), policyId);
    return ok({ deleted: true });
  }
  if (req.method === "GET" && slug === "patient/inbox") return ok(await listInAppNotifications(requireActor(actor)));
  if (req.method === "POST" && slug === "patient/inbox/read-all") {
    await markAllNotificationsRead(requireActor(actor));
    return ok({ read: true });
  }
  const notificationId = slug.match(/^patient\/inbox\/([^/]+)\/read$/)?.[1];
  if (notificationId && req.method === "POST") return ok(await markNotificationRead(requireActor(actor), notificationId));
  if (req.method === "GET" && slug === "patient/chronic") return ok(await listChronicConditions(requireActor(actor)));
  if (req.method === "POST" && slug === "patient/chronic") {
    const body = z.object({ condition: z.string().min(2), since: z.string().optional(), notes: z.string().optional() }).parse(await readBody(req));
    return ok(await saveChronicCondition(requireActor(actor), { ...body, since: body.since ? new Date(body.since) : undefined }), 201);
  }
  const chronicId = slug.match(/^patient\/chronic\/([^/]+)$/)?.[1];
  if (chronicId && req.method === "DELETE") {
    await deleteChronicCondition(requireActor(actor), chronicId);
    return ok({ deleted: true });
  }
  if (req.method === "GET" && slug === "finance/tpa-claims") return ok(await listTpaClaims(requireActor(actor)));
  if (req.method === "POST" && slug === "finance/tpa-claims") {
    const body = z.object({ invoiceId: z.string().uuid(), claimedPaise: z.number().int().positive(), externalReference: z.string().optional(), notes: z.string().optional() }).parse(await readBody(req));
    return ok(await submitTpaClaim(requireActor(actor), body), 201);
  }
  if (req.method === "POST" && slug.match(/^finance\/tpa-claims\/[^/]+$/)) {
    const id = slug.split("/")[2]!;
    const body = z.object({ to: z.enum(["APPROVED", "PAID", "REJECTED"]), approvedPaise: z.number().int().positive().optional(), paidPaise: z.number().int().positive().optional(), notes: z.string().optional() }).parse(await readBody(req));
    return ok(await transitionTpaClaim(requireActor(actor), id, body.to, body));
  }
  if (req.method === "POST" && slug === "finance/wallet-apply") {
    const body = z.object({ invoiceId: z.string().uuid(), amountPaise: z.number().int().positive(), reason: z.string().optional() }).parse(await readBody(req));
    return ok(await applyWalletToInvoice(requireActor(actor), body.invoiceId, body.amountPaise, body.reason ?? "API wallet redemption"));
  }
  if (req.method === "POST" && slug.match(/^bookings\/[^/]+\/transition$/)) {
    const id = slug.split("/")[1]!;
    const body = z.object({ to: z.string(), reason: z.string().optional() }).parse(await readBody(req));
    return ok(await transitionBooking(requireActor(actor), id, body.to as BookingStatus, body.reason));
  }
  if (req.method === "POST" && slug.match(/^bookings\/[^/]+\/reschedule$/)) {
    const id = slug.split("/")[1]!;
    const body = z.object({ slotId: z.string().uuid() }).parse(await readBody(req));
    return ok(await rescheduleBooking(requireActor(actor), id, body.slotId));
  }
  if (req.method === "POST" && slug === "payments/orders") {
    const body = z.object({ bookingId: z.string().uuid(), idempotencyKey: z.string().min(8) }).parse(await readBody(req));
    return ok(await createPaymentOrder(requireActor(actor), body.bookingId, req.headers.get("idempotency-key") || body.idempotencyKey));
  }
  if (req.method === "POST" && slug === "payments/verify") {
    const body = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(await readBody(req));
    return ok(await verifyCheckoutPayment(requireActor(actor), body));
  }
  if (req.method === "POST" && slug === "payments/webhook") {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? req.headers.get("x-mediscan-signature");
    return ok(await handlePaymentWebhook(raw, signature));
  }
  if (req.method === "GET" && slug === "samples") {
    const status = q.get("status") as SampleStatus | null;
    return ok(await listSamples(requireActor(actor), status ?? undefined));
  }
  if (req.method === "POST" && slug.match(/^samples\/[^/]+\/assign$/)) {
    const id = slug.split("/")[1]!;
    const body = z.object({ assigneeId: z.string().uuid() }).parse(await readBody(req));
    return ok(await assignSampleTechnician(requireActor(actor), id, body.assigneeId));
  }
  if (req.method === "POST" && slug.match(/^samples\/[^/]+\/transition$/)) {
    const id = slug.split("/")[1]!;
    const body = z.object({ to: z.string(), reason: z.string().optional() }).parse(await readBody(req));
    return ok(await transitionSample(requireActor(actor), id, body.to as SampleStatus, body.reason));
  }
  if (req.method === "POST" && slug.match(/^samples\/[^/]+\/results$/)) {
    const id = slug.split("/")[1]!;
    const body = z.object({ values: z.array(z.object({ parameterId: z.string().uuid(), numericValue: z.number().optional(), textValue: z.string().optional() })) }).parse(await readBody(req));
    return ok(await enterResults(requireActor(actor), id, body.values));
  }
  if (req.method === "GET" && slug === "reports") {
    const status = q.get("status") as ReportStatus | null;
    return ok(await listReports(requireActor(actor), status ?? undefined));
  }
  if (req.method === "POST" && slug.match(/^reports\/[^/]+\/transition$/)) {
    const id = slug.split("/")[1]!;
    const body = z.object({ to: z.string(), comment: z.string().optional() }).parse(await readBody(req));
    return ok(await transitionReport(requireActor(actor), id, body.to as ReportStatus, body.comment));
  }
  if (req.method === "GET" && slug.match(/^reports\/[^/]+\/download$/)) {
    const id = slug.split("/")[1]!;
    const file = await readReportPdf(requireActor(actor), id);
    return new Response(new Uint8Array(file.bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file.filename}"` },
    });
  }
  // Browser links go through /open, which checks access and redirects to a five-minute signed URL.
  if (req.method === "GET" && slug.match(/^reports\/[^/]+\/open$/)) {
    return redirectTo(await signedReportPdfPath(requireActor(actor), slug.split("/")[1]!));
  }
  if (req.method === "GET" && slug.match(/^report-files\/[^/]+\/open$/)) {
    return redirectTo(await signedReportFileLink(requireActor(actor), slug.split("/")[1]!));
  }
  if (req.method === "POST" && slug.match(/^reports\/[^/]+\/files$/)) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("UPLOAD", "Attach a file", 400);
    const row = await uploadReportFile(requireActor(actor), {
      reportId: slug.split("/")[1]!,
      kind: String(form.get("kind") ?? "OTHER") as ReportFileKind,
      bookingItemId: form.get("bookingItemId") ? String(form.get("bookingItemId")) : null,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return ok({ id: row.id, fileName: row.fileName, sizeBytes: row.sizeBytes }, 201);
  }
  if (req.method === "DELETE" && slug.match(/^report-files\/[^/]+$/)) {
    await removeReportFile(requireActor(actor), slug.split("/")[1]!);
    return ok({ removed: true });
  }
  if (req.method === "GET" && slug === "files/signed") {
    const fileToken = q.get("file");
    if (fileToken) {
      const link = readFileLink(fileToken);
      const file = await readReportFile(requireActor(actor), link.fileId);
      return new Response(new Uint8Array(file.bytes), {
        headers: { "Content-Type": file.contentType, "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    const token = q.get("token");
    if (!token) throw new DomainError("LINK_EXPIRED", "Missing file token", 401);
    const link = readReportLink(token);
    const file = await readReportPdf(requireActor(actor), link.reportId, link.version);
    return new Response(new Uint8Array(file.bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${file.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  if (req.method === "GET" && slug === "subscriptions") {
    const user = requireActor(actor);
    if (!user.activeTenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
    assertPermission(user, "tenant.read", user.activeTenantId);
    return ok(await subscriptionUsage(user.activeTenantId));
  }
  if (req.method === "POST" && slug === "subscriptions") {
    const body = z.object({ tier: z.string(), cycle: z.enum(["MONTHLY", "ANNUAL"]) }).parse(await readBody(req));
    return ok(await changePlan(requireActor(actor), body.tier, body.cycle));
  }
  if (req.method === "POST" && slug === "notifications/process") {
    if (req.headers.get("x-cron-secret") !== getEnv().CRON_SECRET) throw new DomainError("FORBIDDEN", "Cron secret is invalid", 401);
    const reminders = await enqueueBookingReminders();
    const delivery = await processNotificationQueue(50);
    const subscriptions = await refreshSubscriptionStates();
    return ok({ reminders, delivery, subscriptions });
  }
  if (req.method === "GET" && slug === "analytics/platform") {
    const user = requireActor(actor);
    assertPermission(user, "platform.read", null);
    return ok(await platformOverview(user));
  }
  if (req.method === "GET" && slug === "analytics/tenant") {
    return ok(await tenantAnalytics(requireActor(actor)));
  }
  if (req.method === "GET" && slug === "exports/bookings") {
    const csv = await exportBookingsCsv(requireActor(actor));
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=bookings.csv" } });
  }
  if (req.method === "GET" && slug === "patients/export") {
    return ok(await exportPatientData(requireActor(actor)));
  }
  if (req.method === "POST" && slug === "tickets") {
    const body = z.object({ subject: z.string().min(3), body: z.string().min(3), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional() }).parse(await readBody(req));
    return ok(await createTicket(requireActor(actor), body), 201);
  }
  if (req.method === "POST" && slug === "invitations") {
    const user = requireActor(actor);
    if (!user.activeTenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
    assertPermission(user, "staff.manage", user.activeTenantId);
    const body = z.object({ email: z.string().email(), roleKey: z.string(), branchId: z.string().uuid().nullable().optional() }).parse(await readBody(req));
    return ok(await createInvitation({ tenantId: user.activeTenantId, email: body.email, roleKey: body.roleKey, branchId: body.branchId, sentById: user.userId }), 201);
  }
  if (req.method === "POST" && slug.match(/^imaging\/studies\/[^/]+$/)) {
    const id = slug.split("/")[2]!;
    const body = z.object({ to: z.string() }).parse(await readBody(req));
    return ok(await transitionStudy(requireActor(actor), id, body.to as StudyStatus));
  }
  if (req.method === "GET" && slug.match(/^verification\/[^/]+$/)) {
    const file = await readVerification(requireActor(actor), slug.split("/")[1]!);
    const type = file.fileName.toLowerCase().endsWith(".png") ? "image/png" : file.fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
    return new Response(new Uint8Array(file.bytes), {
      headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"` },
    });
  }
  throw new DomainError("NOT_FOUND", "Unknown API route", 404);
}

async function entry(req: Request, ctx: { params: Promise<{ slug: string[] }> }) {
  const slug = (await ctx.params).slug.join("/");
  try {
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
      if (!originExempt.has(slug)) assertSameOrigin(req);
      if (!csrfExempt.has(slug)) await assertCsrf(req);
    }
    const session = await currentSession();
    return await dispatch(req, slug, session);
  } catch (error) {
    return fail(error);
  }
}

export const GET = entry;
export const POST = entry;
export const DELETE = entry;
