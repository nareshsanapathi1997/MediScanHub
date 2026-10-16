"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { schemas, type SchemaId } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/widgets";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/server/actions";

export type FieldSpec = {
  name: string;
  label?: string;
  type?: "text" | "email" | "password" | "date" | "tel" | "textarea" | "select" | "checkbox" | "hidden";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  rows?: number;
  span?: 1 | 2;
  defaultValue?: string;
};

/**
 * React Hook Form + Zod form that posts to a server action. The same schema runs on the server,
 * so the browser check is a convenience and never the only gate.
 */
export function SchemaForm({
  schema,
  action,
  fields,
  submit,
  success = "Saved.",
  columns = 1,
}: {
  schema: SchemaId;
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  fields: FieldSpec[];
  submit: string;
  success?: string;
  columns?: 1 | 2;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "", idle: true });
  const defaults = Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? (field.type === "checkbox" ? false : field.type === "select" ? field.options?.[0]?.value ?? "" : "")]));
  const form = useForm({ resolver: zodResolver(schemas[schema] as never), defaultValues: defaults, mode: "onTouched" });
  const done = !pending && !state.error && !state.idle && !state.redirectTo;
  useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);
  useEffect(() => {
    if (done) toast.success(success);
  }, [done, success]);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const onValid = (values: Record<string, unknown>) => {
    const data = new FormData();
    for (const field of fields) {
      const value = values[field.name];
      if (field.type === "checkbox") {
        if (value === true || value === "on") data.set(field.name, "on");
      } else if (value != null) data.set(field.name, String(value));
    }
    startTransition(() => formAction(data));
  };

  return (
    <form noValidate onSubmit={form.handleSubmit((values) => onValid(values as Record<string, unknown>))} className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
      {fields.map((field) => {
        const error = form.formState.errors[field.name]?.message as string | undefined;
        const id = `f-${field.name}`;
        const describedBy = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined;
        if (field.type === "hidden") return <input key={field.name} type="hidden" {...form.register(field.name)} />;
        if (field.type === "checkbox") {
          return (
            <div key={field.name} className={cn("grid gap-1", columns === 2 && "sm:col-span-2")}>
              <label htmlFor={id} className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3 text-sm leading-relaxed">
                <input id={id} type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" aria-invalid={Boolean(error)} aria-describedby={describedBy} {...form.register(field.name)} />
                <span>{field.label}</span>
              </label>
              {error ? <p id={`${id}-error`} className="text-xs font-medium text-destructive">{error}</p> : null}
            </div>
          );
        }
        const common = { id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, placeholder: field.placeholder, autoComplete: field.autoComplete, ...form.register(field.name) };
        return (
          <div key={field.name} className={cn("field", (field.span === 2 || field.type === "textarea") && columns === 2 && "sm:col-span-2")}>
            <label htmlFor={id}>{field.label}</label>
            {field.type === "textarea" ? (
              <textarea rows={field.rows ?? 3} {...common} />
            ) : field.type === "select" ? (
              <select {...common}>
                {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <input type={field.type ?? "text"} {...common} />
            )}
            {error ? <p id={`${id}-error`} className="text-xs font-medium text-destructive">{error}</p> : field.hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{field.hint}</p> : null}
          </div>
        );
      })}
      <div className={cn("grid gap-3", columns === 2 && "sm:col-span-2")}>
        <ErrorNote message={state.error} />
        {state.devLink ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs break-all">Development delivery link: <a className="underline" href={state.devLink}>{state.devLink}</a></p>
        ) : null}
        <Button type="submit" disabled={pending} className="h-11 text-sm font-semibold">
          {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden /> Working…</> : submit}
        </Button>
      </div>
    </form>
  );
}
