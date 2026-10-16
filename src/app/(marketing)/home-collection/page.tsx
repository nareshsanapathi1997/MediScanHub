import Link from "next/link";
import { listCenters } from "@/lib/services/catalog";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Home collection" };

export default async function HomeCollectionPage() {
  const centers = await listCenters();
  const collectors = centers.flatMap((center) => center.branches.filter((branch) => branch.homeCollection).map((branch) => ({ center, branch })));
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10">
      <PageHeader
        eyebrow="Home collection"
        title="Sample collection at home"
        description="A trained phlebotomist comes to your home to collect the blood or urine sample. You get a message with the visit time. Your results are never sent in a message."
      />
      <ol className="grid gap-3 md:grid-cols-3">
        {["Choose a center that offers home collection.", "Pick a time slot and enter your full address with pincode.", "The phlebotomist visits you, collects the sample and takes it to the lab."].map((step, index) => (
          <li key={step} className="rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold text-primary">0{index + 1}</p>
            <p className="mt-2">{step}</p>
          </li>
        ))}
      </ol>
      <section className="grid gap-3">
        {collectors.length === 0 ? <p className="text-sm text-muted-foreground">No center offers home collection in the list right now. Please book a center visit instead, or check again later.</p> : collectors.map(({ center, branch }) => (
          <article key={branch.id} className="flex flex-col justify-between gap-2 rounded-2xl border bg-card p-4 sm:flex-row">
            <div>
              <h2 className="font-display text-2xl">{center.name}</h2>
              <p className="text-sm text-muted-foreground">{branch.name} · {branch.city}</p>
            </div>
            <Link className="text-sm text-primary" href={`/centers/${center.slug}?branch=${branch.id}&visit=HOME_COLLECTION`}>Book home collection</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
