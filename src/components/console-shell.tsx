import Link from "next/link";
import { LogOut, Menu, UserRound } from "@/components/icons";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConsoleNav, type NavGroup } from "@/components/console-nav";
import { logoutAction, switchTenantAction } from "@/server/actions";
import { permissionSet, homeFor, type Actor } from "@/domain/actor";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";

type Item = { href: string; label: string; permission: string; icon: string; group: string; global?: boolean };

const items: Item[] = [
  { href: "/console/admin", label: "Platform", permission: "platform.read", icon: "gauge", group: "Platform", global: true },
  { href: "/console/admin/centers", label: "Center review", permission: "tenants.review", icon: "shield", group: "Platform", global: true },
  { href: "/console/admin/plans", label: "Plans", permission: "plans.manage", icon: "wallet", group: "Platform", global: true },
  { href: "/console/admin/users", label: "Users", permission: "platform.manage", icon: "users", group: "Platform", global: true },
  { href: "/console/admin/audit", label: "Audit log", permission: "audit.read", icon: "audit", group: "Platform", global: true },
  { href: "/console/admin/tickets", label: "Tickets", permission: "tickets.manage", icon: "help", group: "Platform", global: true },
  { href: "/console/admin/notifications", label: "Delivery", permission: "platform.read", icon: "bell", group: "Platform", global: true },
  { href: "/console/admin/bootstrap", label: "Bootstrap admin", permission: "platform.manage", icon: "shield", group: "Platform", global: true },
  { href: "/console/org", label: "Overview", permission: "tenant.read", icon: "gauge", group: "Center" },
  { href: "/console/org/bookings", label: "Bookings", permission: "bookings.read", icon: "calendar", group: "Operations" },
  { href: "/console/desk", label: "Front desk", permission: "bookings.manage", icon: "check", group: "Operations" },
  { href: "/console/org/schedule", label: "Schedule", permission: "bookings.manage", icon: "clock", group: "Operations" },
  { href: "/console/org/collections", label: "Home collection", permission: "bookings.manage", icon: "truck", group: "Operations" },
  { href: "/console/lab", label: "Laboratory", permission: "samples.read", icon: "flask", group: "Clinical" },
  { href: "/console/imaging", label: "Imaging", permission: "imaging.read", icon: "scan", group: "Clinical" },
  { href: "/console/finance", label: "Finance", permission: "invoices.read", icon: "receipt", group: "Finance" },
  { href: "/console/org/analytics", label: "Analytics", permission: "analytics.read", icon: "chart", group: "Finance" },
  { href: "/console/org/branches", label: "Branches", permission: "branches.manage", icon: "building", group: "Setup" },
  { href: "/console/org/catalog", label: "Catalog", permission: "catalog.manage", icon: "boxes", group: "Setup" },
  { href: "/console/org/pricing", label: "Pricing", permission: "pricing.manage", icon: "tags", group: "Setup" },
  { href: "/console/org/packages", label: "Packages", permission: "catalog.manage", icon: "package", group: "Setup" },
  { href: "/console/org/staff", label: "Staff", permission: "staff.manage", icon: "users", group: "Setup" },
  { href: "/console/org/verification", label: "Verification", permission: "tenant.manage", icon: "shield", group: "Setup" },
  { href: "/console/org/subscription", label: "Subscription", permission: "tenant.manage", icon: "card", group: "Setup" },
  { href: "/console/org/integrations", label: "Integrations", permission: "tenant.read", icon: "boxes", group: "Setup" },
  { href: "/console/patient", label: "My care", permission: "patient.portal", icon: "heart", group: "Personal", global: true },
  { href: "/console/patient/notifications", label: "Inbox", permission: "patient.portal", icon: "bell", group: "Personal", global: true },
  { href: "/console/patient/reminders", label: "Reminders", permission: "patient.portal", icon: "clock", group: "Personal", global: true },
  { href: "/console/patient/support", label: "Support", permission: "patient.portal", icon: "help", group: "Personal", global: true },
  { href: "/console/patient/family", label: "Family", permission: "patient.portal", icon: "users", group: "Personal", global: true },
  { href: "/console/patient/wallet", label: "Wallet", permission: "patient.portal", icon: "wallet", group: "Personal", global: true },
  { href: "/console/patient/insurance", label: "Insurance", permission: "patient.portal", icon: "shield", group: "Personal", global: true },
  { href: "/console/patient/chronic", label: "Chronic care", permission: "patient.portal", icon: "activity", group: "Personal", global: true },
  { href: "/console/doctor", label: "Referrals", permission: "referrals.read", icon: "doctor", group: "Personal" },
];

function navFor(actor: Actor): NavGroup[] {
  const perms = permissionSet(actor, actor.activeTenantId);
  const visible = items.filter((item) => {
    if (item.permission === "patient.portal") return Boolean(actor.patientId) && (perms.has(item.permission) || actor.isSuperAdmin);
    if (!item.global && !actor.activeTenantId) return false;
    return perms.has(item.permission);
  });
  const groups: NavGroup[] = [];
  for (const item of visible) {
    let group = groups.find((entry) => entry.label === item.group);
    if (!group) groups.push((group = { label: item.group, items: [] }));
    group.items.push({ href: item.href, label: item.label, icon: item.icon });
  }
  return groups;
}

function initials(name: string) {
  return name.replace(/^Synth\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "U";
}

export function ConsoleShell({ actor, tenants, children }: { actor: Actor; tenants: Array<{ id: string; name: string; role: string }>; children: React.ReactNode }) {
  // navFor() is called per render site on purpose: passing one shared array to two client components
  // makes React dedupe it by path reference, which stalled client navigations in Next 15.5.
  const activeTenant = tenants.find((tenant) => tenant.id === actor.activeTenantId);
  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      <div className="grid min-h-[calc(100vh-1.75rem)] md:grid-cols-[256px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:flex">
          <Link href={homeFor(actor)} className="px-2 pt-1"><Logo className="text-sidebar-foreground" /></Link>
          {activeTenant ? (
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5">
              <p className="text-[0.68rem] tracking-[0.14em] text-sidebar-foreground/50 uppercase">Active center</p>
              <p className="truncate text-sm font-semibold">{activeTenant.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{activeTenant.role}</p>
            </div>
          ) : null}
          <ConsoleNav groups={navFor(actor)} />
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet>
                <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation" />}>
                  <Menu className="size-4" aria-hidden />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="mt-6 grid gap-6">
                    <Logo className="px-2 text-sidebar-foreground" />
                    <ConsoleNav groups={navFor(actor)} />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary" aria-hidden>{initials(actor.name)}</span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium">{actor.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{actor.isSuperAdmin ? "Platform admin" : activeTenant?.role ?? (actor.patientId ? "Patient" : "")}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {tenants.length > 0 ? (
                <form action={switchTenantAction} className="flex items-center gap-1">
                  <select name="tenantId" defaultValue={actor.activeTenantId ?? ""} aria-label="Active center" className="h-9 max-w-40 rounded-lg border bg-card px-2 text-xs sm:max-w-none">
                    {actor.isSuperAdmin ? <option value="">Platform</option> : null}
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                  <Button size="sm" type="submit" variant="outline" className="h-9">Switch</Button>
                </form>
              ) : null}
              <Link href="/console/account" aria-label="Account settings" title="Account" className={buttonVariants({ variant: "ghost", size: "icon" })}>
                <UserRound className="size-4" aria-hidden />
              </Link>
              <ThemeToggle />
              <form action={logoutAction}>
                <Button variant="ghost" size="icon" type="submit" aria-label="Sign out" title="Sign out"><LogOut className="size-4" aria-hidden /></Button>
              </form>
            </div>
          </header>
          <main id="main" className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
