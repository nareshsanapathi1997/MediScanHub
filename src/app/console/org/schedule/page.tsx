import { requireSession } from "@/server/session";
import { listAccessibleBranches } from "@/lib/services/catalog";
import { slotAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";
import { withScope } from "@/lib/scope";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="bookings.manage">
      <NeedTenant actor={actor}>
        <ScheduleBody />
      </NeedTenant>
    </Gate>
  );
}

async function ScheduleBody() {
  const { actor } = await requireSession();
  const branches = await listAccessibleBranches(actor);
  const slots = await withScope({ tenantId: actor.activeTenantId, userId: actor.userId }, (tx) =>
    tx.availabilitySlot.findMany({ where: { tenantId: actor.activeTenantId!, startsAt: { gte: new Date() } }, include: { branch: true }, orderBy: { startsAt: "asc" }, take: 40 }),
  );
  return (
    <>
      <PageHeader eyebrow="Calendar" title="Time slots" description="All times are in IST. When a slot is full, no more patients can book it." />
      <div className="grid gap-2 text-sm">
        {slots.length === 0 ? <p className="text-muted-foreground">No future slots.</p> : slots.map((slot) => (
          <p key={slot.id}>{slot.branch.name} · {slot.kind} · {formatWhen(slot.startsAt)} · {slot.bookedCount}/{slot.capacity}</p>
        ))}
      </div>
      <FormBox action={slotAction} submit="Add slots">
        <label className="field">Branch
          <select name="branchId">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        </label>
        <label className="field">Kind
          <select name="kind"><option value="CENTER">Center visit</option><option value="HOME">Home collection</option><option value="IMAGING">Imaging</option></select>
        </label>
        <label className="field">Date<input name="date" type="date" required /></label>
        <label className="field">Times, comma separated<input name="times" placeholder="09:00, 09:30, 10:00" required /></label>
        <label className="field">Capacity<input name="capacity" type="number" min="1" defaultValue="1" /></label>
      </FormBox>
    </>
  );
}
