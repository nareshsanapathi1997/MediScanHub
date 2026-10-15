import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listSlots } from "@/lib/services/catalog";
import { loadCenterProfile } from "@/lib/services/center-profile";
import { BookingSection } from "@/components/center-profile/booking-section";
import { BranchesSection } from "@/components/center-profile/branches-section";
import { CenterHero } from "@/components/center-profile/center-hero";
import { CenterAmenities } from "@/components/center-profile/center-amenities";
import { CenterFaq } from "@/components/center-profile/center-faq";
import { CenterGallery } from "@/components/center-profile/center-gallery";
import { CenterAbout, CenterStats, WhyChoose } from "@/components/center-profile/center-overview";
import { ContactStrip } from "@/components/center-profile/contact-strip";
import { PackagesSection } from "@/components/center-profile/packages-section";
import { SectionNav } from "@/components/center-profile/section-nav";
import { ServicesSection } from "@/components/center-profile/services-section";
import { bookingTotal, shiftDay, splitIds, summarize, todayIst, validDay, type ProfileState } from "@/components/center-profile/utils";

type SearchParams = { service?: string; package?: string; branch?: string; day?: string; visit?: string; kind?: string };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const center = await loadCenterProfile(slug);
  if (!center) return { title: "Center not found" };
  const description = summarize(center.about, 160);
  const title = `${center.name} · Diagnostic center in ${center.city}`;
  return {
    title,
    description,
    alternates: { canonical: `/centers/${center.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      ...((center.coverImageUrl ?? center.logoUrl)
        ? { images: [{ url: center.coverImageUrl ?? center.logoUrl! }] }
        : {}),
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
  const visit = query.visit === "HOME_COLLECTION" && branch?.homeCollection ? "HOME_COLLECTION" : "CENTER_VISIT";
  const slots = branch ? await listSlots(branch.id, day, visit === "HOME_COLLECTION" ? "HOME" : "CENTER") : [];

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
  };

  const booking = bookingTotal(center, state);

  return (
    <main className={booking.count > 0 ? "pb-24 lg:pb-0" : undefined}>
      <CenterHero center={center} />
      <SectionNav hasPackages={center.packages.length > 0} hasGallery={center.galleryUrls.length > 0} />
      <div className="grid gap-14 pb-20 sm:gap-16">
        <CenterStats center={center} />
        <CenterAbout center={center} />
        <CenterGallery center={center} />
        <CenterAmenities center={center} />
        <BranchesSection center={center} state={state} />
        <ServicesSection center={center} state={state} />
        <PackagesSection center={center} state={state} />
        <BookingSection center={center} state={state} branch={branch} slots={slots} today={today} />
        <WhyChoose centerName={center.name} />
        <CenterFaq center={center} />
        <ContactStrip center={center} />
      </div>
    </main>
  );
}
