import { requireSession } from "@/server/session";
import { listEquipment, listImaging } from "@/lib/services/imaging";
import { listAccessibleBranches } from "@/lib/services/catalog";
import { listStaff } from "@/lib/services/admin";
import { equipmentAction, imagingAction, pacsAction, scheduleEquipmentAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { hasPermission } from "@/domain/actor";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, StatusPill, EmptyState } from "@/components/widgets";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Imaging" };

export default async function ImagingDeskPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="imaging.read">
      <NeedTenant actor={actor}>
        <ImagingBody />
      </NeedTenant>
    </Gate>
  );
}

async function ImagingBody() {
  const { actor } = await requireSession();
  const canPerform = hasPermission(actor, "imaging.perform", actor.activeTenantId);
  const [orders, equipment, branches, staff] = await Promise.all([
    listImaging(actor),
    listEquipment(actor),
    canPerform ? listAccessibleBranches(actor) : Promise.resolve([]),
    canPerform ? listStaff(actor).catch(() => []) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader eyebrow="Imaging" title="Scans" description="X-ray, ultrasound, CT and MRI orders. Mark each scan done, then open the report to upload images and the typed report." />
      {orders.length === 0 ? <EmptyState title="No scans booked" body="Scans appear here when a patient books and pays for an X-ray, ultrasound, CT or MRI." /> : orders.map((order) => (
        <article key={order.id} className="grid gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{order.booking.publicCode}</h2>
            <StatusPill value={order.status} />
          </div>
          <p className="text-sm">{order.booking.patient.user.name} · {order.modality} · {order.booking.branch.name}</p>
          <p className="text-sm text-muted-foreground">{order.prepInstructions}</p>
          {order.studies.map((study) => (
            <div key={study.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{study.service.name} · {study.accession} · {study.status} · PACS {study.pacsStatus}{study.studyInstanceUid ? ` · UID ${study.studyInstanceUid}` : ""}</span>
              <div className="flex gap-2">
                {canPerform ? (
                  <form action={pacsAction}>
                    <input type="hidden" name="studyId" value={study.id} />
                    <button className="h-9 rounded-lg border px-3" type="submit">Send to PACS</button>
                  </form>
                ) : null}
                {canPerform && order.status === "SCHEDULED" ? (
                  <ActionForm action={imagingAction}>
                    <input type="hidden" name="mode" value="checkin" />
                    <input type="hidden" name="orderId" value={order.id} />
                    <button className="h-9 rounded-lg border px-3" type="submit">Check in</button>
                  </ActionForm>
                ) : null}
                {canPerform && study.status === "SCHEDULED" ? (
                  <ActionForm action={imagingAction}>
                    <input type="hidden" name="studyId" value={study.id} />
                    <input type="hidden" name="to" value="ACQUIRED" />
                    <button className="h-9 rounded-lg border px-3" type="submit">Mark acquired</button>
                  </ActionForm>
                ) : null}
                {hasPermission(actor, "imaging.report", actor.activeTenantId) && study.status === "ACQUIRED" ? (
                  <ActionForm action={imagingAction}>
                    <input type="hidden" name="studyId" value={study.id} />
                    <input type="hidden" name="to" value="REPORTED" />
                    <button className="h-9 rounded-lg border px-3" type="submit">Mark reported</button>
                  </ActionForm>
                ) : null}
              </div>
            </div>
          ))}
          {order.reports.map((report) => <a key={report.id} className="text-sm text-primary" href={`/console/lab/reports/${report.id}`}>Open report and upload files ({report.status.toLowerCase()})</a>)}
        </article>
      ))}
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Equipment</h2>
        {equipment.map((item) => (
          <article key={item.id} className="rounded-xl border p-3 text-sm">
            <p className="font-medium">{item.name} · {item.modality} · {item.room} · {item.branch.name}</p>
            {item.schedules.map((schedule) => <p key={schedule.id}>{formatWhen(schedule.startsAt)} – {formatWhen(schedule.endsAt)}</p>)}
          </article>
        ))}
      </section>
      {canPerform ? (
        <>
          <FormBox action={equipmentAction} submit="Add equipment">
            <label className="field">Branch<select name="branchId">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <label className="field">Name<input name="name" required /></label>
            <label className="field">Modality<input name="modality" required placeholder="USG" /></label>
            <label className="field">Room<input name="room" required /></label>
          </FormBox>
          <FormBox action={scheduleEquipmentAction} submit="Schedule room">
            <label className="field">Equipment
              <select name="equipmentId">{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </label>
            <label className="field">Staff
              <select name="staffUserId"><option value="">Unassigned</option>{staff.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}</select>
            </label>
            <label className="field">Date<input type="date" name="date" required /></label>
            <label className="field">Start<input type="time" name="start" required /></label>
            <label className="field">End<input type="time" name="end" required /></label>
          </FormBox>
        </>
      ) : <p className="text-sm text-muted-foreground">Room scheduling is limited to radiology staff.</p>}
    </>
  );
}
