import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listUsersAdminPage } from "@/lib/services/admin";
import { userStatusAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { ConfirmForm } from "@/components/confirm-form";
import { ItemList, PageHeader, Panel } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { Search } from "lucide-react";
import { UserTable } from "@/components/record-tables";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { actor } = await requireSession();
  const blocked = deny(actor, "platform.manage");
  if (blocked) return blocked;
  const params = await searchParams;
  const { q } = params;
  const { items: users, total, args: paging } = await fetchPage(parsePage(params, 10), (args) => listUsersAdminPage(actor, q, args));
  return (
    <>
      <PageHeader eyebrow="Access" title="Users" description="Suspending a user signs them out at once. You cannot suspend yourself." />
      <form className="surface flex flex-wrap items-end gap-3 p-4" role="search">
        <label className="field min-w-0 flex-1">Search by name or email<input name="q" type="search" defaultValue={q} placeholder="asha@" /></label>
        <button className={buttonVariants()} type="submit"><Search className="size-4" aria-hidden />Search</button>
      </form>
      <Panel title={q ? `Results for “${q}”` : "All users"} description={`${total} ${total === 1 ? "user" : "users"}${q ? " found" : ""}.`}>
        <UserTable rows={users.map((user) => ({
          name: user.name,
          email: user.email,
          status: user.status,
          roles: user.memberships.map((membership) => `${membership.role.key}${membership.tenant ? ` @ ${membership.tenant.name}` : ""}`).join(", ") || "—",
        }))} />
      </Panel>
      <Panel title="Change access" description="Pick a new status and confirm.">
        <ItemList>
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="grid min-w-0"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.email}</span></span>
              <ConfirmForm action={userStatusAction} confirm={`Change status for ${user.email}?`} submit="Update">
                <input type="hidden" name="userId" value={user.id} />
                <select name="status" defaultValue={user.status} aria-label={`Status for ${user.email}`} className="h-10 rounded-lg border bg-background px-2">
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </ConfirmForm>
            </li>
          ))}
        </ItemList>
      </Panel>
      <Pagination pathname="/console/admin/users" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "user" : "users"} label="User pages" />
    </>
  );
}
