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
        title="Modality slots without a pretend PACS"
        description="Ultrasound and other imaging visits use the same booking desk as lab tests. Study status is tracked here. DICOM and PACS are not connected; pacsStatus stays NOT_INTEGRATED until a site wires a real archive."
      />
      <section className="grid gap-4 md:grid-cols-3">
        {["Modality and room", "Preparation on the order", "Report after a named reviewer"].map((item) => (
          <article key={item} className="rounded-2xl border bg-card p-4">
            <h2 className="font-display text-2xl">{item}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Equipment schedules and accession numbers live in the center workspace. Images are not stored in this application.</p>
          </article>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-3xl">Published imaging services</h2>
        {studies.length === 0 ? <p className="text-sm text-muted-foreground">No imaging service is published yet.</p> : studies.map((study) => (
          <article key={study.id} className="flex flex-col justify-between gap-2 rounded-2xl border bg-card p-4 sm:flex-row">
            <div>
              <h3 className="font-medium">{study.name}</h3>
              <p className="text-sm text-muted-foreground">{study.tenant.name} · {study.tenant.city} · {study.modality ?? "Modality listed at the center"}</p>
              <p className="text-sm">{study.preparation}</p>
            </div>
            <div className="text-sm">
              <p>{formatInr((study.prices[0]?.pricePaise ?? 0) - (study.prices[0]?.discountPaise ?? 0))}</p>
              <Link className="text-primary" href={`/centers/${study.tenant.slug}?service=${study.id}`}>Choose a slot</Link>
            </div>
          </article>
        ))}
      </section>
      <p className="text-sm text-muted-foreground">{centers.length} active centers are in the directory. Prep instructions travel with the imaging order, not in a chat message.</p>
    </main>
  );
}
