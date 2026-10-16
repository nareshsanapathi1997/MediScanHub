"use client";

import { useState } from "react";

/**
 * Posts a plain server action and then reloads the page. `guarded` actions answer with no
 * RSC tree (they only set a flash cookie), so the reload shows fresh data and the toast.
 * A full reload is used deliberately: in-place router refreshes after an action could stall
 * the client in the Next 15.5 production build.
 */
export function ActionForm({
  action,
  children,
  className,
  id,
}: {
  action: (form: FormData) => void | Promise<void>;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form
      id={id}
      className={className}
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          await action(new FormData(event.currentTarget));
        } finally {
          window.location.reload();
        }
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
