import "dotenv/config";
import { enqueueBookingReminders, processNotificationQueue } from "../src/lib/services/notify";
import { refreshSubscriptionStates } from "../src/lib/services/subscription";

async function main() {
  const sent = await processNotificationQueue(100);
  const reminders = await enqueueBookingReminders();
  const subs = await refreshSubscriptionStates();
  console.log(JSON.stringify({ sent, reminders, subs, at: new Date().toISOString() }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
