import Link from "next/link";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction, switchTenantAction } from "@/server/actions";
import { permissionSet, homeFor, type Actor } from "@/domain/actor";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const items = [
  { href: "/console/admin", label: "Platform", permission: "platform.read", global: true },
  { href: "/console/admin/centers", label: "Center review", permission: "tenants.review", global: true },
  { href: "/console/admin/plans", label: "Plans", permission: "plans.manage", global: true },
  { href: "/console/admin/users", label: "Users", permission: "platform.manage", global: true },
  { href: "/console/admin/audit", label: "Audit", permission: "audit.read", global: true },
  { href: "/console/admin/tickets", label: "Tickets", permission: "tickets.manage", global: true },
  { href: "/console/admin/notifications", label: "Delivery", permission: "platform.read", global: true },
  { href: "/console/admin/bootstrap", label: "Bootstrap admin", permission: "platform.manage", global: true },
  { href: "/console/org", label: "Overview", permission: "tenant.read" },
  { href: "/console/org/branches", label: "Branches", permission: "branches.manage" },
  { href: "/console/org/catalog", label: "Catalog", permission: "catalog.manage" },
  { href: "/console/org/pricing", label: "Pricing", permission: "pricing.manage" },
  { href: "/console/org/packages", label: "Packages", permission: "catalog.manage" },
  { href: "/console/org/staff", label: "Staff", permission: "staff.manage" },
  { href: "/console/org/schedule", label: "Schedule", permission: "bookings.manage" },
  { href: "/console/org/bookings", label: "Bookings", permission: "bookings.read" },
  { href: "/console/org/collections", label: "Home collection", permission: "bookings.manage" },
  { href: "/console/org/verification", label: "Verification", permission: "tenant.manage" },
  { href: "/console/org/analytics", label: "Analytics", permission: "analytics.read" },
  { href: "/console/org/subscription", label: "Subscription", permission: "tenant.manage" },
  { href: "/console/org/integrations", label: "Integrations", permission: "tenant.read" },
  { href: "/console/desk", label: "Front desk", permission: "bookings.manage" },
  { href: "/console/lab", label: "Laboratory", permission: "samples.read" },
  { href: "/console/imaging", label: "Imaging", permission: "imaging.read" },
  { href: "/console/finance", label: "Finance", permission: "invoices.read" },
  { href: "/console/patient", label: "My care", permission: "patient.portal", global: true },
  { href: "/console/patient/notifications", label: "Inbox", permission: "patient.portal", global: true },
  { href: "/console/patient/reminders", label: "Reminders", permission: "patient.portal", global: true },
  { href: "/console/patient/support", label: "Support", permission: "patient.portal", global: true },
  { href: "/console/patient/family", label: "Family", permission: "patient.portal", global: true },
  { href: "/console/patient/wallet", label: "Wallet", permission: "patient.portal", global: true },
  { href: "/console/patient/insurance", label: "Insurance", permission: "patient.portal", global: true },
  { href: "/console/patient/chronic", label: "Chronic care", permission: "patient.portal", global: true },
  { href: "/console/doctor", label: "Referrals", permission: "referrals.read" },
];

function navFor(actor: Actor) {
  const perms = permissionSet(actor, actor.activeTenantId);
  return items.filter((item) => {
    if (item.global) return actor.isSuperAdmin ? perms.has(item.permission) || item.permission === "patient.portal" && actor.patientId : perms.has(item.permission);
    return perms.has(item.permission);
  });
}

export function ConsoleShell({ actor, tenants, children }: { actor: Actor; tenants: Array<{ id: string; name: string; role: string }>; children: React.ReactNode }) {
  const nav = navFor(actor);
  const links = (
    <nav className="grid gap-1 text-sm" aria-label="Workspace">
      {nav.map((item) => (
        <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">{item.label}</Link>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="hidden bg-sidebar text-sidebar-foreground md:flex md:flex-col md:gap-6 md:p-4">
          <Link href={homeFor(actor)}><Logo className="text-sidebar-foreground" /></Link>
          {links}
        </aside>
        <div>
          <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" className="md:hidden" />}>Menu</SheetTrigger>
              <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
                <div className="mt-8">{links}</div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm text-muted-foreground">{actor.name}</p>
            <div className="flex items-center gap-2">
              {tenants.length > 0 ? (
                <form action={switchTenantAction} className="flex items-center gap-1">
                  <select name="tenantId" defaultValue={actor.activeTenantId ?? ""} aria-label="Active center" className="h-8 rounded-lg border bg-background px-2 text-xs">
                    {actor.isSuperAdmin ? <option value="">Platform</option> : null}
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                  <Button size="sm" type="submit" variant="outline">Switch</Button>
                </form>
              ) : null}
              <Link href="/console/account" className="text-sm text-muted-foreground">Account</Link>
              <ThemeToggle />
              <form action={logoutAction}><Button variant="outline" size="sm" type="submit">Sign out</Button></form>
            </div>
          </header>
          <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
