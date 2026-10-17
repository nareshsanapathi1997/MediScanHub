import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import Link from "next/link";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { EmptyState, ItemList, PageHeader, Panel, StatusPill } from "@/components/widgets";
import { ChevronRight, Stethoscope } from "lucide-react";

export const metadata = { title: "Referrals" };

export default async function DoctorPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="referrals.read">
      <DoctorBody params={params} />
    </Gate>
  );
}

async function DoctorBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const { items: rows, total, args: paging } = await fetchPage(parsePage(params, 12), async (args) => {
    const result = await listBookings(actor, { page: args.page, pageSize: args.pageSize });
    return { items: result.rows, total: result.total };
  });
  return (
    <>
      <PageHeader eyebrow="Referrals" title="Patients who named you" description="You only see bookings where the patient entered your email. Open a visit to download released reports. Unreleased results stay hidden." />
      <Panel title="Referred visits" description={`${total} visit${total === 1 ? "" : "s"}, newest first.`}>
        {rows.length === 0 ? <EmptyState icon={Stethoscope} title="No referrals" body="When a patient adds your email at checkout, the visit appears here." /> : (
          <ItemList>
            {rows.map((booking) => (
              <li key={booking.id}>
                <Link href={`/console/org/bookings/${booking.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/60">
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{booking.patient.user.name}</span>
                    <span className="text-xs text-muted-foreground"><span className="font-mono">{booking.publicCode}</span> · {formatWhen(booking.scheduledAt)}</span>
                  </span>
                  <StatusPill value={booking.status} />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ItemList>
        )}
        {total > 0 ? <Pagination className="mt-9" pathname="/console/doctor" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "visit" : "visits"} label="Visit pages" /> : null}
      </Panel>
    </>
  );
}
