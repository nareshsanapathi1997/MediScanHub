import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listSlots } from "@/lib/services/catalog";
import { listScanSlots } from "@/lib/services/scan-rooms";
import { scanModalityFor, type ScanModality } from "@/domain/scan-scheduling";
import { loadCenterProfile } from "@/lib/services/center-profile";
import { BookingSection, BookingSummary } from "@/components/center-profile/booking-section";
import { BranchesSection } from "@/components/center-profile/branches-section";
import { CenterHero } from "@/components/center-profile/center-hero";
import { CenterGallery } from "@/components/center-profile/center-gallery";
import { CenterAbout } from "@/components/center-profile/center-overview";
import { ContactStrip } from "@/components/center-profile/contact-strip";
import { PackagesSection } from "@/components/center-profile/packages-section";
import { SectionNav } from "@/components/center-profile/section-nav";
import { ServicesSection } from "@/components/center-profile/services-section";
import { centerCoverSrc } from "@/lib/center-marketing";
import { bookingTotal, shiftDay, splitIds, summarize, todayIst, validDay, type ProfileState } from "@/components/center-profile/utils";

type SearchParams = { service?: string; package?: string; branch?: string; day?: string; visit?: string; kind?: string; q?: string };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const center = await loadCenterProfile(slug);
  if (!center) return { title: "Center not found" };
  const description = summarize(center.about, 160);
  const title = `${center.name} · Diagnostic center in ${center.city}`;
  const cover = centerCoverSrc(center);
  return {
    title,
    description,
    alternates: { canonical: `/centers/${center.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

export default async function CenterPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const query = await searchParams;
  const center = await loadCenterProfile(slug);
  if (!center) notFound();

  const branch = center.branches.find((item) => item.id === query.branch) ?? center.branches[0];
  const today = todayIst();
  const day = validDay(query.day, shiftDay(today, 1));
  const chosenServices = splitIds(query.service);
  const chosenPackages = splitIds(query.package);
  const selected = [
    ...center.services.filter((service) => chosenServices.includes(service.id)),
    ...center.packages.filter((pkg) => chosenPackages.includes(pkg.id)).flatMap((pkg) => pkg.items.map((item) => item.service)),
  ];
  let scanModality: ScanModality | null = null;
  let scanError: string | null = null;
  try {
    scanModality = scanModalityFor(selected);
  } catch (error) {
    scanError = error instanceof Error ? error.message : "Book each scan type separately.";
  }
  const scanPrep = [...new Map(selected.filter((service) => service.kind === "IMAGING" && service.preparation).map((service) => [service.id, `${service.name}: ${service.preparation}`])).values()];
  // Scans happen at the center, in a room for that scan type, so they never use home or general slots.
  const visit = !scanModality && query.visit === "HOME_COLLECTION" && branch?.homeCollection ? "HOME_COLLECTION" : "CENTER_VISIT";
  const slots = !branch || scanError
    ? []
    : scanModality
      ? await listScanSlots(branch.id, day, scanModality)
      : await listSlots(branch.id, day, visit === "HOME_COLLECTION" ? "HOME" : "CENTER");

  const knownServices = new Set(center.services.map((service) => service.id));
  const knownPackages = new Set(center.packages.map((pkg) => pkg.id));
  const state: ProfileState = {
    slug: center.slug,
    services: splitIds(query.service).filter((id) => knownServices.has(id)),
    packages: splitIds(query.package).filter((id) => knownPackages.has(id)),
    branchId: branch?.id ?? "",
    day,
    visit,
    kind: query.kind === "LAB" || query.kind === "IMAGING" ? query.kind : undefined,
    q: query.q?.trim().slice(0, 60) || undefined,
  };

  const booking = bookingTotal(center, state);

  return (
    <main className={booking.count > 0 ? "pb-24 lg:pb-0" : undefined}>
      <CenterHero center={center} />
      <SectionNav hasPackages={center.packages.length > 0} />
      {/* Shopping area: services, packages and slots on the left; the cart follows along on the right. */}
      <div className="home-canvas border-b">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8 sm:gap-12 sm:py-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-x-10">
          <div className="lg:col-start-1"><ServicesSection center={center} state={state} /></div>
          {center.packages.length ? <div className="lg:col-start-1"><PackagesSection center={center} state={state} /></div> : null}
          <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <BookingSummary center={center} state={state} branch={branch} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto" />
          </div>
          <div className="lg:col-start-1"><BookingSection center={center} state={state} branch={branch} slots={slots} today={today} scan={{ modality: scanModality, error: scanError, prep: scanPrep }} /></div>
        </div>
      </div>
      <div className="home-band grid gap-12 py-12 sm:gap-14 sm:py-14">
        <BranchesSection center={center} state={state} />
        <CenterAbout center={center} />
        <CenterGallery center={center} />
        <ContactStrip center={center} />
      </div>
    </main>
  );
}
