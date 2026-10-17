import { requireSession } from "@/server/session";
import { listSessions } from "@/lib/services/auth";
import { deleteAccountAction, profileAction, revokeListedSessionAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { prismaPrivileged } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { FormBox } from "@/components/form-box";
import { Item, ItemList, PageHeader, Panel, Workspace } from "@/components/widgets";
import { Download, Monitor } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireSession();
  const [sessions, patient] = await Promise.all([
    listSessions(session.actor.userId),
    session.actor.patientId ? prismaPrivileged.patient.findUnique({ where: { id: session.actor.patientId } }) : Promise.resolve(null),
  ]);
  const initials = session.actor.name.replace(/^Synth\s+/i, "").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="grid size-16 place-items-center rounded-2xl bg-primary/12 font-display text-2xl text-primary">{initials}</span>
        <PageHeader eyebrow="Account" title={session.actor.name} description={session.actor.email} />
      </div>
      <Workspace aside={
        <>
          <Panel title="Signed-in devices" description="Sign out devices you don’t recognise.">
            <ItemList>
              {sessions.map((item) => (
                <Item
                  key={item.id}
                  icon={Monitor}
                  tone={item.id === session.sessionId ? "success" : "muted"}
                  title={<span className="line-clamp-1 text-sm">{deviceName(item.userAgent)}</span>}
                  meta={`${item.id === session.sessionId ? "This browser · " : ""}Last active ${formatWhen(item.lastSeenAt)}`}
                  trailing={item.id !== session.sessionId ? (
                    <ActionForm action={revokeListedSessionAction}>
                      <input type="hidden" name="sessionId" value={item.id} />
                      <button className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10" type="submit">Sign out</button>
                    </ActionForm>
                  ) : null}
                />
              ))}
            </ItemList>
          </Panel>
          {session.actor.patientId ? (
            <Panel title="Your data" description="A copy of everything we hold about you.">
              <div className="grid gap-3">
                {/* File download, not a page navigation. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className={buttonVariants({ variant: "outline" })} href="/api/v1/patients/export"><Download className="size-4" aria-hidden />Download my data (JSON)</a>
                <div className="grid gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">Delete account</p>
                  <p className="text-xs text-muted-foreground">This signs you out everywhere and removes your login and contact details. Bookings and released reports stay with the center, as the law requires.</p>
                  <ConfirmForm action={deleteAccountAction} confirm="Anonymize your login and contact details? Clinical records stay with the center." submit="Delete account" variant="destructive" />
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      }>
        <Panel title="Profile" description="Leave the password fields empty to keep your current password.">
          <FormBox action={profileAction} submit="Save profile" success="Profile saved.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">Name<input name="name" defaultValue={session.actor.name} autoComplete="name" /></label>
              <label className="field">New phone number<input name="phone" defaultValue="" placeholder="+91 98765 43210" autoComplete="tel" /></label>
              {patient ? (
                <>
                  <label className="field sm:col-span-2">Address<textarea name="address" defaultValue={patient.address ?? ""} rows={2} /></label>
                  <label className="field">City<input name="city" defaultValue={patient.city ?? ""} /></label>
                  <label className="field">Emergency contact<input name="emergencyContact" defaultValue={patient.emergencyContact ?? ""} placeholder="Name and phone" /></label>
                </>
              ) : null}
            </div>
            <fieldset className="mt-2 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <legend className="sr-only">Change password</legend>
              <label className="field">Current password<input name="currentPassword" type="password" autoComplete="current-password" /></label>
              <label className="field">New password<input name="nextPassword" type="password" autoComplete="new-password" /></label>
            </fieldset>
          </FormBox>
        </Panel>
      </Workspace>
    </>
  );
}

function deviceName(agent: string | null) {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Windows/.test(agent) ? "Windows" : /Mac OS X/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
