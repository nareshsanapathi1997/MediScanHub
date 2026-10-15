import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <PageHeader eyebrow="Terms" title="How the service is offered" />
      <p>MediScan Hub provides software for diagnostic centers to publish a catalog, take bookings, and operate a lab and imaging desk. The center is responsible for clinical quality, authorized sign-off, and the accuracy of prices and reference ranges.</p>
      <p>Patient payments and center subscriptions are separate. A subscription limit can block a new branch, staff seat, or booking. Browser payment screens are not proof of capture; the server verifies the provider signature or webhook.</p>
      <p>Local demo accounts and the password printed in the README are for development only. They must not be loaded into production.</p>
    </main>
  );
}
