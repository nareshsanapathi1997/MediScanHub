"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Shows the outcome of a plain form action (see `guarded` in server/actions.ts), then clears the cookie. */
export function FlashToast({ flash }: { flash?: string }) {
  let parsed: { kind?: string; message?: string; id?: string } | null = null;
  try {
    parsed = flash ? JSON.parse(flash) : null;
  } catch {
    parsed = null;
  }
  const id = parsed?.id;
  const kind = parsed?.kind;
  const message = parsed?.message;
  useEffect(() => {
    if (!id || !message) return;
    if (kind === "error") toast.error(message, { id });
    else toast.success(message, { id });
    document.cookie = "ms_flash=; Max-Age=0; path=/; SameSite=Lax";
  }, [id, kind, message]);
  return kind === "error" && message ? <p role="alert" className="sr-only">{message}</p> : null;
}
