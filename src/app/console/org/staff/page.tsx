import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listStaffPage } from "@/lib/services/admin";
import { tenantBranches } from "@/lib/services/catalog";
import { inviteAction } from "@/server/actions";
import { ROLE_KEYS, ROLE_NAMES } from "@/domain/permissions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { ItemList, PageHeader, Panel, Workspace } from "@/components/widgets";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Staff" };

const invitable = ROLE_KEYS.filter((role) => role !== "SUPER_ADMIN" && role !== "PATIENT");

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="staff.manage">
      <NeedTenant actor={actor}>
        <StaffBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function StaffBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("staff", params.view, "list");
  const viewToggle = <ViewToggle page="staff" view={view} hrefs={viewHrefs("/console/org/staff", params)} />;
  const { actor } = await requireSession();
  const [{ items: staff, total, args: paging }, branches] = await Promise.all([fetchPage(parsePage(params, 12), (args) => listStaffPage(actor, args)), tenantBranches(actor)]);
  return (
    <>
      <PageHeader eyebrow="People" title="Staff" description="Invite staff by email and choose their role. Branch staff see only the branch you pick." />
      <Workspace aside={
        <Panel title="Invite someone" description="They get an email link to set a password.">
          <FormBox action={inviteAction} submit="Send invitation" success="Invitation queued.">
            <label className="field">Email<input name="email" type="email" required placeholder="name@center.in" /></label>
            <label className="field">Role
              <select name="roleKey" required>
                {invitable.map((role) => <option key={role} value={role}>{ROLE_NAMES[role]}</option>)}
              </select>
            </label>
            <label className="field">Branch
              <select name="branchId">
                <option value="">All branches this role allows</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
          </FormBox>
        </Panel>
      }>
        <Panel title="Team" description={`${total} active ${total === 1 ? "person" : "people"}.`} actions={viewToggle}>
          {view === "cards" ? (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {staff.map((member) => (
                <li key={member.id} className="grid justify-items-center gap-2 rounded-xl border bg-muted/20 p-4 text-center">
                  <span aria-hidden className="grid size-14 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{initials(member.user.name)}</span>
                  <span className="grid min-w-0"><span className="truncate font-medium">{member.user.name}</span><span className="truncate text-xs text-muted-foreground">{member.user.email}</span></span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{ROLE_NAMES[member.role.key as keyof typeof ROLE_NAMES] ?? member.role.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ItemList>
              {staff.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(member.user.name)}</span>
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{member.user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{member.user.email}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{ROLE_NAMES[member.role.key as keyof typeof ROLE_NAMES] ?? member.role.name}</span>
                </li>
              ))}
            </ItemList>
          )}
          <Pagination className={view === "list" ? "mt-9" : "mt-4"} pathname="/console/org/staff" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "person" : "people"} />
        </Panel>
      </Workspace>
    </>
  );
}

function initials(name: string) {
  return name.replace(/^Synth\s+/i, "").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
