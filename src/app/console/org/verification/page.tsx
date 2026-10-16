import { requireSession } from "@/server/session";
import { prismaPrivileged } from "@/lib/db";
import { verificationAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, StatusPill } from "@/components/widgets";

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
      {registered ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">Application {registered} is pending review. Add your registration certificate here.</p> : null}
      {docs.map((doc) => (
        <p key={doc.id} className="flex items-center justify-between gap-2 text-sm">
          <a className="text-primary" href={`/api/v1/verification/${doc.id}`}>{doc.fileName}</a>
          <StatusPill value={doc.status} />
        </p>
      ))}
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
    </>
  );
}
