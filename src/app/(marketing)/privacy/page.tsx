import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10 text-sm leading-6">
      <PageHeader eyebrow="Privacy" title="What this application stores" />
      <p>Account data includes name, email, phone, and a password hash. Clinical data includes bookings, samples, results, and released reports for the center that performed the service. Payment provider secrets stay on the server. Files sit in private storage and are opened with a short-lived check of your session.</p>
      <p>You can export your patient record from Account, and you can request deletion. Deletion anonymizes your login and contact fields and revokes sessions. Clinical rows are retained so the center can meet record-keeping duties. That split is an engineering choice and still needs counsel under the DPDP Act and applicable clinical establishment rules.</p>
      <p>Audit logs record views, edits, approvals, exports, and releases. Demonstration data is synthetic and labeled. Do not enter real patient information into a local demo.</p>
    </main>
  );
}
