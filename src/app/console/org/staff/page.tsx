import { requireSession } from "@/server/session";
import { listStaff } from "@/lib/services/admin";
import { tenantBranches } from "@/lib/services/catalog";
import { inviteAction } from "@/server/actions";
import { ROLE_KEYS, ROLE_NAMES } from "@/domain/permissions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Staff" };

const invitable = ROLE_KEYS.filter((role) => role !== "SUPER_ADMIN" && role !== "PATIENT");

export default async function StaffPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="staff.manage">
      <NeedTenant actor={actor}>
        <StaffBody />
      </NeedTenant>
    </Gate>
  );
}

async function StaffBody() {
  const { actor } = await requireSession();
  const [staff, branches] = await Promise.all([listStaff(actor), tenantBranches(actor)]);
  return (
    <>
      <PageHeader eyebrow="People" title="Staff and invitations" description="An invitation adds one role at one center. Branch-scoped roles only see the branch you pick." />
      <div className="grid gap-2">
        {staff.map((member) => (
          <p key={member.id} className="rounded-xl border bg-card px-3 py-2 text-sm">{member.user.name} · {member.user.email} · {ROLE_NAMES[member.role.key as keyof typeof ROLE_NAMES] ?? member.role.name}</p>
        ))}
      </div>
      <FormBox action={inviteAction} submit="Send invitation" success="Invitation queued.">
        <label className="field">Email<input name="email" type="email" required /></label>
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
    </>
  );
}
