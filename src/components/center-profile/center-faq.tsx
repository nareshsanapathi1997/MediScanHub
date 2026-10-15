import { centerFaq } from "@/lib/center-marketing";
import { SectionHeading } from "./section-heading";
import type { CenterProfile } from "./utils";

export function CenterFaq({ center }: { center: CenterProfile }) {
  const items = centerFaq(center);
  return (
    <section id="faq" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4">
      <SectionHeading eyebrow="FAQ" title="Common questions" description={`Quick answers before you book with ${center.name}.`} />
      <dl className="mt-6 divide-y rounded-2xl border bg-card">
        {items.map((item) => (
          <div key={item.q} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-8 sm:py-5">
            <dt className="font-medium">{item.q}</dt>
            <dd className="text-sm text-muted-foreground">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
