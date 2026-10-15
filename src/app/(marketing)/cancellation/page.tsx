import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Cancellation" };

export default function CancellationPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <PageHeader eyebrow="Cancellation" title="Visits and subscriptions" />
      <p>A patient can cancel a pending or confirmed visit from the booking page. The slot is released inside the same transaction. Checked-in and in-progress visits are cancelled by center staff with a reason. A completed visit is not cancelled; finance records a refund when one is due.</p>
      <p>Center owners can cancel a subscription from the subscription page. Access continues until the current period ends, and reminders go out before expiry. Downgrades that would exceed the new branch limit are refused.</p>
      <p>Refund timing depends on the payment provider. In the local mock provider, refunds are recorded immediately after signature checks. Razorpay refunds use the provider API when those credentials are configured.</p>
    </main>
  );
}
