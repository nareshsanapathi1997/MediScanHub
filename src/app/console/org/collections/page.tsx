import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { listStaff } from "@/lib/services/admin";
import { collectorAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, StatusPill, EmptyState } from "@/components/widgets";

export const metadata = { title: "Home collection" };

export default async function CollectionsPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="bookings.manage">
      <NeedTenant actor={actor}>
        <CollectionsBody />
      </NeedTenant>
    </Gate>
  );
}

async function CollectionsBody() {
  const { actor } = await requireSession();
  const [bookings, staff] = await Promise.all([
    listBookings(actor, { pageSize: 50 }),
    listStaff(actor),
  ]);
  const phlebotomists = staff.filter((member) => member.role.key === "PHLEBOTOMIST");
  const rows = bookings.rows.filter((booking) => booking.collection);
  return (
    <>
      <PageHeader eyebrow="Logistics" title="Home collection" description="Assign a phlebotomist who belongs to this center. They mark the visit en route and collected from the laboratory desk." />
      {rows.length === 0 ? <EmptyState title="No home visits" body="Home collection bookings appear here after a patient chooses a home slot." /> : rows.map((booking) => (
        <article key={booking.id} className="grid gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{booking.publicCode}</h2>
            <StatusPill value={booking.collection?.status ?? "REQUESTED"} />
          </div>
          <p className="text-sm">{booking.patient.user.name} · {booking.address} · {formatWhen(booking.scheduledAt)}</p>
          {booking.collection?.status === "REQUESTED" ? (
            <form action={collectorAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <select name="assigneeId" className="h-10 rounded-lg border bg-background px-2" required>
                {phlebotomists.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
              </select>
              <button className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground" type="submit">Assign</button>
            </form>
          ) : <p className="text-sm text-muted-foreground">Assigned to {booking.collection?.assignee?.name ?? "a collector"}.</p>}
        </article>
      ))}
    </>
  );
}
