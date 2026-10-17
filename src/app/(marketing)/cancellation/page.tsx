import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Cancellation" };

export default function CancellationPage() {
  return (
    <main className="home-canvas">
      <div className="home-band border-b">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <PageHeader eyebrow="Cancellation" title="Cancellation and refunds" />
        </div>
      </div>
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:py-10">
        <div className="grid gap-4 rounded-2xl border bg-card/90 p-6 text-[15px] leading-7 text-foreground/85 sm:p-8">
          <p>You can cancel a booking before your visit starts. Open the booking and tap Cancel. The time slot is released for others at once.</p>
          <p>After you check in at the center, only the center staff can cancel the visit, and they must give a reason.</p>
          <p>If you paid online, the center refunds the money to the same card, UPI or bank account. Refunds usually reach you in 5–7 working days, depending on your bank.</p>
          <p>Centers can cancel their MediScan Hub plan from the Subscription page. They keep access until the end of the paid period.</p>
        </div>
      </div>
    </main>
  );
}
