import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <PageHeader eyebrow="Privacy" title="Privacy" />
      <p>We store your name, email, mobile number and a protected (hashed) password. For your bookings we store the tests, samples, results and reports of the center that did the test.</p>
      <p>Your reports and uploaded files are kept in private storage. A download link works only after you sign in and only for 5 minutes. Messages on SMS, email or WhatsApp never contain your results.</p>
      <p>You can download a copy of your data from Account and ask us to delete your account. When you delete it, we remove your login and contact details. The center may keep your test records as required by law.</p>
      <p>Every view, change, approval, release and download of a report is recorded in an audit log. All data on this demo is synthetic (made up). Do not enter real patient details here.</p>
    </main>
  );
}
