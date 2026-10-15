import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { getSample } from "@/lib/services/lab";
import { barcodeSvg } from "@/lib/barcode";
import { DomainError } from "@/lib/errors";
import { Gate } from "@/components/guard";

export const metadata = { title: "Sample label" };

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireSession();
  const { id } = await params;
  return (
    <Gate actor={actor} permission="samples.read">
      <LabelBody id={id} />
    </Gate>
  );
}

async function LabelBody({ id }: { id: string }) {
  const { actor } = await requireSession();
  try {
    const sample = await getSample(actor, id);
    const code = sample.barcode?.code ?? "UNASSIGNED";
    return (
      <article className="mx-auto grid w-[320px] gap-2 rounded-xl border bg-white p-4 text-black print:border-0">
        <p className="text-xs uppercase tracking-wide">Synthetic label</p>
        <h1 className="font-display text-2xl">{code}</h1>
        <div dangerouslySetInnerHTML={{ __html: barcodeSvg(code) }} />
        <p className="text-sm">{sample.service.name}</p>
        <p className="text-sm">{sample.labOrder.booking.publicCode} · {sample.labOrder.booking.branch.name}</p>
        <p className="text-xs print:hidden">Use the browser print dialog for this label.</p>
      </article>
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
}
