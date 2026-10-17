import type { BookingStatus, CollectionStatus, ImagingOrderStatus, ReportStatus, SampleStatus, StudyStatus } from "@prisma/client";
import { DomainError } from "@/lib/errors";

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

export const SAMPLE_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  PENDING: ["COLLECTED", "REJECTED"],
  COLLECTED: ["IN_TRANSIT", "RECEIVED", "REJECTED"],
  IN_TRANSIT: ["RECEIVED", "REJECTED"],
  RECEIVED: ["PROCESSING", "REJECTED"],
  PROCESSING: ["RESULTED", "REJECTED"],
  RESULTED: [],
  REJECTED: ["RECOLLECTION"],
  RECOLLECTION: ["PENDING"],
};

export const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT: ["ENTERED"],
  ENTERED: ["VERIFIED", "REJECTED"],
  VERIFIED: ["APPROVED", "REJECTED"],
  APPROVED: ["RELEASED"],
  RELEASED: ["AMENDED"],
  AMENDED: ["ENTERED"],
  REJECTED: ["ENTERED"],
};

export const IMAGING_TRANSITIONS: Record<ImagingOrderStatus, ImagingOrderStatus[]> = {
  SCHEDULED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["REPORTED"],
  REPORTED: [],
  CANCELLED: [],
};

export const STUDY_TRANSITIONS: Record<StudyStatus, StudyStatus[]> = {
  SCHEDULED: ["ACQUIRED", "CANCELLED"],
  ACQUIRED: ["REPORTED", "CANCELLED"],
  REPORTED: [],
  CANCELLED: [],
};

export const COLLECTION_TRANSITIONS: Record<CollectionStatus, CollectionStatus[]> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["COLLECTED", "FAILED", "CANCELLED"],
  COLLECTED: [],
  CANCELLED: [],
  FAILED: ["REQUESTED"],
};

const REPORT_PERMISSION: Partial<Record<ReportStatus, string>> = {
  ENTERED: "results.enter",
  VERIFIED: "reports.verify",
  APPROVED: "reports.approve",
  RELEASED: "reports.release",
  AMENDED: "reports.approve",
  REJECTED: "reports.verify",
};

export function assertTransition<S extends string>(machine: Record<S, S[]>, from: S, to: S, label: string) {
  if (!machine[from]?.includes(to)) {
    throw new DomainError("INVALID_TRANSITION", `${label} cannot move from ${from} to ${to}`, 409);
  }
}

/** Imaging-only reports are written by radiology, so submitting one needs imaging.report instead of results.enter. */
export function permissionForReportTransition(to: ReportStatus, imagingOnly = false) {
  if (imagingOnly && to === "ENTERED") return "imaging.report";
  return REPORT_PERMISSION[to] ?? "reports.approve";
}

export function permissionForBookingTransition(to: BookingStatus) {
  if (to === "CANCELLED") return "bookings.cancel";
  if (to === "REFUNDED") return "payments.refund";
  return "bookings.manage";
}

export function permissionForSampleTransition(to: SampleStatus) {
  if (to === "COLLECTED" || to === "IN_TRANSIT" || to === "RECOLLECTION") return "samples.collect";
  return "results.enter";
}
