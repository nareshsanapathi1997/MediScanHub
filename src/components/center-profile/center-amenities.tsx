import { centerAmenities } from "@/lib/center-marketing";
import { SectionHeading } from "./section-heading";
import type { CenterProfile } from "./utils";

export function CenterAmenities({ center }: { center: CenterProfile }) {
  const items = centerAmenities(center);
  return (
    <section id="facilities" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4">
      <SectionHeading eyebrow="Patient experience" title="What you can expect" />
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 className="font-display text-lg">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
