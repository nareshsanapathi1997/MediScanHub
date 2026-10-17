"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

function readFlashCookie(): { kind?: string; message?: string; id?: string } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )ms_flash=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

/** Shows the outcome of a plain form action (see `guarded` in server/actions.ts), then clears the cookie. */
export function FlashToast() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const parsed = readFlashCookie();
    if (!parsed?.id || !parsed.message) return;
    if (parsed.kind === "error") {
      setErrorMessage(parsed.message);
      toast.error(parsed.message, { id: parsed.id });
    } else {
      toast.success(parsed.message, { id: parsed.id });
    }
    document.cookie = "ms_flash=; Max-Age=0; path=/; SameSite=Lax";
  }, []);

  return errorMessage ? <p role="alert" className="sr-only">{errorMessage}</p> : null;
}
