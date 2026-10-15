import type { NotificationChannel, Prisma } from "@prisma/client";
import { prismaPrivileged } from "@/lib/db";
import type { Tx } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { deliverMessage } from "@/lib/adapters/notify";
import { getEnv } from "@/lib/env";

const SAFE_KEYS = new Set(["publicCode", "link", "centerName", "when", "window", "recipientName", "planName"]);

export function assertSafePayload(payload: Record<string, string>) {
  for (const [key, value] of Object.entries(payload)) {
    if (!SAFE_KEYS.has(key)) throw new DomainError("NOTIFICATION", `Notifications cannot include "${key}"`, 400);
    if (typeof value !== "string") throw new DomainError("NOTIFICATION", "Notification fields must be text", 400);
  }
}

export function renderTemplate(templateKey: string, payload: Record<string, string>) {
  const link = payload.link ?? "";
  const code = payload.publicCode ?? "your booking";
  const center = payload.centerName ?? "the diagnostic center";
  const when = payload.when ?? "the scheduled time";
  switch (templateKey) {
    case "booking_confirmed":
      return { subject: `Booking ${code} confirmed`, text: `Your visit at ${center} is confirmed for ${when}. Manage it securely: ${link}` };
    case "booking_reminder":
      return { subject: `Reminder for ${code}`, text: `Reminder: ${code} at ${center} is scheduled for ${when}. ${link}` };
    case "booking_cancelled":
      return { subject: `Booking ${code} cancelled`, text: `${code} at ${center} was cancelled. ${link}` };
    case "booking_rescheduled":
      return { subject: `Booking ${code} rescheduled`, text: `${code} at ${center} is now scheduled for ${when}. ${link}` };
    case "home_collection":
      return { subject: `Home collection for ${code}`, text: `Home collection for ${code} at ${center} is planned for ${payload.window ?? when}. ${link}` };
    case "report_ready":
      return { subject: `Report ready for ${code}`, text: `A report for ${code} is ready. Sign in to open it. Results are not included in this message. ${link}` };
    case "subscription_reminder":
      return { subject: `Subscription reminder for ${center}`, text: `${payload.planName ?? "Your subscription"} for ${center} needs attention. ${link}` };
    case "password_reset":
      return { subject: "Reset your MediScan Hub password", text: `Reset your password using this secure link: ${link}` };
    case "invitation":
      return { subject: `Invitation to ${center}`, text: `${payload.recipientName ?? "You"} are invited to ${center}. Accept: ${link}` };
    default:
      throw new DomainError("NOTIFICATION", "Unknown notification template", 400);
  }
}

type Db = Tx | typeof prismaPrivileged;

export async function enqueue(
  db: Db,
  input: {
    tenantId?: string | null;
    userId?: string | null;
    channel: NotificationChannel;
    templateKey: string;
    to: string;
    payload: Record<string, string>;
  },
) {
  assertSafePayload(input.payload);
  renderTemplate(input.templateKey, input.payload);
  return db.notification.create({
    data: {
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      channel: input.channel,
      templateKey: input.templateKey,
      toAddress: input.to,
      payload: input.payload,
      status: "QUEUED",
    },
  });
}

export async function processNotificationQueue(limit = 25) {
  const due = await prismaPrivileged.notification.findMany({
    where: { status: { in: ["QUEUED", "FAILED"] }, nextAttemptAt: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const notice of due) {
    const payload = (notice.payload ?? {}) as Record<string, string>;
    const rendered = renderTemplate(notice.templateKey, payload);
    await prismaPrivileged.notification.update({ where: { id: notice.id }, data: { status: "SENDING" } });
    try {
      if (notice.channel !== "IN_APP") {
        await deliverMessage({
          channel: notice.channel,
          to: notice.toAddress,
          subject: rendered.subject,
          text: rendered.text,
          templateKey: notice.templateKey,
        });
      }
      await prismaPrivileged.notification.update({ where: { id: notice.id }, data: { status: "SENT", attempts: { increment: 1 } } });
      await prismaPrivileged.notificationDeliveryAttempt.create({
        data: { notificationId: notice.id, attempt: notice.attempts + 1, status: "SENT" },
      });
      sent += 1;
    } catch (error) {
      const attempts = notice.attempts + 1;
      const delay = Math.min(60 * 60 * 1000, 1000 * 2 ** attempts);
      await prismaPrivileged.notification.update({
        where: { id: notice.id },
        data: {
          status: attempts >= 5 ? "FAILED" : "QUEUED",
          attempts,
          nextAttemptAt: new Date(Date.now() + delay),
        },
      });
      await prismaPrivileged.notificationDeliveryAttempt.create({
        data: {
          notificationId: notice.id,
          attempt: attempts,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Delivery failed",
        },
      });
      failed += 1;
    }
  }
  return { processed: due.length, sent, failed, provider: getEnv().NOTIFICATION_PROVIDER };
}

export async function enqueueAndPump(db: Db, input: Parameters<typeof enqueue>[1]) {
  const row = await enqueue(db, input);
  if (getEnv().NODE_ENV !== "test") {
    await processNotificationQueue(20).catch(() => undefined);
  }
  return row;
}

export async function enqueueBookingReminders() {
  const start = new Date();
  const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const bookings = await prismaPrivileged.booking.findMany({
    where: { status: "CONFIRMED", scheduledAt: { gte: start, lte: end } },
    include: { patient: { include: { user: { select: { email: true, phone: true } } } }, tenant: { select: { id: true, name: true } } },
    take: 100,
  });
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
  let created = 0;
  for (const booking of bookings) {
    const recent = await prismaPrivileged.notification.findMany({
      where: { tenantId: booking.tenantId, userId: booking.patient.userId, templateKey: "booking_reminder", createdAt: { gt: since } },
      take: 8,
    });
    if (recent.some((notice) => asPayload(notice.payload).publicCode === booking.publicCode)) continue;
    const payload = {
      publicCode: booking.publicCode,
      centerName: booking.tenant.name,
      when: booking.scheduledAt.toISOString(),
      link: `${getEnv().APP_URL}/bookings/${booking.id}`,
    };
    await enqueue(prismaPrivileged, { tenantId: booking.tenantId, userId: booking.patient.userId, channel: "EMAIL", templateKey: "booking_reminder", to: booking.patient.user.email, payload });
    await enqueue(prismaPrivileged, { tenantId: booking.tenantId, userId: booking.patient.userId, channel: "IN_APP", templateKey: "booking_reminder", to: booking.patient.user.email, payload });
    if (booking.patient.user.phone) {
      await enqueue(prismaPrivileged, { tenantId: booking.tenantId, userId: booking.patient.userId, channel: "WHATSAPP", templateKey: "booking_reminder", to: booking.patient.user.phone, payload });
    }
    created += 1;
  }
  return created;
}

export async function listNotifications(tenantId: string | null, take = 50) {
  return prismaPrivileged.notification.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: "desc" },
    take,
    include: { deliveries: { orderBy: { attempt: "desc" }, take: 3 } },
  });
}

export function asPayload(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}
