import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { BOOKING_TRANSITIONS } from "@/domain/state";
import { modalityLabel } from "@/domain/scan-scheduling";
import { hasPermission, type Actor } from "@/domain/actor";
import { bookingTransitionAction, payAction, rescheduleAction } from "@/server/actions";
import { formatInr, formatWhen, titleCase, sentenceCase } from "@/lib/format";
import { Building2, CalendarClock, Home, MapPin, ReceiptText } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, Facts, Panel, StatusPill, Steps } from "@/components/widgets";
import { FormBox } from "@/components/form-box";
import { ConfirmForm } from "@/components/confirm-form";
import type { getBooking } from "@/lib/services/booking";
import type { listBookingReports } from "@/lib/services/report-files";
import { ReportFileList } from "@/components/report-files";
import { buttonVariants } from "@/components/ui/button";
import { Download } from "@/components/icons";

type Booking = NonNullable<Awaited<ReturnType<typeof getBooking>>>;
type BookingReports = Awaited<ReturnType<typeof listBookingReports>>;

export function BookingView({
  booking,
  actor,
  slots,
  back,
  crumbs,
  reports = [],
  extra,
}: {
  extra?: React.ReactNode;
  booking: Booking;
  actor: Actor;
  reports?: BookingReports;
  slots: Array<{ id: string; startsAt: Date }>;
  back: string;
  crumbs: Array<{ href?: string; label: string }>;
}) {
  const mine = actor.patientId === booking.patientId;
  const staff = hasPermission(actor, "bookings.manage", booking.tenantId);
  const referralDoctor = booking.referralUserId === actor.userId && hasPermission(actor, "referrals.read", booking.tenantId);
  const canDownloadRx = Boolean(booking.prescriptionStorageKey) && (mine || staff || hasPermission(actor, "bookings.read", booking.tenantId));
  const next = BOOKING_TRANSITIONS[booking.status].filter((status) => {
    if (status === "REFUNDED") return false; // refunds go through Finance so money and status move together
    if (mine && !staff) return status === "CANCELLED" && ["PENDING", "CONFIRMED"].includes(booking.status);
    if (status === "CANCELLED") return hasPermission(actor, "bookings.cancel", booking.tenantId);
    return staff;
  });
  const payable = booking.status === "PENDING" && mine && booking.invoice && booking.invoice.status !== "PAID";
  const scanPrep = [...new Set(booking.items.filter((item) => item.service?.kind === "IMAGING" && item.service.preparation).map((item) => `${item.name}: ${item.service!.preparation}`))];
  const visitFor = booking.dependent
    ? `${booking.dependent.name} (${booking.dependent.relation}) · booked by ${booking.patient.user.name}`
    : booking.patient.user.name;
  const paid = booking.invoice?.status === "PAID";
  const reportsOpen = booking.status === "IN_PROGRESS";
  const canLab = hasPermission(actor, "samples.read", booking.tenantId) && actor.activeTenantId === booking.tenantId;
  const canReport = actor.activeTenantId === booking.tenantId && ["reports.verify", "imaging.report"].some((permission) => hasPermission(actor, permission, booking.tenantId));
  const releasedViewer = (mine || referralDoctor) && !staff && !canLab && !canReport;
  return (
    <div className="grid gap-6">
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{booking.tenant.name}</p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{booking.publicCode}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{booking.branch.name}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden />{formatWhen(booking.scheduledAt)}</span>
            <span className="inline-flex items-center gap-1.5">{booking.visitType === "HOME_COLLECTION" ? <Home className="size-4" aria-hidden /> : <Building2 className="size-4" aria-hidden />}{sentenceCase(booking.visitType)}</span>
          </p>
        </div>
        <StatusPill value={booking.status} />
      </div>
      <VisitSteps status={booking.status} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          {scanPrep.length || booking.slot?.equipment ? (
            <Panel title="Before your scan" description="Please read this before you come.">
              {booking.slot?.equipment ? (
                <p className="text-sm">
                  <span className="font-medium">{modalityLabel(booking.slot.equipment.modality)}</span> in {booking.slot.equipment.room} ({booking.slot.equipment.name}) · {formatTime(booking.slot.startsAt)} to {formatTime(booking.slot.endsAt)} IST
                </p>
              ) : null}
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm">
                {scanPrep.map((line) => <li key={line}>{line}</li>)}
                <li>Come 15 minutes before your slot. Bring your prescription and any old scans.</li>
              </ul>
            </Panel>
          ) : null}
          <Panel title="Services" description={`${booking.items.length} item${booking.items.length === 1 ? "" : "s"} · Patient: ${visitFor}`}>
            <ul className="divide-y text-sm">
              {booking.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2.5"><span>{item.name}</span><span className="tabular-nums">{formatInr(item.pricePaise)}</span></li>
              ))}
              <li className="flex justify-between gap-3 pt-3 font-semibold"><span>Total</span><span className="tabular-nums">{formatInr(booking.totalPaise)}</span></li>
            </ul>
            {booking.invoice ? (
              <div className="-mx-5 -mb-5 mt-4 grid gap-3 rounded-b-2xl border-t bg-muted/30 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground"><ReceiptText className="size-4" aria-hidden />Invoice <span className="font-mono text-foreground">{booking.invoice.number}</span></span>
                  <StatusPill value={booking.invoice.status} />
                </div>
                <Facts items={[
                  { label: booking.invoice.status === "PAID" ? "Amount paid" : "Amount due", value: formatInr(booking.invoice.totalPaise) },
                  ...(booking.invoice.walletRedeemPaise > 0 ? [{ label: "Wallet applied", value: formatInr(booking.invoice.walletRedeemPaise) }] : []),
                  ...(booking.invoice.insurancePolicy ? [{ label: "Insurance", value: `${booking.invoice.insurancePolicy.provider} · ${booking.invoice.insurancePolicy.policyNumber}${booking.invoice.insurancePolicy.tpaName ? ` · TPA ${booking.invoice.insurancePolicy.tpaName}` : ""}` }] : []),
                  ...(booking.invoice.tpaReference ? [{ label: "TPA reference", value: booking.invoice.tpaReference }] : []),
                  ...(booking.invoice.tpaClaims?.length ? [{ label: "TPA claim", value: `${sentenceCase(booking.invoice.tpaClaims[0]!.status)} · ${formatInr(booking.invoice.tpaClaims[0]!.claimedPaise)}` }] : []),
                ]} />
              </div>
            ) : <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><ReceiptText className="size-4" aria-hidden />Invoice pending</p>}
          </Panel>
          {reports.length > 0 || mine || referralDoctor ? (
            <Panel title="Reports" description={releasedViewer ? (referralDoctor ? "Released reports for patients who named you. Unreleased results stay hidden." : "Your reports appear here after the center releases them. Links open for 5 minutes and only for you.") : "Open a report to enter results, upload files or review."}>
              {reports.length === 0 ? <p className="text-sm text-muted-foreground">{referralDoctor ? "No released report yet for this visit." : "No report is ready yet. We will send you a message when it is."}</p> : (
                <ul className="grid gap-3">
                  {reports.map((report) => (
                    <li key={report.id} className="grid gap-2 rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{report.title}</span>
                        <StatusPill value={report.status} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canLab || canReport ? <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/lab/reports/${report.id}`}>Open report</a> : null}
                        {report.versions.length > 0 && (report.status === "RELEASED" || report.status === "AMENDED") ? (
                          <a className={buttonVariants({ size: "sm" })} href={`/api/v1/reports/${report.id}/open`} target="_blank" rel="noopener"><Download className="size-4" aria-hidden />Download report PDF</a>
                        ) : null}
                      </div>
                      {report.files.length > 0 ? <ReportFileList files={report.files} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
          {payable ? (
            <Panel title="Pay to confirm" description="The server creates the payment order and verifies the provider signature. A browser success flag alone is never trusted.">
              <FormBox action={payAction} submit={`Pay ${formatInr(booking.invoice?.totalPaise ?? booking.totalPaise)} and confirm`} success="Payment captured.">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="idempotencyKey" value={`pay-${booking.id}`} />
              </FormBox>
            </Panel>
          ) : null}
          {next.length > 0 ? (
            <Panel title={mine && !staff ? "Manage your visit" : "Next step"} description={reportsOpen ? "A visit completes only after every report is released." : paid && next.includes("CANCELLED") ? "This visit is paid. After cancelling, issue the refund from Finance." : undefined}>
              <div className="flex flex-wrap gap-3">
                {next.map((status) => (
                  <ConfirmForm key={status} action={bookingTransitionAction} variant={status === "CANCELLED" ? "destructive" : "default"} confirm={status === "CANCELLED" ? `Cancel ${booking.publicCode}? The slot is released.` : `${labelFor(status)} for ${booking.publicCode}?`} submit={labelFor(status)}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="to" value={status} />
                    {status === "CANCELLED" ? <input name="reason" required minLength={3} aria-label="Cancellation reason" placeholder="Reason (required)" className="h-10 w-56 rounded-lg border bg-card px-3 text-sm" /> : null}
                  </ConfirmForm>
                ))}
              </div>
            </Panel>
          ) : null}
          {["PENDING", "CONFIRMED"].includes(booking.status) && (mine || staff) ? (
            <Panel title="Reschedule" description="Pick a date to see open slots at this branch. The old slot is released only when the new one is held.">
              <form className="flex flex-wrap items-end gap-2" method="get">
                <label className="field">Date<input type="date" name="day" required min={new Date().toISOString().slice(0, 10)} /></label>
                <Button variant="outline" className="h-11" type="submit">Show slots</Button>
              </form>
              {slots.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No open slots shown. Choose a date above.</p> : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {slots.filter((slot) => slot.id !== booking.slotId).map((slot) => (
                    <ConfirmForm key={slot.id} action={rescheduleAction} confirm={`Move this visit to ${formatWhen(slot.startsAt)}?`} submit={formatTime(slot.startsAt)}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="slotId" value={slot.id} />
                    </ConfirmForm>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}
        </div>
        <div className="grid content-start gap-4">
          <Panel title={booking.dependent ? "Patient (family member)" : "Patient"}>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{initialsOf(booking.dependent?.name ?? booking.patient.user.name)}</span>
                <span className="grid min-w-0"><span className="truncate font-medium">{booking.dependent?.name ?? booking.patient.user.name}</span>{booking.dependent ? <span className="text-xs text-muted-foreground">{booking.dependent.relation} of {booking.patient.user.name}</span> : null}</span>
              </div>
              {booking.address ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><span><span className="block text-xs text-muted-foreground">Pickup address</span>{booking.address}</span></p> : null}
              {booking.collection ? <p className="flex flex-wrap items-center gap-2"><Home className="size-4 text-muted-foreground" aria-hidden />Home collection <StatusPill value={booking.collection.status} />{booking.collection.assignee ? <span className="text-muted-foreground">· {booking.collection.assignee.name}</span> : null}</p> : null}
              {staff && booking.patient.chronicConditions.length > 0 ? <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs"><span className="font-medium">Chronic:</span> {booking.patient.chronicConditions.map((row) => row.condition).join("; ")}</p> : null}
              {booking.notes ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs whitespace-pre-wrap"><span className="font-medium">Notes:</span> {booking.notes}</p> : null}
              {canDownloadRx ? <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/v1/bookings/${booking.id}/prescription`}><Download className="size-4" aria-hidden />Prescription{booking.prescriptionFileName ? ` (${booking.prescriptionFileName})` : ""}</a> : null}
            </div>
          </Panel>
          {booking.labOrder?.samples.length ? (
            <Panel title="Samples">
              <ul className="grid gap-2 text-sm">
                {booking.labOrder.samples.map((sample) => (
                  <li key={sample.id} className="flex items-center justify-between gap-2">{canLab ? <Link className="font-mono text-xs font-medium text-primary underline-offset-2 hover:underline" href={`/console/lab/samples/${sample.id}`}>{sample.barcode?.code ?? "Open sample"}</Link> : <span className="font-mono text-xs">{sample.barcode?.code ?? "No barcode"}</span>}<StatusPill value={sample.status} /></li>
                ))}
              </ul>
            </Panel>
          ) : null}
          {booking.imagingOrder?.studies.length ? (
            <Panel title="Imaging">
              <ul className="grid gap-2 text-sm">
                {booking.imagingOrder.studies.map((study) => (
                  <li key={study.id} className="flex items-center justify-between gap-2"><span className="font-mono text-xs">{study.accession}</span><StatusPill value={study.status} /></li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <Panel title="Timeline">
            <ol className="relative grid gap-4 border-l pl-5 text-sm">
              {booking.history.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary ring-4 ring-card" aria-hidden />
                  <p className="font-medium">{titleCase(event.toStatus)}</p>
                  <p className="text-xs text-muted-foreground">{formatWhen(event.createdAt)} · {event.actor?.name ?? "System"}</p>
                  {event.reason ? <p className="mt-0.5 text-xs">{event.reason}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
          {extra}
          <Link href={back} className="text-sm font-medium text-primary">← Back</Link>
        </div>
      </div>
    </div>
  );
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function labelFor(status: BookingStatus) {
  if (status === "CHECKED_IN") return "Check in";
  if (status === "IN_PROGRESS") return "Start visit";
  if (status === "COMPLETED") return "Complete visit";
  if (status === "CANCELLED") return "Cancel visit";
  if (status === "CONFIRMED") return "Confirm";
  return status;
}

function initialsOf(name: string) {
  return name.replace(/^Synth(etic)?\s+(Patient\s+)?/i, "").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

const STEPS: Array<{ status: BookingStatus; label: string }> = [
  { status: "PENDING", label: "Booked" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "CHECKED_IN", label: "Checked in" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "COMPLETED", label: "Completed" },
];

/** Progress through the normal visit path. Cancelled, no-show and refunded visits show a single banner instead. */
function VisitSteps({ status }: { status: BookingStatus }) {
  const index = STEPS.findIndex((step) => step.status === status);
  if (index < 0) return <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">This visit is <span className="font-medium">{sentenceCase(status)}</span>.</p>;
  return <Steps label="Visit progress" steps={STEPS.map((step) => step.label)} current={index} complete={status === "COMPLETED"} />;
}
