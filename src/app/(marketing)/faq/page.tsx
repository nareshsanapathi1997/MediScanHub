import { PageHeader } from "@/components/widgets";

export const metadata = { title: "FAQ" };

const items = [
  ["Who can see my report?", "Only you and the staff of the center that did your test. Other centers cannot open it."],
  ["Why can't I see my report yet?", "A doctor at the center checks every report before release. Blood test reports are usually ready in 24 hours and scans in 1–2 days. We will message you when it is ready."],
  ["Can I cancel my booking?", "Yes, before your visit starts. Open the booking and tap Cancel. If you paid online, the center refunds the money to the same account, usually in 5–7 working days."],
  ["What do High, Low and Critical mean?", "They mean your value is outside the normal range for your age and sex. It is not a diagnosis. Please talk to your doctor about your report."],
  ["Will I get my X-ray or MRI images?", "Yes, if the center uploads them. Scan images (JPG/PNG) and the radiologist's report (PDF) appear in My reports after release. Full DICOM files are not stored here; ask the center for a CD if your doctor needs one."],
  ["Do I need to fast before a blood test?", "For fasting blood sugar and lipid profile, do not eat for 10–12 hours. You can drink plain water. Most other tests, like CBC and thyroid profile, do not need fasting."],
];

export default function FaqPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <PageHeader eyebrow="FAQ" title="Common questions" description="Simple answers about booking, reports and payments." />
      <div className="grid gap-4">
        {items.map(([question, answer]) => (
          <article key={question} className="rounded-2xl border bg-card p-4">
            <h2 className="font-display text-2xl">{question}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
