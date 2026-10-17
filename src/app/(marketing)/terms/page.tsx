import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="home-canvas">
      <div className="home-band border-b">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <PageHeader eyebrow="Terms" title="Terms of use" />
        </div>
      </div>
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:py-10">
        <div className="grid gap-4 rounded-2xl border bg-card/90 p-6 text-[15px] leading-7 text-foreground/85 sm:p-8">
          <p>MediScan Hub is software that lets diagnostic centers list their tests, take bookings and share reports. The center that does your test is responsible for the quality of the test, the report and the prices shown.</p>
          <p>Prices are in Indian rupees (₹) and are confirmed at checkout. Your booking is confirmed only after the payment is received by the center.</p>
          <p>Your report shows values and normal ranges. It is not medical advice. Please consult your doctor.</p>
          <p>Demo accounts and the demo password are only for testing. They must never be used with real patient data.</p>
        </div>
      </div>
    </main>
  );
}
