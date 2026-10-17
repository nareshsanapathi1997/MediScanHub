import Link from "next/link";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { formatInr, formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, Panel, StatusPill, EmptyState } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { Activity, CalendarClock, FileText, IndianRupee, Inbox, LifeBuoy, Plus, ReceiptText, ShieldCheck, UserRound, Users } from "@/components/icons";

export const metadata = { title: "My care" };

export default async function PatientHome() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <PatientBody />
    </Gate>
  );
}

async function PatientBody() {
  const { actor } = await requireSession();
  const patientActor = { ...actor, activeTenantId: null };
  const bookings = await listBookings(patientActor, { pageSize: 20 });
  const active = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"];
  const upcoming = bookings.rows.filter((booking) => active.includes(booking.status)).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const past = bookings.rows.filter((booking) => !active.includes(booking.status));
  const awaitingPayment = upcoming.filter((booking) => booking.status === "PENDING").length;
  const row = (booking: (typeof bookings.rows)[number]) => (
    <li key={booking.id}>
      <Link href={`/bookings/${booking.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-primary">
        <span className="min-w-0">
          <span className="block font-medium">{booking.items.map((item) => item.name).join(", ") || booking.publicCode}</span>
          <span className="text-xs text-muted-foreground">{booking.publicCode} · {booking.tenant.name} · {booking.branch.name}</span>
        </span>
        <span className="flex items-center gap-3 text-sm"><span className="text-muted-foreground tabular-nums">{formatWhen(booking.scheduledAt)}</span><span className="tabular-nums">{formatInr(booking.totalPaise)}</span><StatusPill value={booking.status} /></span>
      </Link>
    </li>
  );
  return (
    <>
      <PageHeader eyebrow="My care" title={`Hello, ${actor.name.replace(/^Synth\s+(Patient\s+)?/i, "").split(" ")[0] || actor.name.split(" ")[0]}`} description="Your bookings, reports and bills in one place. Only you can see this page." actions={<Link className={buttonVariants()} href="/centers"><Plus className="size-4" aria-hidden />Book a test</Link>} />
      {awaitingPayment > 0 ? <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">{awaitingPayment} visit{awaitingPayment === 1 ? " is" : "s are"} waiting for payment. Please pay to confirm.</p> : null}
      {bookings.rows.length === 0 ? <EmptyState title="No bookings yet" body="Find a center near you, add a test like CBC or thyroid profile, and pick a time." action={<Link className={buttonVariants()} href="/centers">Browse centers</Link>} /> : (
        <>
          <Panel title="Upcoming" description={awaitingPayment > 0 ? "Pay for a pending booking to confirm it." : "Your next visits."}>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming visits. Book a test when you need one.</p> : <ul className="divide-y">{upcoming.map(row)}</ul>}
          </Panel>
          {past.length > 0 ? <Panel title="Past and cancelled visits"><ul className="divide-y">{past.map(row)}</ul></Panel> : null}
        </>
      )}
      <section aria-labelledby="shortcuts" className="grid gap-3">
      <h2 id="shortcuts" className="text-sm font-medium text-muted-foreground">Shortcuts</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          { href: "/console/patient/reports", label: "My reports", body: "View and download your reports", icon: FileText },
          { href: "/console/patient/invoices", label: "Bills", body: "Bills and payment status", icon: ReceiptText },
          { href: "/console/patient/notifications", label: "Messages", body: "Updates from your centers", icon: Inbox },
          { href: "/console/patient/reminders", label: "Upcoming visits", body: "Your next tests and reminders", icon: CalendarClock },
          { href: "/console/patient/family", label: "Family", body: "Book tests for parents and children", icon: Users },
          { href: "/console/patient/wallet", label: "Wallet", body: "1% back to use on your next booking", icon: IndianRupee },
          { href: "/console/patient/insurance", label: "Insurance", body: "Your health insurance policy", icon: ShieldCheck },
          { href: "/console/patient/chronic", label: "Health history", body: "Diabetes, BP, thyroid and more", icon: Activity },
          { href: "/console/patient/support", label: "Help", body: "Ask us a question", icon: LifeBuoy },
          { href: "/console/account", label: "Profile and privacy", body: "Your details, download or delete data", icon: UserRound },
        ].map(({ href, label, body, icon: Icon }) => (
          <Link key={href} href={href} className="surface flex flex-col items-start gap-2 p-4 transition hover:border-primary/50 sm:flex-row sm:items-center sm:gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
            <span><span className="block font-medium">{label}</span><span className="block text-xs text-muted-foreground">{body}</span></span>
          </Link>
        ))}
      </div>
      </section>
    </>
  );
}
