import Link from "next/link";
import { loginAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { StickyInput } from "@/components/sticky-field";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; invited?: string }> }) {
  const query = await searchParams;
  const next = query.next?.startsWith("/") && !query.next.startsWith("//") ? query.next : "";
  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 py-10">
      <PageHeader eyebrow="Sign in" title="Open your desk" description="Sessions live in an HTTP-only cookie. Five failed attempts lock the account for 15 minutes." />
      {query.reset ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">Password updated. Sign in with the new one.</p> : null}
      {query.invited ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">Invitation accepted. Sign in to reach the center.</p> : null}
      <FormBox action={loginAction} submit="Sign in">
        <input type="hidden" name="next" value={next} />
        <label className="field">Email<StickyInput name="email" type="email" autoComplete="username" required /></label>
        <label className="field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      </FormBox>
      <p className="text-sm text-muted-foreground">
        <Link className="text-primary" href="/forgot">Forgot password</Link>
        {" · "}
        <Link className="text-primary" href="/register">Create a patient account</Link>
      </p>
    </main>
  );
}
