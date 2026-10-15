import { recoverAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Choose a new password" };

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-10">
      <PageHeader eyebrow="Recovery" title="Choose a new password" description="This link expires, and using it signs out every existing session." />
      <FormBox action={recoverAction} submit="Update password">
        <input type="hidden" name="token" value={token ?? ""} />
        <label className="field">New password<input name="password" type="password" autoComplete="new-password" required /></label>
      </FormBox>
    </main>
  );
}
