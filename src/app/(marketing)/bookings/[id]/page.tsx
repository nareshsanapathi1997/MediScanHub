import { notFound, redirect } from "next/navigation";
import { currentSession } from "@/server/session";
import { getBooking } from "@/lib/services/booking";
import { listRescheduleSlots } from "@/lib/services/scan-rooms";
import { listBookingReports } from "@/lib/services/report-files";
import { BookingView } from "@/components/booking-view";
import { DomainError } from "@/lib/errors";

export const metadata = { title: "Booking" };

export default async function BookingConfirmationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; paid?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await currentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/bookings/${id}`)}`);
  let booking: Awaited<ReturnType<typeof getBooking>>;
  try {
    booking = await getBooking(session.actor, id);
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
  const slots = query.day ? await listRescheduleSlots(booking, query.day) : [];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {query.paid ? <p className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm">Payment captured. The visit is confirmed and the lab or imaging order is open.</p> : null}
      <BookingView
          reports={await listBookingReports(session.actor, booking)}
        booking={booking}
        actor={session.actor}
        slots={slots}
        back="/console/patient"
        crumbs={[{ href: "/", label: "Home" }, { href: "/console/patient", label: "My care" }, { label: booking.publicCode }]}
      />
    </main>
  );
}
