import Link from "next/link";
import { searchServices, listCenters } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Imaging" };

export default async function ImagingPage() {
  const [studies, centers] = await Promise.all([
    searchServices({ kind: "IMAGING" }),
    listCenters(),
  ]);
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10">
      <PageHeader
        eyebrow="Imaging"
        title="X-ray, ultrasound, CT and MRI"
        description="Book a scan at a center near you. You get the radiologist's report and scan images in My reports after the doctor checks them."
      />
      <section className="grid gap-4 md:grid-cols-3">
        {["Pick a scan and a time", "Follow the preparation", "Get your report online"].map((item) => (
          <article key={item} className="rounded-2xl border bg-card p-4">
            <h2 className="font-display text-2xl">{item}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Each scan has its own preparation (for example, a full bladder for a pelvic ultrasound). Read it on the booking page. Please carry your doctor’s prescription and old reports.</p>
          </article>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-3xl">Scans you can book</h2>
        {studies.length === 0 ? <p className="text-sm text-muted-foreground">No scan is available to book right now. Please check again later.</p> : studies.map((study) => (
          <article key={study.id} className="flex flex-col justify-between gap-2 rounded-2xl border bg-card p-4 sm:flex-row">
            <div>
              <h3 className="font-medium">{study.name}</h3>
              <p className="text-sm text-muted-foreground">{study.tenant.name} · {study.tenant.city} · {study.modality ?? "Scan"}</p>
              <p className="text-sm">{study.preparation}</p>
            </div>
            <div className="text-sm">
              <p>{formatInr((study.prices[0]?.pricePaise ?? 0) - (study.prices[0]?.discountPaise ?? 0))}</p>
              <Link className="text-primary" href={`/centers/${study.tenant.slug}?service=${study.id}`}>Book this scan</Link>
            </div>
          </article>
        ))}
      </section>
      <p className="text-sm text-muted-foreground">{centers.length} verified centers are listed. Preparation advice is shown on your booking page.</p>
    </main>
  );
}
