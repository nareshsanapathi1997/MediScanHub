import Link from "next/link";
import { loginAction } from "@/server/actions";
import { FormBox } from "@/components/form-box";
import { StickyInput } from "@/components/sticky-field";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; invited?: string }> }) {
  const query = await searchParams;
  const next = query.next?.startsWith("/") && !query.next.startsWith("//") ? query.next : "";
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in" description="Patients and center staff sign in here. After 5 wrong passwords, the account is locked for 15 minutes.">
      {query.reset ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">Your password is changed. Please sign in with the new password.</p> : null}
      {query.invited ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">Invitation accepted. Sign in to open your center.</p> : null}
      <FormBox action={loginAction} submit="Sign in">
        <input type="hidden" name="next" value={next} />
        <label className="field">Email<StickyInput name="email" type="email" autoComplete="username" required /></label>
        <label className="field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      </FormBox>
      <p className="text-sm text-muted-foreground">
        <Link className="text-primary" href="/forgot">Forgot password?</Link>
        {" · "}
        <Link className="text-primary" href="/register">New patient? Create an account</Link>
      </p>
    </AuthShell>
  );
}
