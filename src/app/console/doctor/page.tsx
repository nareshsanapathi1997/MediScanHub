import Link from "next/link";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, EmptyState, StatusPill } from "@/components/widgets";

export const metadata = { title: "Referrals" };

export default async function DoctorPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="referrals.read">
      <DoctorBody />
    </Gate>
  );
}

async function DoctorBody() {
  const { actor } = await requireSession();
  const bookings = await listBookings(actor, { pageSize: 50 });
  return (
    <>
      <PageHeader eyebrow="Referrals" title="Patients who named you" description="You only see bookings where the patient entered your email. Other visits at this center stay hidden." />
      {bookings.rows.length === 0 ? <EmptyState title="No referrals" body="When a patient adds your email at checkout, the visit appears here." /> : bookings.rows.map((booking) => (
        <Link key={booking.id} href={`/console/org/bookings/${booking.id}`} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
          <span>{booking.publicCode} · {booking.patient.user.name} · {formatWhen(booking.scheduledAt)}</span>
          <StatusPill value={booking.status} />
        </Link>
      ))}
    </>
  );
}
