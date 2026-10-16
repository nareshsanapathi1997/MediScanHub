"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, Bell, Boxes, Building2, CalendarClock, CalendarDays, ClipboardCheck, CreditCard, FileSearch, FlaskConical, Gauge,
  HeartPulse, Home, LifeBuoy, Package, ReceiptIndianRupee, ScanLine, ShieldCheck, Stethoscope, Tags, Truck, Users, Wallet,
  type LucideIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  activity: Activity, chart: BarChart3, bell: Bell, boxes: Boxes, building: Building2, clock: CalendarClock, calendar: CalendarDays,
  check: ClipboardCheck, card: CreditCard, audit: FileSearch, flask: FlaskConical, gauge: Gauge, heart: HeartPulse, home: Home,
  help: LifeBuoy, package: Package, receipt: ReceiptIndianRupee, scan: ScanLine, shield: ShieldCheck, doctor: Stethoscope,
  tags: Tags, truck: Truck, users: Users, wallet: Wallet,
};

export type NavGroup = { label: string; items: Array<{ href: string; label: string; icon: string }> };

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the most specific match so /console/org does not light up on /console/org/bookings.
  return !all.some((other) => other !== href && other.startsWith(`${href}/`) && (pathname === other || pathname.startsWith(`${other}/`)));
}

export function ConsoleNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = groups.flatMap((group) => group.items.map((item) => item.href));
  return (
    <nav className="grid gap-5 text-sm" aria-label="Workspace">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-0.5">
          <p className="px-3 pb-1 text-[0.68rem] font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase">{group.label}</p>
          {group.items.map((item) => {
            const Icon = ICONS[item.icon] ?? Activity;
            const active = isActive(pathname, item.href, all);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]",
                )}
              >
                <Icon className={cn("size-4 shrink-0 opacity-70 group-hover:opacity-100", active && "text-sidebar-primary opacity-100")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
