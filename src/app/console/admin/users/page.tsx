import { requireSession } from "@/server/session";
import { listUsersAdmin } from "@/lib/services/admin";
import { userStatusAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { ConfirmForm } from "@/components/confirm-form";
import { PageHeader } from "@/components/widgets";
import { UserTable } from "@/components/record-tables";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { actor } = await requireSession();
  const blocked = deny(actor, "platform.manage");
  if (blocked) return blocked;
  const { q } = await searchParams;
  const users = await listUsersAdmin(actor, q);
  return (
    <>
      <PageHeader eyebrow="Access" title="Users" description="Suspending a user revokes their open sessions. You cannot change your own status here." />
      <form className="flex gap-2">
        <label className="field flex-1">Search<input name="q" defaultValue={q} /></label>
        <button className="h-10 self-end rounded-lg bg-primary px-3 text-sm text-primary-foreground" type="submit">Search</button>
      </form>
      <UserTable rows={users.map((user) => ({
        name: user.name,
        email: user.email,
        status: user.status,
        roles: user.memberships.map((membership) => `${membership.role.key}${membership.tenant ? ` @ ${membership.tenant.name}` : ""}`).join(", ") || "—",
      }))} />
      <div className="grid gap-3">
        {users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
            <span>{user.email}</span>
            <ConfirmForm action={userStatusAction} confirm={`Change status for ${user.email}?`} submit="Update">
              <input type="hidden" name="userId" value={user.id} />
              <select name="status" defaultValue={user.status} className="h-10 rounded-lg border bg-background px-2">
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </ConfirmForm>
          </div>
        ))}
      </div>
    </>
  );
}
