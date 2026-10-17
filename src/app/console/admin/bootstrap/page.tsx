import { requireSession } from "@/server/session";
import { superAdminCount } from "@/lib/services/auth";
import { bootstrapAdminAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, Panel } from "@/components/widgets";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Bootstrap super admin" };

export default async function BootstrapAdminPage() {
  await requireSession();
  const count = await superAdminCount();
  if (count > 0) {
    // Once a super admin exists, more admins are added from the platform Users page, not with the bootstrap secret.
    return (
      <>
        <PageHeader eyebrow="Platform" title="Super admin is already set up" description="This one-time setup page is closed. A super admin can add more admins from Platform → Users." />
        <EmptyState icon={ShieldCheck} title="Nothing to do here" body="Go back to your desk from the menu." />
      </>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Create super admin"
        description="Use the bootstrap secret from CRON_SECRET or BOOTSTRAP_SECRET. In production, this form is blocked after the first super admin exists."
      />
      <div className="max-w-xl">
        <Panel title="First administrator" description={`Active super admins: ${count}`}>
          <FormBox action={bootstrapAdminAction} submit="Create super admin">
            <label className="field">Name<input name="name" required autoComplete="name" /></label>
            <label className="field">Email<input name="email" type="email" required autoComplete="email" /></label>
            <label className="field">Password<input name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
            <label className="field">Bootstrap secret<input name="secret" type="password" required autoComplete="off" /></label>
          </FormBox>
        </Panel>
      </div>
    </>
  );
}
