import { requireSession } from "@/server/session";
import { superAdminCount } from "@/lib/services/auth";
import { bootstrapAdminAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Bootstrap super admin" };

export default async function BootstrapAdminPage() {
  await requireSession();
  const count = await superAdminCount();
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
