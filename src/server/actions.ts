"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DomainError, errorMessage } from "@/lib/errors";
import { assertPermission, homeFor } from "@/domain/actor";
import { login, registerPatient, registerCenter, requestPasswordReset, resetPassword, acceptInvitation, createInvitation, revokeSession, switchTenant, changePassword } from "@/lib/services/auth";
import { createBooking, createWalkIn, transitionBooking, rescheduleBooking, assignCollector, transitionCollection } from "@/lib/services/booking";
import { applyWalletToInvoice, createPaymentOrder, verifyCheckoutPayment, recordManualPayment, refundPayment } from "@/lib/services/billing";
import { submitTpaClaim, transitionTpaClaim } from "@/lib/services/tpa-claims";
import { paymentProvider, mockCheckoutSignature } from "@/lib/adapters/payment";
import { randomToken } from "@/lib/crypto";
import { assignSampleTechnician, transitionSample, enterResults, transitionReport } from "@/lib/services/lab";
import { checkInImaging, scheduleEquipment, transitionStudy, saveEquipment } from "@/lib/services/imaging";
import { createBranch, createSlots, savePackage, saveService, setServicePrice, updateBranch, updateTenantProfile } from "@/lib/services/catalog";
import { cancelSubscription, changePlan, refreshSubscriptionStates, updatePlanPrice } from "@/lib/services/subscription";
import { createPublicTicket, createTicket, decideTenant, requestDeletion, setUserStatus, updateOwnProfile, updateTicket, uploadVerification } from "@/lib/services/admin";
import { enqueueBookingReminders, processNotificationQueue } from "@/lib/services/notify";
import {
  deleteChronicCondition,
  deleteDependent,
  deleteInsurance,
  markAllNotificationsRead,
  markNotificationRead,
  saveChronicCondition,
  saveDependent,
  saveInsurance,
} from "@/lib/services/patient-extras";
import { bootstrapSuperAdmin } from "@/lib/services/auth";
import { registerAbdmLink, sendFhirServiceRequest, sendHl7Order, transmitStudyToPacs } from "@/lib/services/integrations";
import { assertUpload, putObject } from "@/lib/adapters/storage";
import { clearSessionCookies, currentSession, requestMeta, setSessionCookies } from "@/server/session";
import type { BookingStatus, ReportStatus, SampleStatus, StudyStatus } from "@prisma/client";
import { PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from "@/lib/password-policy";
import { resolveGeoLabels } from "@/lib/services/geo";

export type ActionState = {
  error: string;
  devLink?: string | null;
  idle?: boolean;
  fields?: Record<string, string>;
  code?: string;
  /** When set, the error belongs next to this input name instead of the form banner. */
  field?: string;
};

function fieldForErrorCode(code: string | undefined) {
  if (code === "PASSWORD") return "password";
  if (code === "EMAIL_IN_USE") return "email";
  return undefined;
}

function pickFields(form: FormData, keys: string[], skip = new Set(["password"])) {
  const fields: Record<string, string> = {};
  for (const key of keys) {
    if (skip.has(key)) continue;
    fields[key] = String(form.get(key) ?? "");
  }
  return fields;
}

function formError(error: unknown, form?: FormData, keys?: string[]): ActionState {
  if (isRedirectError(error)) throw error;
  const code = error instanceof DomainError ? error.code : undefined;
  return {
    error: error instanceof DomainError ? error.message : errorMessage(error),
    code,
    field: fieldForErrorCode(code),
    ...(form && keys?.length ? { fields: pickFields(form, keys) } : {}),
  };
}

const REGISTER_FIELDS = ["name", "email", "phone", "dateOfBirth", "sex", "countryId", "stateId", "cityId", "country", "state", "city"] as const;
const CENTER_REGISTER_FIELDS = ["ownerName", "email", "phone", "centerName", "legalName", "slug", "countryId", "stateId", "cityId", "country", "city", "state", "address", "gstin"] as const;

async function actorOrThrow() {
  const session = await currentSession();
  if (!session) throw new DomainError("UNAUTHENTICATED", "Sign in required", 401);
  return session;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const result = await login({ email: text(form, "email"), password: String(form.get("password") ?? ""), ip: meta.ip, userAgent: meta.userAgent });
    await setSessionCookies(result.token, result.csrf);
    const next = text(form, "next");
    redirect(next.startsWith("/") && !next.startsWith("//") ? next : homeFor(result.actor));
  } catch (error) {
    return formError(error, form, ["email"]);
  }
}

export async function logoutAction() {
  const session = await currentSession();
  if (session) await revokeSession(session.sessionId, session.actor.userId);
  await clearSessionCookies();
  redirect("/");
}

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const password = String(form.get("password") ?? "");
    if (!passwordMeetsPolicy(password)) {
      throw new DomainError("PASSWORD", PASSWORD_POLICY_MESSAGE, 400);
    }
    const dobRaw = text(form, "dateOfBirth");
    const dateOfBirth = new Date(dobRaw);
    if (!dobRaw || Number.isNaN(dateOfBirth.getTime())) {
      throw new DomainError("VALIDATION", "Enter a valid date of birth.", 400);
    }
    if (!text(form, "phone")) {
      throw new DomainError("VALIDATION", "Phone number is required.", 400);
    }
    const countryId = Number(text(form, "countryId") || "0") || undefined;
    const stateId = Number(text(form, "stateId") || "0") || undefined;
    const cityId = Number(text(form, "cityId") || "0") || undefined;
    const geo = await resolveGeoLabels({ countryId, stateId, cityId });
    const city = text(form, "city") || geo.city;
    const state = text(form, "state") || geo.state;
    await registerPatient({
      name: text(form, "name"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      password,
      dateOfBirth,
      sex: text(form, "sex") as "FEMALE" | "MALE" | "INTERSEX" | "UNKNOWN",
      city: city || undefined,
      state: state || undefined,
      ip: meta.ip,
    });
    const result = await login({ email: text(form, "email"), password: String(form.get("password") ?? ""), ip: meta.ip, userAgent: meta.userAgent });
    await setSessionCookies(result.token, result.csrf);
    redirect("/console/patient");
  } catch (error) {
    return formError(error, form, [...REGISTER_FIELDS]);
  }
}

export async function forgotAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const result = await requestPasswordReset(text(form, "email"));
    await processNotificationQueue(10);
    return { error: "", devLink: result.devLink };
  } catch (error) {
    return formError(error, form, ["email"]);
  }
}

export async function recoverAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await resetPassword(text(form, "token"), String(form.get("password") ?? ""));
    redirect("/login?reset=1");
  } catch (error) {
    return formError(error);
  }
}

export async function centerRegisterAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const countryId = Number(text(form, "countryId") || "0") || undefined;
    const stateId = Number(text(form, "stateId") || "0") || undefined;
    const cityId = Number(text(form, "cityId") || "0") || undefined;
    const geo = await resolveGeoLabels({ countryId, stateId, cityId });
    const city = text(form, "city") || geo.city;
    const state = text(form, "state") || geo.state;
    if (!city || !state) {
      throw new DomainError("VALIDATION", "Select country, state, and city.", 400);
    }
    const created = await registerCenter({
      ownerName: text(form, "ownerName"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      password: String(form.get("password") ?? ""),
      centerName: text(form, "centerName"),
      legalName: text(form, "legalName"),
      slug: text(form, "slug"),
      city,
      state,
      address: text(form, "address"),
      gstin: text(form, "gstin"),
      ip: meta.ip,
    });
    const result = await login({ email: text(form, "email"), password: String(form.get("password") ?? ""), ip: meta.ip, userAgent: meta.userAgent });
    await setSessionCookies(result.token, result.csrf);
    redirect(`/console/org/verification?registered=${created.slug}`);
  } catch (error) {
    return formError(error, form, [...CENTER_REGISTER_FIELDS]);
  }
}

export async function contactAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await currentSession();
    if (session) {
      await createTicket(session.actor, { subject: text(form, "subject"), body: text(form, "body") });
    } else {
      const meta = await requestMeta();
      await createPublicTicket({ name: text(form, "name"), email: text(form, "email"), subject: text(form, "subject"), body: text(form, "body"), ip: meta.ip ?? undefined });
    }
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function checkoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    if (!form.get("consent")) throw new DomainError("CONSENT", "Consent is required before a booking is created", 400);
    let prescriptionStorageKey: string | undefined;
    let prescriptionFileName: string | undefined;
    const file = form.get("prescription");
    if (file instanceof File && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const meta = assertUpload(bytes, file.name);
      prescriptionFileName = file.name;
      prescriptionStorageKey = `patients/${session.actor.patientId}/prescriptions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
      await putObject(prescriptionStorageKey, bytes, meta.contentType);
    }
    const walletRupees = Number(text(form, "walletRupees") || "0");
    const walletRedeemPaise = Number.isFinite(walletRupees) && walletRupees > 0 ? Math.round(walletRupees * 100) : undefined;
    const result = await createBooking(session.actor, {
      branchId: text(form, "branchId"),
      slotId: text(form, "slotId") || undefined,
      serviceIds: text(form, "serviceIds").split(",").filter(Boolean),
      packageIds: text(form, "packageIds").split(",").filter(Boolean),
      visitType: text(form, "visitType") as "CENTER_VISIT" | "HOME_COLLECTION",
      address: text(form, "address"),
      notes: text(form, "notes"),
      idempotencyKey: text(form, "idempotencyKey"),
      referralEmail: text(form, "referralEmail"),
      dependentId: text(form, "dependentId") || undefined,
      prescriptionStorageKey,
      prescriptionFileName,
      walletRedeemPaise,
      insurancePolicyId: text(form, "insurancePolicyId") || undefined,
      tpaReference: text(form, "tpaReference"),
    });
    await processNotificationQueue(20);
    redirect(`/bookings/${result.bookingId}`);
  } catch (error) {
    return formError(error);
  }
}

export async function payAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    const bookingId = text(form, "bookingId");
    const order = await createPaymentOrder(session.actor, bookingId, text(form, "idempotencyKey"));
    if (!order.orderId) throw new DomainError("PAYMENT", "Payment order was not created", 502);
    let paymentId = text(form, "paymentId");
    let signature = text(form, "signature");
    if (paymentProvider().name === "mock") {
      paymentId = paymentId || `pay_mock_${randomToken(8)}`;
      signature = mockCheckoutSignature(order.orderId, paymentId);
    }
    await verifyCheckoutPayment(session.actor, { orderId: order.orderId, paymentId, signature });
    await processNotificationQueue(20);
    revalidatePath(`/bookings/${bookingId}`);
    redirect(`/bookings/${bookingId}?paid=1`);
  } catch (error) {
    return formError(error);
  }
}

export async function bookingTransitionAction(form: FormData) {
  const session = await actorOrThrow();
  await transitionBooking(session.actor, text(form, "bookingId"), text(form, "to") as BookingStatus, text(form, "reason"));
  await processNotificationQueue(10);
  revalidatePath("/console");
}

export async function rescheduleAction(form: FormData) {
  const session = await actorOrThrow();
  await rescheduleBooking(session.actor, text(form, "bookingId"), text(form, "slotId"));
  await processNotificationQueue(10);
  revalidatePath("/console");
}

export async function walkInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    const serviceIds = form.getAll("serviceIds").map(String).filter(Boolean);
    if (serviceIds.length === 0) {
      const single = text(form, "serviceIds");
      if (single) serviceIds.push(single);
    }
    const packageIds = form.getAll("packageIds").map(String).filter(Boolean);
    if (serviceIds.length === 0 && packageIds.length === 0) throw new DomainError("CATALOG", "Choose at least one service or package", 400);
    const result = await createWalkIn(session.actor, {
      branchId: text(form, "branchId"),
      serviceIds,
      packageIds,
      visitType: "WALK_IN",
      idempotencyKey: text(form, "idempotencyKey") || randomToken(8),
      patient: {
        name: text(form, "name"),
        email: text(form, "email"),
        phone: text(form, "phone"),
        dateOfBirth: new Date(text(form, "dateOfBirth")),
        sex: text(form, "sex") as "FEMALE" | "MALE",
      },
    });
    await processNotificationQueue(10);
    redirect(`/console/org/bookings/${result.bookingId}`);
  } catch (error) {
    return formError(error);
  }
}

export async function sampleAction(form: FormData) {
  const session = await actorOrThrow();
  await transitionSample(session.actor, text(form, "sampleId"), text(form, "to") as SampleStatus, text(form, "reason"));
  revalidatePath("/console/lab");
}

export async function assignSampleAction(form: FormData) {
  const session = await actorOrThrow();
  await assignSampleTechnician(session.actor, text(form, "sampleId"), text(form, "assigneeId"));
  revalidatePath("/console/lab");
}

export async function resultsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    const sampleId = text(form, "sampleId");
    const values = text(form, "parameterIds").split(",").filter(Boolean).map((parameterId) => ({
      parameterId,
      numericValue: text(form, `n:${parameterId}`) ? Number(text(form, `n:${parameterId}`)) : undefined,
      textValue: text(form, `t:${parameterId}`) || undefined,
    }));
    await enterResults(session.actor, sampleId, values);
    revalidatePath(`/console/lab/samples/${sampleId}`);
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function reportAction(form: FormData) {
  const session = await actorOrThrow();
  await transitionReport(session.actor, text(form, "reportId"), text(form, "to") as ReportStatus, text(form, "comment"));
  await processNotificationQueue(10);
  revalidatePath("/console/lab");
}

export async function inviteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    if (!session.actor.activeTenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
    assertPermission(session.actor, "staff.manage", session.actor.activeTenantId);
    const created = await createInvitation({
      tenantId: session.actor.activeTenantId,
      email: text(form, "email"),
      roleKey: text(form, "roleKey"),
      branchId: text(form, "branchId") || null,
      sentById: session.actor.userId,
    });
    await processNotificationQueue(5);
    return { error: "", devLink: created.link };
  } catch (error) {
    return formError(error);
  }
}

export async function acceptInviteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await acceptInvitation({ token: text(form, "token"), name: text(form, "name"), password: String(form.get("password") ?? "") });
    redirect("/login?invited=1");
  } catch (error) {
    return formError(error);
  }
}

export async function branchAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await createBranch(session.actor, {
      name: text(form, "name"),
      code: text(form, "code"),
      address: text(form, "address"),
      city: text(form, "city"),
      state: text(form, "state"),
      phone: text(form, "phone"),
      homeCollection: form.get("homeCollection") === "on",
      opensAt: text(form, "opensAt") || "07:00",
      closesAt: text(form, "closesAt") || "20:00",
    });
    revalidatePath("/console/org/branches");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function hoursAction(form: FormData) {
  const session = await actorOrThrow();
  await updateBranch(session.actor, text(form, "branchId"), { opensAt: text(form, "opensAt"), closesAt: text(form, "closesAt"), homeCollection: form.get("homeCollection") === "on" });
  revalidatePath("/console/org/branches");
}

export async function slotAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await createSlots(session.actor, {
      branchId: text(form, "branchId"),
      kind: text(form, "kind") as "CENTER" | "HOME" | "IMAGING",
      date: text(form, "date"),
      times: text(form, "times").split(",").map((item) => item.trim()).filter(Boolean),
      capacity: Number(text(form, "capacity") || "1"),
    });
    revalidatePath("/console/org/schedule");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function priceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await setServicePrice(session.actor, {
      branchId: text(form, "branchId"),
      serviceId: text(form, "serviceId"),
      pricePaise: Math.round(Number(text(form, "rupees")) * 100),
      discountPaise: Math.round(Number(text(form, "discount") || "0") * 100),
    });
    revalidatePath("/console/org/pricing");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function serviceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await saveService(session.actor, {
      categoryId: text(form, "categoryId"),
      name: text(form, "name"),
      slug: text(form, "slug"),
      code: text(form, "code"),
      kind: text(form, "kind") as "LAB" | "IMAGING",
      description: text(form, "description"),
      sampleType: text(form, "sampleType"),
      preparation: text(form, "preparation"),
      tatHours: Number(text(form, "tatHours") || "24"),
      modality: text(form, "modality"),
      published: form.get("published") === "on",
    });
    revalidatePath("/console/org/catalog");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function packageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await savePackage(session.actor, {
      name: text(form, "name"),
      slug: text(form, "slug"),
      description: text(form, "description"),
      pricePaise: Math.round(Number(text(form, "rupees")) * 100),
      serviceIds: form.getAll("serviceId").map(String),
      published: form.get("published") === "on",
    });
    revalidatePath("/console/org/packages");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function planAction(form: FormData) {
  const session = await actorOrThrow();
  await changePlan(session.actor, text(form, "tier"), text(form, "cycle") as "MONTHLY" | "ANNUAL");
  revalidatePath("/console/org/subscription");
}

export async function cancelPlanAction() {
  const session = await actorOrThrow();
  await cancelSubscription(session.actor);
  revalidatePath("/console/org/subscription");
}

export async function decisionAction(form: FormData) {
  const session = await actorOrThrow();
  await decideTenant(session.actor, text(form, "tenantId"), text(form, "decision") as "APPROVE" | "REJECT" | "SUSPEND" | "REACTIVATE", text(form, "notes"));
  await processNotificationQueue(5);
  revalidatePath("/console/admin");
}

export async function userStatusAction(form: FormData) {
  const session = await actorOrThrow();
  await setUserStatus(session.actor, text(form, "userId"), text(form, "status") as "ACTIVE" | "SUSPENDED" | "DISABLED");
  revalidatePath("/console/admin/users");
}

export async function ticketAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    if (text(form, "ticketId")) {
      await updateTicket(session.actor, text(form, "ticketId"), text(form, "status") as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED", text(form, "resolution"));
    } else {
      await createTicket(session.actor, { subject: text(form, "subject"), body: text(form, "body"), priority: (text(form, "priority") || "NORMAL") as "NORMAL" });
    }
    revalidatePath("/console/admin/tickets");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function refundAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await refundPayment(session.actor, text(form, "paymentId"), Math.round(Number(text(form, "rupees")) * 100), text(form, "reason"));
    revalidatePath("/console/finance");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function manualPayAction(form: FormData) {
  const session = await actorOrThrow();
  await recordManualPayment(session.actor, text(form, "invoiceId"), text(form, "reason") || "Desk collection");
  await processNotificationQueue(10);
  revalidatePath("/console/finance");
}

export async function walletRedeemAction(form: FormData) {
  const session = await actorOrThrow();
  const rupees = Number(text(form, "rupees") || "0");
  await applyWalletToInvoice(session.actor, text(form, "invoiceId"), Math.round(rupees * 100), text(form, "reason") || "Desk wallet redemption");
  revalidatePath("/console/finance");
}

export async function tpaClaimAction(form: FormData) {
  const session = await actorOrThrow();
  const mode = text(form, "mode");
  if (mode === "submit") {
    await submitTpaClaim(session.actor, {
      invoiceId: text(form, "invoiceId"),
      claimedPaise: Math.round(Number(text(form, "rupees")) * 100),
      externalReference: text(form, "externalReference"),
      notes: text(form, "notes"),
    });
  } else {
    await transitionTpaClaim(session.actor, text(form, "claimId"), text(form, "to") as "APPROVED" | "PAID" | "REJECTED", {
      approvedPaise: text(form, "approvedRupees") ? Math.round(Number(text(form, "approvedRupees")) * 100) : undefined,
      paidPaise: text(form, "paidRupees") ? Math.round(Number(text(form, "paidRupees")) * 100) : undefined,
      notes: text(form, "notes"),
    });
  }
  revalidatePath("/console/finance");
}

export async function collectorAction(form: FormData) {
  const session = await actorOrThrow();
  await assignCollector(session.actor, text(form, "bookingId"), text(form, "assigneeId"));
  await processNotificationQueue(5);
  revalidatePath("/console/org/collections");
}

export async function collectionAction(form: FormData) {
  const session = await actorOrThrow();
  await transitionCollection(session.actor, text(form, "bookingId"), text(form, "to") as "EN_ROUTE" | "COLLECTED" | "FAILED");
  revalidatePath("/console/lab");
}

export async function imagingAction(form: FormData) {
  const session = await actorOrThrow();
  if (text(form, "mode") === "checkin") await checkInImaging(session.actor, text(form, "orderId"));
  else await transitionStudy(session.actor, text(form, "studyId"), text(form, "to") as StudyStatus);
  revalidatePath("/console/imaging");
}

export async function equipmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await saveEquipment(session.actor, { branchId: text(form, "branchId"), name: text(form, "name"), modality: text(form, "modality"), room: text(form, "room") });
    revalidatePath("/console/imaging");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function verificationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("UPLOAD", "Choose a PDF or image", 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadVerification(session.actor, text(form, "documentType"), file.name, bytes);
    revalidatePath("/console/org/verification");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function profileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await updateOwnProfile(session.actor, { name: text(form, "name"), phone: text(form, "phone"), address: text(form, "address"), city: text(form, "city"), emergencyContact: text(form, "emergencyContact") });
    if (text(form, "currentPassword")) await changePassword(session.actor.userId, String(form.get("currentPassword") ?? ""), String(form.get("nextPassword") ?? ""));
    revalidatePath("/console/patient/profile");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function deleteAccountAction() {
  const session = await actorOrThrow();
  await requestDeletion(session.actor);
  await clearSessionCookies();
  redirect("/?deleted=1");
}

export async function switchTenantAction(form: FormData) {
  const session = await actorOrThrow();
  const tenantId = text(form, "tenantId") || null;
  await switchTenant(session.sessionId, session.actor, tenantId);
  redirect("/console");
}

export async function pumpNotificationsAction() {
  const session = await actorOrThrow();
  if (!session.actor.isSuperAdmin) throw new DomainError("FORBIDDEN", "Only a super admin can run the delivery worker", 403);
  await enqueueBookingReminders();
  await processNotificationQueue(50);
  await refreshSubscriptionStates();
  revalidatePath("/console/admin/notifications");
}

export async function scheduleEquipmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    const date = text(form, "date");
    await scheduleEquipment(session.actor, {
      equipmentId: text(form, "equipmentId"),
      staffUserId: text(form, "staffUserId") || undefined,
      startsAt: new Date(`${date}T${text(form, "start")}:00+05:30`),
      endsAt: new Date(`${date}T${text(form, "end")}:00+05:30`),
    });
    revalidatePath("/console/imaging");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function revokeListedSessionAction(form: FormData) {
  const session = await actorOrThrow();
  const sessionId = text(form, "sessionId");
  if (sessionId === session.sessionId) throw new DomainError("SESSION", "Use sign out to end the current session", 400);
  await revokeSession(sessionId, session.actor.userId);
  revalidatePath("/console/account");
}

export async function tenantProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await updateTenantProfile(session.actor, {
      name: text(form, "name"),
      phone: text(form, "phone"),
      about: text(form, "about"),
      address: text(form, "address"),
      city: text(form, "city"),
      brandColor: text(form, "brandColor"),
      accentColor: text(form, "accentColor"),
      logoUrl: text(form, "logoUrl"),
      coverImageUrl: text(form, "coverImageUrl"),
      galleryUrls: text(form, "galleryUrls"),
      customDomain: text(form, "customDomain"),
    });
    revalidatePath("/console/org");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function editPlanAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    const empty = (key: string) => (text(form, key) === "" ? null : Number(text(form, key)));
    await updatePlanPrice(session.actor, text(form, "planId"), Math.round(Number(text(form, "monthly")) * 100), Math.round(Number(text(form, "annual")) * 100), empty("maxBranches"), empty("maxUsers"), empty("maxBookings"));
    revalidatePath("/console/admin/plans");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function patientTicketAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await createTicket(session.actor, { subject: text(form, "subject"), body: text(form, "body"), priority: (text(form, "priority") || "NORMAL") as "NORMAL" });
    revalidatePath("/console/patient/support");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function deleteDependentAction(form: FormData) {
  const session = await actorOrThrow();
  await deleteDependent(session.actor, text(form, "id"));
  revalidatePath("/console/patient/family");
}

export async function dependentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await saveDependent(session.actor, {
      name: text(form, "name"),
      dateOfBirth: new Date(text(form, "dateOfBirth")),
      sex: text(form, "sex") as "FEMALE" | "MALE" | "INTERSEX" | "UNKNOWN",
      relation: text(form, "relation"),
    });
    revalidatePath("/console/patient/family");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function deleteChronicAction(form: FormData) {
  const session = await actorOrThrow();
  await deleteChronicCondition(session.actor, text(form, "id"));
  revalidatePath("/console/patient/chronic");
}

export async function chronicAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await saveChronicCondition(session.actor, { condition: text(form, "condition"), since: text(form, "since") ? new Date(text(form, "since")) : undefined, notes: text(form, "notes") });
    revalidatePath("/console/patient/chronic");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function deleteInsuranceAction(form: FormData) {
  const session = await actorOrThrow();
  await deleteInsurance(session.actor, text(form, "id"));
  revalidatePath("/console/patient/insurance");
}

export async function insuranceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const session = await actorOrThrow();
    await saveInsurance(session.actor, {
      provider: text(form, "provider"),
      policyNumber: text(form, "policyNumber"),
      tpaName: text(form, "tpaName"),
      validUntil: text(form, "validUntil") ? new Date(text(form, "validUntil")) : undefined,
    });
    revalidatePath("/console/patient/insurance");
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function notificationReadAction(form: FormData) {
  const session = await actorOrThrow();
  const id = text(form, "id");
  if (id === "all") await markAllNotificationsRead(session.actor);
  else await markNotificationRead(session.actor, id);
  revalidatePath("/console/patient/notifications");
}

export async function bootstrapAdminAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await bootstrapSuperAdmin({
      name: text(form, "name"),
      email: text(form, "email"),
      password: String(form.get("password") ?? ""),
      secret: text(form, "secret"),
    });
    return { error: "" };
  } catch (error) {
    return formError(error);
  }
}

export async function pacsAction(form: FormData) {
  const session = await actorOrThrow();
  await transmitStudyToPacs(session.actor, text(form, "studyId"));
  revalidatePath("/console/imaging");
}

export async function integrationAction(form: FormData) {
  const session = await actorOrThrow();
  const mode = text(form, "mode");
  if (mode === "hl7") await sendHl7Order(session.actor, text(form, "bookingId"));
  if (mode === "fhir") await sendFhirServiceRequest(session.actor, text(form, "bookingId"));
  if (mode === "abdm") await registerAbdmLink(session.actor, text(form, "patientId"));
  revalidatePath("/console/org/integrations");
}

export async function cronWorkerAction() {
  await processNotificationQueue(50);
  await enqueueBookingReminders();
  await refreshSubscriptionStates();
}
