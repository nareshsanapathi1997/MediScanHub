import { PageHero } from "@/components/marketing/page-hero";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow="About"
        title="About MediScan Hub"
        description="MediScan Hub helps you find a good diagnostic center, book a test or scan, and get your report on your phone."
        pageKey="about"
        imageAlt="Modern diagnostic center waiting area"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:py-10">
          <div className="grid gap-4 rounded-2xl border bg-card/90 p-6 text-[15px] leading-7 text-foreground/85 sm:p-8">
            <p>You can search for a test like CBC, LFT, KFT, thyroid profile or HbA1c, or a scan like X-ray, ultrasound, CT or MRI. Choose a center near you, pick a time and pay online. Many centers also send a phlebotomist to your home to collect the sample.</p>
            <p>At the center, trained staff collect and test your sample. A pathologist or radiologist checks every report before you can see it. Your report shows your values and the normal range. It is not a diagnosis, so please show it to your doctor.</p>
            <p>Your reports are private. Only you and the staff of the center that did your test can open them. Other centers cannot see your records.</p>
            <p>This is a demo. All patients, centers and reports here are synthetic (made up) and are marked “Synth”. Before real use, the operator must complete legal checks under the DPDP Act, ABDM and the Clinical Establishments rules.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
