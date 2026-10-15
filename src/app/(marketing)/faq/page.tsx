import { PageHeader } from "@/components/widgets";

export const metadata = { title: "FAQ" };

const items = [
  ["Who can see my report?", "You, and staff at the center that performed the test, according to their role. Another center receives a not-found response, not your file."],
  ["Why is a result missing?", "Unapproved results are not final. A released PDF appears after verification and approval. Messages only carry a sign-in link."],
  ["Can I cancel?", "Pending and confirmed visits can be cancelled from the booking page. Later states are handled by the center. Refunds are recorded by finance staff and checked on the server."],
  ["What does a flag mean?", "Low, high, or critical means the value sits outside the reference range configured for that parameter, age, and sex. It is not a diagnosis."],
  ["Do you store DICOM images?", "No. Imaging orders track modality, room, accession, and report status. PACS integration is not enabled."],
];

export default function FaqPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <PageHeader eyebrow="FAQ" title="Questions patients and owners ask" />
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
