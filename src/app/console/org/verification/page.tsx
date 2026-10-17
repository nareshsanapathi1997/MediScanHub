import { requireSession } from "@/server/session";
import { prismaPrivileged } from "@/lib/db";
import { verificationAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, Item, ItemList, PageHeader, Panel, StatusPill, Workspace } from "@/components/widgets";
import { FileText } from "lucide-react";
import { formatDate, sentenceCase } from "@/lib/format";

export const metadata = { title: "Verification" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  return (
    <Gate actor={actor} permission="tenant.manage">
      <NeedTenant actor={actor}>
        <VerifyBody registered={query.registered} />
      </NeedTenant>
    </Gate>
  );
}

async function VerifyBody({ registered }: { registered?: string }) {
  const { actor } = await requireSession();
  const docs = await prismaPrivileged.centerVerification.findMany({ where: { tenantId: actor.activeTenantId! }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow="Trust" title="Center documents" description="Upload your registration certificate, NABL certificate and GST certificate. PDF, JPG or PNG up to 5 MB each." />
      {registered ? <p className="rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm">Application <span className="font-mono">{registered}</span> is pending review. Add your registration certificate here.</p> : null}
      <Workspace aside={
        <Panel title="Upload a document" description="Our team checks each file, usually within two working days.">
          <FormBox action={verificationAction} submit="Upload">
            <label className="field">Document type
              <select name="documentType">
                <option value="registration">Clinical establishment registration</option>
                <option value="gst">GST certificate</option>
                <option value="signatory">Authorized signatory</option>
              </select>
            </label>
            <label className="field">File<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required /></label>
          </FormBox>
        </Panel>
      }>
        <Panel title="Submitted" description="Approved documents let your center appear as verified.">
          {docs.length === 0 ? <EmptyState icon={FileText} title="Nothing uploaded yet" body="Start with your clinical establishment registration." /> : (
            <ItemList>
              {docs.map((doc) => (
                <Item key={doc.id} icon={FileText} tone={doc.status === "APPROVED" ? "success" : doc.status === "REJECTED" ? "danger" : "warning"}
                  title={<a className="break-all hover:text-primary hover:underline" href={`/api/v1/verification/${doc.id}`}>{doc.fileName}</a>}
                  meta={`${sentenceCase(doc.documentType)} · uploaded ${formatDate(doc.createdAt)}`}
                  trailing={<StatusPill value={doc.status} />} />
              ))}
            </ItemList>
          )}
        </Panel>
      </Workspace>
    </>
  );
}
