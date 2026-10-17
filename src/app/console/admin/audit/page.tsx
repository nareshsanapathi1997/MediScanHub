import { requireSession } from "@/server/session";
import { listAudit } from "@/lib/services/admin";
import { deny } from "@/components/guard";
import { PageHeader, Panel } from "@/components/widgets";
import { AuditTable } from "@/components/record-tables";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Audit" };

export default async function AuditPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "audit.read");
  if (blocked) return blocked;
  const rows = await listAudit(actor);
  return (
    <>
      <PageHeader eyebrow="Audit" title="Audit log" description="Who viewed, changed, approved, downloaded or released a record, and when." />
      <Panel title="Recent events" description={`Latest ${rows.length} entries, newest first. Entries cannot be edited or deleted.`}>
        <AuditTable rows={rows.map((row) => ({
          when: formatWhen(row.createdAt),
          actor: row.actor?.name ?? "System",
          action: row.action,
          entity: `${row.entityType}${row.entityId ? ` ${row.entityId.slice(0, 8)}` : ""}`,
          tenant: row.tenant?.name ?? "Platform",
        }))} />
      </Panel>
    </>
  );
}
