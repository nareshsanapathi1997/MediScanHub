import { FileImage, FileText, Upload, Trash2 } from "@/components/icons";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/widgets";
import { formatBytes, formatWhen } from "@/lib/format";
import { removeReportFileAction, uploadReportFileAction } from "@/server/actions";
import { REPORT_FILE_MAX_MB } from "@/lib/services/report-files";

export type ReportFileRow = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: string;
  createdAt: Date;
  bookingItem: { name: string } | null;
};

export const KIND_LABEL: Record<string, string> = {
  LAB_REPORT: "Lab report (scanned)",
  SCAN_IMAGE: "Scan image (X-ray, CT, MRI, ultrasound)",
  SCAN_REPORT: "Scan report (radiologist)",
  OTHER: "Other document",
};

/** One file row with an Open link. The link checks access and redirects to a five-minute signed URL. */
export function ReportFileList({ files, onRemove }: { files: ReportFileRow[]; onRemove?: boolean }) {
  return (
    <ul className="grid gap-2 text-sm">
      {files.map((file) => {
        const Icon = file.contentType.startsWith("image/") ? FileImage : FileText;
        return (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-medium">{file.fileName}</span>
                <span className="block text-xs text-muted-foreground">
                  {KIND_LABEL[file.kind] ?? file.kind}{file.bookingItem ? ` · ${file.bookingItem.name}` : ""} · {formatBytes(file.sizeBytes)} · {formatWhen(file.createdAt)}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-2">
              <a className="font-medium text-primary underline-offset-2 hover:underline" href={`/api/v1/report-files/${file.id}/open`} target="_blank" rel="noopener">
                Open<span className="sr-only"> {file.fileName}</span>
              </a>
              {onRemove ? (
                <ActionForm action={removeReportFileAction}>
                  <input type="hidden" name="fileId" value={file.id} />
                  <Button type="submit" size="sm" variant="ghost" aria-label={`Remove ${file.fileName}`}><Trash2 className="size-4" aria-hidden /></Button>
                </ActionForm>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Staff panel on the report page: list, upload and remove files while the report is still open for changes. */
export function ReportFilesPanel({
  reportId,
  files,
  items,
  canManage,
  open,
  imaging,
}: {
  reportId: string;
  files: ReportFileRow[];
  items: { id: string; name: string }[];
  canManage: boolean;
  open: boolean;
  imaging: boolean;
}) {
  return (
    <Panel
      title="Report files"
      description={imaging ? "Upload scan images and the radiologist's report. The patient sees them only after release." : "Upload scanned blood reports or machine printouts. The patient sees them only after release."}
    >
      {files.length === 0 ? <p className="text-sm text-muted-foreground">No files uploaded yet.</p> : <ReportFileList files={files} onRemove={canManage && open} />}
      {canManage && open ? (
        <ActionForm action={uploadReportFileAction} className="mt-4 grid gap-3 rounded-xl border border-dashed p-3">
          <input type="hidden" name="reportId" value={reportId} />
          <label className="field">File (PDF, JPG or PNG, up to {REPORT_FILE_MAX_MB} MB)
            <input name="file" type="file" required accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" />
          </label>
          <label className="field">What is this file?
            <select name="kind" defaultValue={imaging ? "SCAN_IMAGE" : "LAB_REPORT"}>
              {Object.entries(KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {items.length > 1 ? (
            <label className="field">For which test?
              <select name="bookingItemId" defaultValue="">
                <option value="">Whole booking</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : items.length === 1 ? <input type="hidden" name="bookingItemId" value={items[0]!.id} /> : null}
          <Button type="submit" className="w-full sm:w-fit"><Upload className="size-4" aria-hidden />Upload file</Button>
        </ActionForm>
      ) : canManage ? (
        <p className="mt-3 text-sm text-muted-foreground">Files are locked after verification. Send the report back to change them.</p>
      ) : null}
    </Panel>
  );
}
