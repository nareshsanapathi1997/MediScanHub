import Link from "next/link";
import { recoverAction } from "@/server/actions";
import { SchemaForm } from "@/components/schema-form";
import { AuthShell } from "@/components/auth-shell";
import { EmptyState } from "@/components/widgets";

export const metadata = { title: "Choose a new password" };

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell eyebrow="Recovery" title="Choose a new password" description="Set a new password. For your safety, you will be signed out on all other devices." footer={<Link className="font-medium text-primary" href="/login">Back to sign in</Link>}>
      {token ? (
        <SchemaForm
          schema="recover"
          action={recoverAction}
          submit="Update password"
          fields={[
            { name: "token", type: "hidden", defaultValue: token },
            { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters with a capital letter, a small letter and a number." },
            { name: "confirm", label: "Confirm new password", type: "password", autoComplete: "new-password" },
          ]}
        />
      ) : (
        <EmptyState title="This link is not complete" body="Please open the full link from the email, or ask for a new link." action={<Link className="text-sm font-medium text-primary underline" href="/forgot">Request a new link</Link>} />
      )}
    </AuthShell>
  );
}
