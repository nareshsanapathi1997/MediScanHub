import { notFound } from "next/navigation";
import { previewInvitation } from "@/lib/services/auth";
import { acceptInviteAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await previewInvitation(token);
  if (!invite) notFound();
  return (
    <AuthShell eyebrow="Invitation" title={invite.center} description={`Role: ${invite.role}${invite.branch ? ` · ${invite.branch}` : ""}. Sent to ${invite.email}.`}>
      <FormBox action={acceptInviteAction} submit="Accept invitation">
        <input type="hidden" name="token" value={token} />
        <label className="field">Your name<input name="name" required /></label>
        <label className="field">Password<input name="password" type="password" required /></label>
      </FormBox>
      <p className="text-sm text-muted-foreground">If you already have an account for this email, the password field is ignored and the role is added to that account.</p>
    </AuthShell>
  );
}
