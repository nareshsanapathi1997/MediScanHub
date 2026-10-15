import Image from "next/image";
import { galleryItems } from "@/lib/center-marketing";
import { SectionHeading } from "./section-heading";
import type { CenterProfile } from "./utils";

export function CenterGallery({ center }: { center: CenterProfile }) {
  const items = galleryItems(center);
  if (items.length === 0) return null;
  return (
    <section id="gallery" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4">
      <SectionHeading
        eyebrow="Our facility"
        title="Inside the center"
        description="Sample photography for this demonstration profile. Owners can replace these with real branch photos from the org console."
      />
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ url, caption }) => (
          <li key={url} className="group overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              <Image src={url} alt={caption} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" sizes="(max-width: 640px) 100vw, 25vw" />
            </div>
            <p className="border-t px-3 py-2.5 text-sm text-muted-foreground">{caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
