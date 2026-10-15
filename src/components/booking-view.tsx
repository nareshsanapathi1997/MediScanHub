import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { BOOKING_TRANSITIONS } from "@/domain/state";
import { hasPermission, type Actor } from "@/domain/actor";
import { bookingTransitionAction, payAction, rescheduleAction } from "@/server/actions";
import { formatInr, formatWhen } from "@/lib/format";
import { Breadcrumbs, StatusPill } from "@/components/widgets";
import { FormBox } from "@/components/form-box";
import { ConfirmForm } from "@/components/confirm-form";
import type { getBooking } from "@/lib/services/booking";

type Booking = NonNullable<Awaited<ReturnType<typeof getBooking>>>;

export function BookingView({
  booking,
  actor,
  slots,
  back,
  crumbs,
}: {
  booking: Booking;
  actor: Actor;
  slots: Array<{ id: string; startsAt: Date }>;
  back: string;
  crumbs: Array<{ href?: string; label: string }>;
}) {
  const mine = actor.patientId === booking.patientId;
  const staff = hasPermission(actor, "bookings.manage", booking.tenantId);
  const canDownloadRx = Boolean(booking.prescriptionStorageKey) && (mine || staff || hasPermission(actor, "bookings.read", booking.tenantId));
  const next = BOOKING_TRANSITIONS[booking.status].filter((status) => {
    if (mine && !staff) return status === "CANCELLED" && ["PENDING", "CONFIRMED"].includes(booking.status);
    if (status === "CANCELLED") return hasPermission(actor, "bookings.cancel", booking.tenantId);
    if (status === "REFUNDED") return hasPermission(actor, "payments.refund", booking.tenantId);
    return staff;
  });
  const payable = booking.status === "PENDING" && mine && booking.invoice && booking.invoice.status !== "PAID";
  const visitFor = booking.dependent
    ? `${booking.dependent.name} (${booking.dependent.relation}) · booked by ${booking.patient.user.name}`
    : booking.patient.user.name;
  return (
    <div className="grid gap-6">
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{booking.tenant.name}</p>
          <h1 className="font-display text-4xl">{booking.publicCode}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{booking.branch.name} · {formatWhen(booking.scheduledAt)} · {booking.visitType.replaceAll("_", " ").toLowerCase()}</p>
        </div>
        <StatusPill value={booking.status} />
      </div>
      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-2xl">Services</h2>
        {booking.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>{item.name}</span>
            <span>{formatInr(item.pricePaise)}</span>
          </div>
        ))}
        <p className="text-right font-medium">Catalog total {formatInr(booking.totalPaise)}</p>
        {booking.invoice ? (
          <div className="grid gap-1 border-t pt-3 text-sm">
            <p>Invoice {booking.invoice.number} · {booking.invoice.status}</p>
            {booking.invoice.walletRedeemPaise > 0 ? <p className="text-muted-foreground">Wallet applied: {formatInr(booking.invoice.walletRedeemPaise)}</p> : null}
            <p className="font-medium">Amount due {formatInr(booking.invoice.totalPaise)}</p>
            {booking.invoice.insurancePolicy ? (
              <p className="text-muted-foreground">
                Insurance: {booking.invoice.insurancePolicy.provider} · {booking.invoice.insurancePolicy.policyNumber}
                {booking.invoice.insurancePolicy.tpaName ? ` · TPA ${booking.invoice.insurancePolicy.tpaName}` : ""}
              </p>
            ) : null}
            {booking.invoice.tpaReference ? <p className="text-muted-foreground">TPA reference: {booking.invoice.tpaReference}</p> : null}
            {booking.invoice.tpaClaims?.length ? (
              <p className="text-muted-foreground">TPA claim: {booking.invoice.tpaClaims[0]!.status.toLowerCase()} · {formatInr(booking.invoice.tpaClaims[0]!.claimedPaise)}</p>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">Patient: {visitFor}</p>
        {staff && booking.patient.chronicConditions.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Chronic: {booking.patient.chronicConditions.map((row) => row.condition).join("; ")}
          </p>
        ) : null}
        {booking.notes ? <p className="text-sm whitespace-pre-wrap">Notes: {booking.notes}</p> : null}
        {canDownloadRx ? (
          <p className="text-sm">
            Prescription: {booking.prescriptionFileName ?? "uploaded file"}{" "}
            <Link className="text-primary" href={`/api/v1/bookings/${booking.id}/prescription`}>Download</Link>
          </p>
        ) : null}
        {booking.address ? <p className="text-sm">Pickup: {booking.address}</p> : null}
        {booking.collection ? <p className="text-sm">Home collection {booking.collection.status.toLowerCase()}{booking.collection.assignee ? ` · ${booking.collection.assignee.name}` : ""}.</p> : null}
      </section>
      {payable ? (
        <FormBox action={payAction} submit="Pay and confirm" success="Payment captured.">
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="idempotencyKey" value={`pay-${booking.id}`} />
          <p className="text-sm text-muted-foreground">Pay {formatInr(booking.invoice!.totalPaise)}. The server creates the payment order and checks the signature.</p>
        </FormBox>
      ) : null}
      {next.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Move this visit</h2>
          <div className="flex flex-wrap gap-3">
            {next.map((status) => (
              <ConfirmForm key={status} action={bookingTransitionAction} confirm={`Move ${booking.publicCode} to ${status}?`} submit={labelFor(status)}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="to" value={status} />
                {status === "CANCELLED" || status === "REFUNDED" ? <input name="reason" required placeholder="Reason" className="h-10 rounded-lg border px-3" /> : null}
              </ConfirmForm>
            ))}
          </div>
        </section>
      ) : null}
      {["PENDING", "CONFIRMED"].includes(booking.status) && (mine || staff) ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Reschedule</h2>
          <form className="flex flex-wrap gap-2" method="get">
            <label className="field">Date<input type="date" name="day" /></label>
            <button className="h-10 self-end rounded-lg border px-3 text-sm" type="submit">Show slots</button>
          </form>
          {slots.length === 0 ? <p className="text-sm text-muted-foreground">Choose a date to see open slots.</p> : slots.map((slot) => (
            <ConfirmForm key={slot.id} action={rescheduleAction} confirm={`Move this visit to ${formatWhen(slot.startsAt)}?`} submit={formatWhen(slot.startsAt)}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="slotId" value={slot.id} />
            </ConfirmForm>
          ))}
        </section>
      ) : null}
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">History</h2>
        {booking.history.map((event) => (
          <p key={event.id} className="text-sm text-muted-foreground">{formatWhen(event.createdAt)} · {event.toStatus} · {event.actor?.name ?? "System"}{event.reason ? ` · ${event.reason}` : ""}</p>
        ))}
      </section>
      {booking.labOrder?.samples.length ? (
        <section>
          <h2 className="font-display text-2xl">Samples</h2>
          {booking.labOrder.samples.map((sample) => (
            <p key={sample.id} className="text-sm">{sample.barcode?.code ?? sample.id} · {sample.status}</p>
          ))}
        </section>
      ) : null}
      <Link href={back} className="text-sm text-primary">Back</Link>
    </div>
  );
}

function labelFor(status: BookingStatus) {
  if (status === "CHECKED_IN") return "Check in";
  if (status === "IN_PROGRESS") return "Start visit";
  if (status === "COMPLETED") return "Complete visit";
  if (status === "CANCELLED") return "Cancel";
  if (status === "REFUNDED") return "Mark refunded";
  return status.replaceAll("_", " ").toLowerCase();
}
