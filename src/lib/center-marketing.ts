import type { CenterProfile } from "@/components/center-profile/utils";

const GALLERY_CAPTIONS: Record<string, Record<string, string>> = {
  "apex-diagnostics": {
    "/centers/apex-diagnostics/gallery-reception.svg": "Spacious reception with digital queue display",
    "/centers/apex-diagnostics/gallery-lab.svg": "Automated analyzers for CBC and chemistry panels",
    "/centers/apex-diagnostics/gallery-imaging.svg": "Dedicated ultrasound suite with same-day slots",
    "/centers/apex-diagnostics/gallery-home-collection.svg": "GPS-tracked phlebotomy visits across Jubilee Hills",
  },
};

export function galleryItems(center: Pick<CenterProfile, "slug" | "name" | "galleryUrls">) {
  const captions = GALLERY_CAPTIONS[center.slug] ?? {};
  return center.galleryUrls.map((url) => ({
    url,
    caption: captions[url] ?? center.name,
  }));
}

const AMENITIES = [
  { title: "Digital reports", body: "PDF reports land in your MediScan inbox with optional doctor sharing." },
  { title: "Parking & accessibility", body: "Ground-floor sample collection and wheelchair-friendly entrances at both branches." },
  { title: "Corporate tie-ups", body: "Annual health camps, bulk invoicing, and dedicated relationship managers." },
  { title: "Quality controls", body: "Daily QC runs and barcode tracking from draw to report release." },
];

export function centerAmenities(_center: CenterProfile) {
  return AMENITIES;
}

export function centerFaq(center: CenterProfile) {
  const home = center.branches.some((b) => b.homeCollection);
  return [
    {
      q: "Do I need to fast before my blood tests?",
      a: "Fasting is required only for select panels such as lipid profile or glucose tolerance. Each test card on this page lists preparation notes. When in doubt, call the center before your visit.",
    },
    {
      q: "How quickly will I receive my report?",
      a: "Routine hematology and biochemistry reports are typically released within the turnaround time shown on each test. Imaging reports may take longer when a radiologist review is required.",
    },
    ...(home
      ? [
          {
            q: "Is home sample collection available?",
            a: `${center.name} offers home collection from branches marked with home collection. Choose a home visit slot at checkout and our phlebotomist will confirm your address window.`,
          },
        ]
      : []),
    {
      q: "Can I book for a family member?",
      a: "Yes. Add tests to your booking, pick a slot, and enter the patient details at checkout. Reports are stored under the patient profile you specify.",
    },
    {
      q: "What should I bring to the center?",
      a: "Carry a valid photo ID, any prior prescriptions or reports, and your booking confirmation. For imaging, arrive 10 minutes early for registration.",
    },
  ];
}
