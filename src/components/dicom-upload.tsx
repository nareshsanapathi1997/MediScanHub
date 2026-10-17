"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_MB = 500;

function readCookie(name: string) {
  return document.cookie.split("; ").find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

/**
 * Uploads one DICOM file or a zipped study straight to the API as the request body, with a progress bar.
 * Large files never pass through a server action, so the 500 MB limit is real.
 */
export function DicomUploadForm({ reportId, items }: { reportId: string; items: { id: string; name: string }[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [itemId, setItemId] = useState(items.length === 1 ? items[0]!.id : "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a .dcm file or a .zip of the study.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`The file is too large. The limit is ${MAX_MB} MB.`);
    const params = new URLSearchParams({ reportId, name: file.name });
    if (itemId) params.set("bookingItemId", itemId);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/v1/uploads/dicom?${params.toString()}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("x-csrf-token", decodeURIComponent(readCookie("ms_csrf")));
    xhr.upload.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
    };
    xhr.onload = () => {
      let message = "Upload failed. Please try again.";
      try {
        const body = JSON.parse(xhr.responseText) as { ok: boolean; data?: { dicom?: { imageCount: number; seriesCount: number } }; error?: { message: string } };
        if (body.ok) {
          const dicom = body.data?.dicom;
          const note = dicom ? ` ${dicom.imageCount} image(s) in ${dicom.seriesCount} series.` : "";
          document.cookie = `ms_flash=${encodeURIComponent(JSON.stringify({ kind: "ok", message: `DICOM study uploaded.${note} The patient can download it after release.`, id: String(Date.now()) }))}; path=/; max-age=60; samesite=lax`;
          window.location.reload();
          return;
        }
        message = body.error?.message ?? message;
      } catch {
        if (xhr.status === 413) message = `The file is too large. The limit is ${MAX_MB} MB.`;
      }
      setProgress(null);
      setError(message);
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("The upload stopped. Check your connection and try again.");
    };
    setProgress(0);
    xhr.send(file);
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-dashed p-3" aria-label="Upload DICOM study">
      <p className="text-sm font-medium">DICOM study (.dcm file or a .zip of the study folder, up to {MAX_MB} MB)</p>
      <p className="text-xs text-muted-foreground">We read only the scan type, study date and number of series and images. The patient downloads the original file. This is not a PACS and there is no viewer here.</p>
      <label className="field">DICOM file
        <input ref={fileRef} name="dicom" type="file" required accept=".dcm,.dicom,.zip,application/dicom,application/zip" disabled={progress !== null} />
      </label>
      {items.length > 1 ? (
        <label className="field">For which scan?
          <select value={itemId} onChange={(event) => setItemId(event.target.value)} disabled={progress !== null}>
            <option value="">Whole booking</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
      {progress !== null ? (
        <div className="grid gap-1" role="status" aria-live="polite">
          <progress max={100} value={progress} className="h-2 w-full" />
          <span className="text-xs text-muted-foreground">{progress < 100 ? `Uploading… ${progress}%` : "Checking the DICOM files…"}</span>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="outline" className="w-full sm:w-fit" disabled={progress !== null}><Upload className="size-4" aria-hidden />Upload DICOM</Button>
    </form>
  );
}
