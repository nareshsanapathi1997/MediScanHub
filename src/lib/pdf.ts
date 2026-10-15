import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReportPdfInput = {
  centerName: string;
  branchName: string;
  patientName: string;
  synthetic: boolean;
  publicCode: string;
  title: string;
  version: number;
  approvedBy: string;
  releasedAt: Date;
  rows: Array<{ name: string; value: string; unit: string; range: string; flag: string }>;
  disclaimer: string;
};

export async function renderReportPdf(input: ReportPdfInput) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.06, 0.4, 0.38);
  const ink = rgb(0.12, 0.16, 0.2);
  const muted = rgb(0.35, 0.4, 0.45);
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: teal });
  page.drawText("MediScan Hub", { x: 40, y: 812, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.centerName, { x: 40, y: 796, size: 10, font, color: rgb(0.9, 0.97, 0.96) });
  let y = 760;
  const line = (text: string, options?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    page.drawText(text, { x: 40, y, size: options?.size ?? 11, font: options?.bold ? bold : font, color: options?.color ?? ink });
    y -= (options?.size ?? 11) + 8;
  };
  line(input.title, { bold: true, size: 16 });
  line(`${input.branchName}  ·  Booking ${input.publicCode}  ·  Version ${input.version}`, { color: muted, size: 10 });
  if (input.synthetic) line("SYNTHETIC DEMONSTRATION REPORT — NOT A REAL PATIENT", { bold: true, size: 10, color: rgb(0.6, 0.2, 0.15) });
  line(`Patient: ${input.patientName}`);
  line(`Authorized signatory: ${input.approvedBy}`);
  line(`Released: ${input.releasedAt.toISOString()}`);
  y -= 8;
  page.drawText("Parameter", { x: 40, y, size: 10, font: bold, color: teal });
  page.drawText("Result", { x: 230, y, size: 10, font: bold, color: teal });
  page.drawText("Range", { x: 360, y, size: 10, font: bold, color: teal });
  page.drawText("Flag", { x: 490, y, size: 10, font: bold, color: teal });
  y -= 16;
  for (const row of input.rows) {
    if (y < 80) break;
    page.drawText(row.name.slice(0, 32), { x: 40, y, size: 10, font, color: ink });
    page.drawText(`${row.value} ${row.unit}`.trim().slice(0, 22), { x: 230, y, size: 10, font, color: ink });
    page.drawText(row.range.slice(0, 22), { x: 360, y, size: 10, font, color: ink });
    page.drawText(row.flag, { x: 490, y, size: 10, font, color: ink });
    y -= 16;
  }
  y -= 12;
  const words = input.disclaimer.split(" ");
  let sentence = "";
  for (const word of words) {
    const next = sentence ? `${sentence} ${word}` : word;
    if (font.widthOfTextAtSize(next, 9) > 500) {
      page.drawText(sentence, { x: 40, y, size: 9, font, color: muted });
      y -= 12;
      sentence = word;
    } else sentence = next;
  }
  if (sentence) page.drawText(sentence, { x: 40, y, size: 9, font, color: muted });
  return Buffer.from(await pdf.save());
}
