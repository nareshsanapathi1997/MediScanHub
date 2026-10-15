"use client";

import { createContext, useActionState, useContext, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/widgets";
import { StickyFieldsProvider } from "@/components/sticky-field";
import type { ActionState } from "@/server/actions";

const FormBoxStateContext = createContext<ActionState>({ error: "" });

export function useFormBoxState() {
  return useContext(FormBoxStateContext);
}

/** Server error tied to a specific input (see ActionState.field). */
export function FieldError({ name }: { name: string }) {
  const state = useFormBoxState();
  if (state.field !== name || !state.error) return null;
  return <p className="text-xs text-destructive" role="alert">{state.error}</p>;
}

export function FormBox({
  action,
  submit,
  children,
  success = "Saved.",
  encType,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  submit: string;
  children: React.ReactNode;
  success?: string;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState(action, { error: "", idle: true });
  const done = !pending && !state.error && !state.idle;
  const bannerError = state.error && !state.field ? state.error : "";
  useEffect(() => {
    if (done) toast.success(success);
  }, [done, success]);
  return (
    <FormBoxStateContext.Provider value={state}>
      <form action={formAction} className="grid gap-3" encType={encType}>
        <StickyFieldsProvider fields={state.fields}>{children}</StickyFieldsProvider>
        <ErrorNote message={bannerError} />
        {done ? <p className="text-sm text-primary">{success}</p> : null}
        {state.devLink ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs break-all">
            Development delivery link: <a className="underline" href={state.devLink}>{state.devLink}</a>
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="h-10">{pending ? "Working…" : submit}</Button>
      </form>
    </FormBoxStateContext.Provider>
  );
}
