import { requireSession } from "@/server/session";
import { listAudit } from "@/lib/services/admin";
import { deny } from "@/components/guard";
import { PageHeader } from "@/components/widgets";
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
      <PageHeader eyebrow="Audit" title="Who touched a record" description="Views, edits, approvals, exports, and releases are written as they happen." />
      <AuditTable rows={rows.map((row) => ({
        when: formatWhen(row.createdAt),
        actor: row.actor?.name ?? "System",
        action: row.action,
        entity: `${row.entityType}${row.entityId ? ` ${row.entityId.slice(0, 8)}` : ""}`,
        tenant: row.tenant?.name ?? "Platform",
      }))} />
    </>
  );
}
