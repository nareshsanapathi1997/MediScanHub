import Link from "next/link";
import { randomUUID } from "crypto";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { listAccessibleBranches, listBookablePackages, listBookableServices } from "@/lib/services/catalog";
import { walkInAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, StatusPill, EmptyState } from "@/components/widgets";

export const metadata = { title: "Front desk" };

export default async function DeskPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="bookings.manage">
      <NeedTenant actor={actor}>
        <DeskBody />
      </NeedTenant>
    </Gate>
  );
}

async function DeskBody() {
  const { actor } = await requireSession();
  const [bookings, branches, services, packages] = await Promise.all([
    listBookings(actor, { pageSize: 20 }),
    listAccessibleBranches(actor),
    listBookableServices(actor),
    listBookablePackages(actor),
  ]);
  const today = new Date().toDateString();
  const due = bookings.rows.filter((booking) => new Date(booking.scheduledAt).toDateString() === today || ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status));
  return (
    <>
      <PageHeader eyebrow="Reception" title="Front desk" description="Walk-ins are confirmed immediately and open a lab or imaging order. Online visits stay pending until payment is captured." />
      {due.length === 0 ? <EmptyState title="The board is clear" body="No pending or today's visits in your branches." /> : (
        <div className="grid gap-2">
          {due.map((booking) => (
            <Link key={booking.id} href={`/console/org/bookings/${booking.id}`} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
              <span>{booking.publicCode} · {booking.patient.user.name} · {formatWhen(booking.scheduledAt)}</span>
              <StatusPill value={booking.status} />
            </Link>
          ))}
        </div>
      )}
      <FormBox action={walkInAction} submit="Record walk-in">
        <label className="field">Branch
          <select name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        </label>
        <label className="field">Patient name<input name="name" required /></label>
        <label className="field">Email<input name="email" type="email" required /></label>
        <label className="field">Phone<input name="phone" required /></label>
        <label className="field">Date of birth<input name="dateOfBirth" type="date" required /></label>
        <label className="field">Sex
          <select name="sex" defaultValue="FEMALE"><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="INTERSEX">Intersex</option><option value="UNKNOWN">Unknown</option></select>
        </label>
        <label className="field">Services (hold Ctrl to pick multiple)
          <select name="serviceIds" multiple className="min-h-32">{services.filter((service) => service.published).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
        </label>
        <label className="field">Packages (optional, hold Ctrl for multiple)
          <select name="packageIds" multiple className="min-h-24">{packages.filter((pkg) => pkg.published).map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}</select>
        </label>
        <p className="text-xs text-muted-foreground">Pick at least one service or one package.</p>
        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
      </FormBox>
    </>
  );
}
