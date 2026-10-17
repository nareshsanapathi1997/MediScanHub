import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/server/session";
import { listImaging } from "@/lib/services/imaging";
import { imagingAction, pacsAction } from "@/server/actions";
import { modalityLabel } from "@/domain/scan-scheduling";
import { formatWhen } from "@/lib/format";
import { hasPermission } from "@/domain/actor";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, StatusPill, EmptyState } from "@/components/widgets";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Imaging" };

export default async function ImagingDeskPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="imaging.read">
      <NeedTenant actor={actor}>
        <ImagingBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function ImagingBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const canPerform = hasPermission(actor, "imaging.perform", actor.activeTenantId);
  const { items: orders, total, args: paging } = await fetchPage(parsePage(params, 10), (args) => listImaging(actor, args));
  return (
    <>
      <PageHeader eyebrow="Imaging" title="Scans" description="X-ray, ultrasound, CT and MRI orders. Mark each scan done, then open the report to upload images, DICOM studies and the typed report." actions={<Link className={buttonVariants({ variant: "outline" })} href="/console/imaging/rooms">Scan rooms and slots</Link>} />
      {orders.length === 0 ? <EmptyState title="No scans booked" body="Scans appear here when a patient books and pays for an X-ray, ultrasound, CT or MRI." /> : orders.map((order) => (
        <article key={order.id} className="grid gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{order.booking.publicCode}</h2>
            <StatusPill value={order.status} />
          </div>
          <p className="text-sm">{order.booking.patient.user.name} · {order.modality} · {order.booking.branch.name}</p>
          {order.booking.slot ? (
            <p className="text-sm">Slot: {formatWhen(order.booking.slot.startsAt)}{order.booking.slot.equipment ? ` · ${modalityLabel(order.booking.slot.equipment.modality)} · ${order.booking.slot.equipment.name}, ${order.booking.slot.equipment.room}` : ""}</p>
          ) : <p className="text-sm text-muted-foreground">Walk-in, no slot</p>}
          <p className="whitespace-pre-line text-sm text-muted-foreground">{order.prepInstructions}</p>
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
      {total > 0 ? <Pagination pathname="/console/imaging" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "scan order" : "scan orders"} label="Scan order pages" /> : null}
    </>
  );
}
