import { requireSession } from "@/server/session";
import { superAdminCount } from "@/lib/services/auth";
import { bootstrapAdminAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader } from "@/components/widgets";

export const metadata = { title: "Bootstrap super admin" };

export default async function BootstrapAdminPage() {
  await requireSession();
  const count = await superAdminCount();
  if (count > 0) {
    // Once a super admin exists, more admins are added from the platform Users page, not with the bootstrap secret.
    return (
      <>
        <PageHeader eyebrow="Platform" title="Super admin is already set up" description="This one-time setup page is closed. A super admin can add more admins from Platform → Users." />
        <EmptyState title="Nothing to do here" body="Go back to your desk from the menu." />
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
      <p className="text-sm text-muted-foreground">Active super admins: {count}</p>
      <FormBox action={bootstrapAdminAction} submit="Create super admin">
        <label className="field">Name<input name="name" required /></label>
        <label className="field">Email<input name="email" type="email" required /></label>
        <label className="field">Password<input name="password" type="password" required minLength={10} /></label>
        <label className="field">Bootstrap secret<input name="secret" type="password" required /></label>
      </FormBox>
    </>
  );
}
