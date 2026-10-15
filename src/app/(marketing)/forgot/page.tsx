import { forgotAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { StickyInput } from "@/components/sticky-field";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-10">
      <PageHeader eyebrow="Recovery" title="Reset a password" description="If the email matches an account, a reset link is queued. The response is the same either way. In local development the link is shown here because no mail provider is configured." />
      <FormBox action={forgotAction} submit="Send reset link" success="If that email is registered, a reset link is on its way.">
        <label className="field">Email<StickyInput name="email" type="email" required autoComplete="email" /></label>
      </FormBox>
    </main>
  );
}
