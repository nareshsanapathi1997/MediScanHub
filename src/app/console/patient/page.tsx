import Link from "next/link";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { formatInr, formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, StatusPill, EmptyState } from "@/components/widgets";

export const metadata = { title: "My care" };

export default async function PatientHome() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <PatientBody />
    </Gate>
  );
}

async function PatientBody() {
  const { actor } = await requireSession();
  const patientActor = { ...actor, activeTenantId: null };
  const bookings = await listBookings(patientActor, { pageSize: 20 });
  return (
    <>
      <PageHeader eyebrow="Patient" title={`Hello, ${actor.name.split(" ")[0]}`} description="Appointments, released reports, and invoices for your own profile." actions={<Link className="text-sm text-primary" href="/tests">Book a test</Link>} />
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/console/patient/reports">Reports</Link>
        <Link href="/console/patient/invoices">Invoices</Link>
        <Link href="/console/patient/notifications">Inbox</Link>
        <Link href="/console/patient/reminders">Reminders</Link>
        <Link href="/console/patient/support">Support</Link>
        <Link href="/console/patient/family">Family</Link>
        <Link href="/console/patient/wallet">Wallet</Link>
        <Link href="/console/patient/insurance">Insurance</Link>
        <Link href="/console/patient/chronic">Chronic care</Link>
        <Link href="/console/account">Account</Link>
      </div>
      {bookings.rows.length === 0 ? <EmptyState title="No visits yet" body="Search a test and choose a slot. The price is confirmed on the server." action={<Link className="text-primary" href="/centers">Browse centers</Link>} /> : (
        <div className="grid gap-3">
          {bookings.rows.map((booking) => (
            <Link key={booking.id} href={`/bookings/${booking.id}`} className="flex items-center justify-between rounded-2xl border bg-card p-4">
              <span>
                <span className="block font-medium">{booking.publicCode} · {booking.tenant.name}</span>
                <span className="text-sm text-muted-foreground">{formatWhen(booking.scheduledAt)} · {formatInr(booking.totalPaise)}</span>
              </span>
              <StatusPill value={booking.status} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
