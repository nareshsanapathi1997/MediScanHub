import Link from "next/link";
import { requireSession } from "@/server/session";
import { upcomingReminders, listInAppNotifications, notificationPreview } from "@/lib/services/patient-extras";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, EmptyState, StatusPill } from "@/components/widgets";

export const metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <RemindersBody />
    </Gate>
  );
}

async function RemindersBody() {
  const { actor } = await requireSession();
  const [visits, notices] = await Promise.all([upcomingReminders(actor), listInAppNotifications(actor, 10)]);
  const reminderNotices = notices.filter((n) => n.templateKey === "booking_reminder");
  return (
    <>
      <PageHeader eyebrow="Schedule" title="Upcoming & reminders" description="Visits in the next two weeks and reminder messages queued for delivery." />
      <section className="grid gap-2">
        <h2 className="font-display text-xl">Visits</h2>
        {visits.length === 0 ? <EmptyState title="Nothing scheduled" body="Book a test to see upcoming visits here." action={<Link className="text-primary" href="/tests">Search tests</Link>} /> : visits.map((booking) => (
          <Link key={booking.id} href={`/bookings/${booking.id}`} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
            <span>{booking.publicCode} · {booking.tenant.name} · {formatWhen(booking.scheduledAt)}{booking.dependent ? ` · for ${booking.dependent.name}` : ""}</span>
            <StatusPill value={booking.status} />
          </Link>
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-xl">Reminder messages</h2>
        {reminderNotices.length === 0 ? <p className="text-sm text-muted-foreground">Reminder emails and WhatsApp messages are sent by the notification worker before your visit.</p> : reminderNotices.map((row) => {
          const preview = notificationPreview(row.templateKey, (row.payload ?? {}) as Record<string, string>);
          return <p key={row.id} className="rounded-xl border px-3 py-2 text-sm">{preview.text}</p>;
        })}
      </section>
    </>
  );
}
