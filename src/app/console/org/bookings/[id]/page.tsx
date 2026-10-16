import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { getBooking } from "@/lib/services/booking";
import { listSlots } from "@/lib/services/catalog";
import { listBookingReports } from "@/lib/services/report-files";
import { BookingView } from "@/components/booking-view";
import { DomainError } from "@/lib/errors";
import { Gate } from "@/components/guard";
import { integrationAction } from "@/server/actions";

export const metadata = { title: "Booking" };

export default async function OrgBookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { actor } = await requireSession();
  const { id } = await params;
  const { day } = await searchParams;
  return (
    <Gate actor={actor} permission="bookings.read">
      <BookingBody id={id} day={day} />
    </Gate>
  );
}

async function BookingBody({ id, day }: { id: string; day?: string }) {
  const { actor } = await requireSession();
  try {
    const booking = await getBooking(actor, id);
    const slots = day ? await listSlots(booking.branchId, day, booking.visitType === "HOME_COLLECTION" ? "HOME" : "CENTER") : [];
    return (
      <>
        <BookingView
          reports={await listBookingReports(actor, booking)}
          booking={booking}
          actor={actor}
          slots={slots}
          back="/console/org/bookings"
          crumbs={[{ href: "/console/org", label: "Overview" }, { href: "/console/org/bookings", label: "Bookings" }, { label: booking.publicCode }]}
        />
        <section className="flex flex-wrap gap-2 text-sm">
          <form action={integrationAction}>
            <input type="hidden" name="mode" value="hl7" />
            <input type="hidden" name="bookingId" value={booking.id} />
            <button type="submit" className="h-9 rounded-lg border px-3">Queue HL7 order</button>
          </form>
          <form action={integrationAction}>
            <input type="hidden" name="mode" value="fhir" />
            <input type="hidden" name="bookingId" value={booking.id} />
            <button type="submit" className="h-9 rounded-lg border px-3">Queue FHIR bundle</button>
          </form>
        </section>
      </>
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
}
