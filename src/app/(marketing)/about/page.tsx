import { PageHeader } from "@/components/widgets";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <PageHeader eyebrow="About" title="One marketplace, many centers" description="MediScan Hub runs a public directory and a private desk for each diagnostic organization. A center can point its own hostname at the same application." />
      <div className="grid gap-4 text-sm leading-6">
        <p>Patients search tests, hold a slot, and pay. Staff at the assigned branch collect samples, enter values, and release a report only after a person with approval rights signs it. Numbers are flagged against configured reference ranges. The product does not diagnose.</p>
        <p>Each organization is a tenant. Branches, prices, samples, and reports stay inside that tenant. Postgres row-level security is a second lock behind the application checks. A request cannot choose another center by sending a tenant id.</p>
        <p>The demonstration database is labeled synthetic. It is not a clinical record of any real person. Indian DPDP, ABDM, and clinical establishment rules need a legal review before a production launch. This software does not claim those certifications.</p>
      </div>
    </main>
  );
}
