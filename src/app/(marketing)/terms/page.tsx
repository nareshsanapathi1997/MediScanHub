import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <PageHeader eyebrow="Terms" title="Terms of use" />
      <p>MediScan Hub is software that lets diagnostic centers list their tests, take bookings and share reports. The center that does your test is responsible for the quality of the test, the report and the prices shown.</p>
      <p>Prices are in Indian rupees (₹) and are confirmed at checkout. Your booking is confirmed only after the payment is received by the center.</p>
      <p>Your report shows values and normal ranges. It is not medical advice. Please consult your doctor.</p>
      <p>Demo accounts and the demo password are only for testing. They must never be used with real patient data.</p>
    </main>
  );
}
