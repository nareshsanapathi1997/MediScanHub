import Link from "next/link";
import { requireSession } from "@/server/session";
import { todayOverview } from "@/lib/services/admin";
import { prismaPrivileged } from "@/lib/db";
import { tenantProfileAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, Stat } from "@/components/widgets";

export const metadata = { title: "Center overview" };

export default async function OrgHome() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="tenant.read">
      <NeedTenant actor={actor}>
        <OrgBody />
      </NeedTenant>
    </Gate>
  );
}

async function OrgBody() {
  const { actor } = await requireSession();
  const [today, tenant] = await Promise.all([
    todayOverview(actor),
    prismaPrivileged.tenant.findUnique({ where: { id: actor.activeTenantId! } }),
  ]);
  if (!tenant) return null;
  const canManage = actor.memberships.some((membership) => membership.tenantId === tenant.id && membership.permissions.includes("tenant.manage"));
  return (
    <>
      <PageHeader eyebrow={tenant.city} title={tenant.name} description={tenant.about} actions={<Link className="text-sm text-primary" href="/console/org/bookings">Open bookings</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Visits today" value={String(today.bookings)} />
        <Stat label="Reports in progress" value={String(today.pendingReports)} />
        <Stat label="Open collections" value={String(today.collections)} />
        <Stat label="Captured today" value={formatInr(today.capturedPaise)} />
      </div>
      <p className="text-sm text-muted-foreground">{tenant.address} · {tenant.phone} · {tenant.status}{tenant.customDomain ? ` · ${tenant.customDomain}` : ""}</p>
      {canManage ? (
        <FormBox action={tenantProfileAction} submit="Save center profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">Name<input name="name" defaultValue={tenant.name} required /></label>
            <label className="field">Phone<input name="phone" defaultValue={tenant.phone} required /></label>
            <label className="field">City<input name="city" defaultValue={tenant.city} required /></label>
            <label className="field">Brand color<input name="brandColor" defaultValue={tenant.brandColor} required /></label>
            <label className="field">Accent color<input name="accentColor" defaultValue={tenant.accentColor} required /></label>
            <label className="field">Logo URL<input name="logoUrl" defaultValue={tenant.logoUrl ?? ""} placeholder="https://… or /centers/your-slug/logo.svg" /></label>
            <label className="field">Cover image URL<input name="coverImageUrl" defaultValue={tenant.coverImageUrl ?? ""} placeholder="https://… or /centers/your-slug/cover.svg" /></label>
            <label className="field sm:col-span-2">Gallery image URLs<textarea name="galleryUrls" defaultValue={(tenant.galleryUrls ?? []).join("\n")} rows={4} placeholder="One https or /public path per line" /></label>
            <label className="field sm:col-span-2">Custom domain<input name="customDomain" defaultValue={tenant.customDomain ?? ""} placeholder="book.example.com" /></label>
            <label className="field sm:col-span-2">Address<textarea name="address" defaultValue={tenant.address} required rows={2} /></label>
            <label className="field sm:col-span-2">About<textarea name="about" defaultValue={tenant.about} required rows={3} /></label>
          </div>
        </FormBox>
      ) : null}
    </>
  );
}
