import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Cancellation" };

export default function CancellationPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <PageHeader eyebrow="Cancellation" title="Cancellation and refunds" />
      <p>You can cancel a booking before your visit starts. Open the booking and tap Cancel. The time slot is released for others at once.</p>
      <p>After you check in at the center, only the center staff can cancel the visit, and they must give a reason.</p>
      <p>If you paid online, the center refunds the money to the same card, UPI or bank account. Refunds usually reach you in 5–7 working days, depending on your bank.</p>
      <p>Centers can cancel their MediScan Hub plan from the Subscription page. They keep access until the end of the paid period.</p>
    </main>
  );
}
