import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "cn";
import { galleryItems, imageObjectPosition } from "@/lib/center-marketing";
import { SectionHeading } from "./section-heading";
import type { CenterProfile } from "./utils";

export function CenterGallery({ center }: { center: CenterProfile }) {
  const { items } = galleryItems(center);
  return (
    <section id="gallery" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4">
      <SectionHeading
        eyebrow="Our facility"
        title="Inside the center"
        description={
          items.length > 0
            ? "Photos from this center. Owners can replace these anytime from the org console."
            : "Facility photos will appear here once the center uploads them."
        }
      />
      {items.length === 0 ? (
        <div className="mt-6 grid place-items-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-6 py-14 text-center">
          <ImageOff className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No photos yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This center has not added gallery images. Owners can upload them from the org console.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-5 lg:gap-3">
          {items.map(({ url, caption }, index) => (
            <li key={`${url}-${index}`} className="group overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <Image
                  src={url}
                  alt={caption}
                  fill
                  className={cn(
                    "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]",
                    imageObjectPosition(url),
                  )}
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
              <p className="truncate px-2.5 py-1.5 text-xs leading-snug text-muted-foreground">{caption}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
