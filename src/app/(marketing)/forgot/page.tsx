import { forgotAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { StickyInput } from "@/components/sticky-field";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <AuthShell eyebrow="Recovery" title="Forgot password" description="Enter the email you used to register. We will send you a link to set a new password. On this demo the link is shown on this page.">
      <FormBox action={forgotAction} submit="Send reset link" success="If this email is registered, we have sent a reset link. Please check your inbox and spam folder.">
        <label className="field">Email<StickyInput name="email" type="email" required autoComplete="email" /></label>
      </FormBox>
    </AuthShell>
  );
}
