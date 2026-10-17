import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { doctorRestricted, getBooking } from "@/lib/services/booking";
import { listRescheduleSlots } from "@/lib/services/scan-rooms";
import { listBookingReports } from "@/lib/services/report-files";
import { BookingView } from "@/components/booking-view";
import { DomainError } from "@/lib/errors";
import { Gate } from "@/components/guard";
import { integrationAction } from "@/server/actions";
import { Panel } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";

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
    const slots = day ? await listRescheduleSlots(booking, day) : [];
    const referralOnly = doctorRestricted(actor, booking.tenantId);
    return (
      <>
        <BookingView
          reports={await listBookingReports(actor, booking)}
          booking={booking}
          actor={actor}
          slots={slots}
          back={referralOnly ? "/console/doctor" : "/console/org/bookings"}
          crumbs={referralOnly
            ? [{ href: "/console/doctor", label: "Referrals" }, { label: booking.publicCode }]
            : [{ href: "/console/org", label: "Overview" }, { href: "/console/org/bookings", label: "Bookings" }, { label: booking.publicCode }]}
          extra={referralOnly ? undefined : (
            <Panel title="Send to other systems" description="Queues a message; your IT team delivers it.">
              <div className="flex flex-wrap gap-2">
                <form action={integrationAction}>
                  <input type="hidden" name="mode" value="hl7" />
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>Queue HL7 order</button>
                </form>
                <form action={integrationAction}>
                  <input type="hidden" name="mode" value="fhir" />
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>Queue FHIR bundle</button>
                </form>
              </div>
            </Panel>
          )}
        />
      </>
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
}
