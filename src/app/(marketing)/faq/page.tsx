import Link from "next/link";
import { FaqList } from "@/components/marketing/cards";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata = { title: "FAQ" };

const items = [
  ["Who can see my report?", "Only you and the staff of the center that did your test. Other centers cannot open it."],
  ["Why can't I see my report yet?", "A doctor at the center checks every report before release. Blood test reports are usually ready in 24 hours and scans in 1–2 days. We will message you when it is ready."],
  ["Can I cancel my booking?", "Yes, before your visit starts. Open the booking and tap Cancel. If you paid online, the center refunds the money to the same account, usually in 5–7 working days."],
  ["What do High, Low and Critical mean?", "They mean your value is outside the normal range for your age and sex. It is not a diagnosis. Please talk to your doctor about your report."],
  ["Will I get my X-ray or MRI images?", "Yes, if the center uploads them. The radiologist's report (PDF) and, when the center uploads them, the original scan files (DICOM) appear in My reports after release. You can download the files and give them to your doctor."],
  ["Do I need to fast before a blood test?", "For fasting blood sugar and lipid profile, do not eat for 10–12 hours. You can drink plain water. Most other tests, like CBC and thyroid profile, do not need fasting."],
];

export default function FaqPage() {
  return (
    <main>
      <PageHero
        eyebrow="FAQ"
        title="Common questions"
        description="Simple answers about booking, reports and payments."
        pageKey="faq"
        imageAlt="Calm clinic hallway with medical supplies"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:py-10">
          <FaqList items={items as Array<[string, string]>} />
          <p className="text-sm text-muted-foreground">Didn’t find your answer? <Link href="/contact" className="font-medium text-primary hover:underline">Write to us</Link> and we will reply within 1 working day.</p>
        </div>
      </div>
    </main>
  );
}
