import { requireSession } from "@/server/session";
import { listSessions } from "@/lib/services/auth";
import { deleteAccountAction, profileAction, revokeListedSessionAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { prismaPrivileged } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireSession();
  const [sessions, patient] = await Promise.all([
    listSessions(session.actor.userId),
    session.actor.patientId ? prismaPrivileged.patient.findUnique({ where: { id: session.actor.patientId } }) : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHeader eyebrow="Account" title={session.actor.name} description={session.actor.email} />
      <FormBox action={profileAction} submit="Save profile" success="Profile saved.">
        <label className="field">Name<input name="name" defaultValue={session.actor.name} /></label>
        <label className="field">Phone<input name="phone" defaultValue="" placeholder="New phone" /></label>
        {patient ? (
          <>
            <label className="field">Address<textarea name="address" defaultValue={patient.address ?? ""} rows={2} /></label>
            <label className="field">City<input name="city" defaultValue={patient.city ?? ""} /></label>
            <label className="field">Emergency contact<input name="emergencyContact" defaultValue={patient.emergencyContact ?? ""} /></label>
          </>
        ) : null}
        <label className="field">Current password<input name="currentPassword" type="password" autoComplete="current-password" /></label>
        <label className="field">New password<input name="nextPassword" type="password" autoComplete="new-password" /></label>
      </FormBox>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Sessions</h2>
        {sessions.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
            <span>{formatWhen(item.lastSeenAt)} · {item.userAgent ?? "Unknown device"}{item.id === session.sessionId ? " · this browser" : ""}</span>
            {item.id !== session.sessionId ? (
              <ActionForm action={revokeListedSessionAction}>
                <input type="hidden" name="sessionId" value={item.id} />
                <button className="h-9 rounded-lg border px-3" type="submit">Revoke</button>
              </ActionForm>
            ) : null}
          </div>
        ))}
      </section>
      {session.actor.patientId ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Your data</h2>
          {/* File download, not a page navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="text-sm text-primary" href="/api/v1/patients/export">Download a JSON export</a>
          <ConfirmForm action={deleteAccountAction} confirm="Anonymize your login and contact details? Clinical records stay with the center." submit="Delete account" />
          <p className="text-sm text-muted-foreground">Deletion revokes sessions and replaces your email. Bookings and released reports are retained. This is not a legal determination under the DPDP Act.</p>
        </section>
      ) : null}
    </>
  );
}
