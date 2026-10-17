import Link from "next/link";
import { Inbox, Lock, Trash2, type LucideIcon } from "@/components/icons";
import { Check as CheckIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { titleCase } from "@/lib/format";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, body, action, icon: Icon = Inbox, as = "h2" }: { title: string; body: string; action?: React.ReactNode; icon?: LucideIcon; as?: "h1" | "h2" }) {
  const Heading = as;
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
      <Heading className="mt-4 font-display text-2xl">{title}</Heading>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const TONES = {
  danger: "bg-destructive/12 text-destructive ring-destructive/25",
  success: "bg-success/12 text-success ring-success/25",
  warning: "bg-warning/15 text-[oklch(0.5_0.12_65)] dark:text-warning ring-warning/30",
  info: "bg-info/12 text-info ring-info/25",
  neutral: "bg-muted text-muted-foreground ring-border",
} as const;

function toneFor(value: string): keyof typeof TONES {
  if (/CANCEL|REJECT|FAIL|CRITICAL|SUSPEND|OVERDUE|EXPIRED|VOID|LOCKED/.test(value) || value === "HIGH" || value === "LOW" || value === "ABNORMAL") return "danger";
  if (["RELEASED", "COMPLETED", "PAID", "NORMAL", "ACTIVE", "CAPTURED", "APPROVED", "RESULTED", "DELIVERED", "SENT", "COLLECTED", "REPORTED", "SUCCEEDED", "ACCEPTED"].includes(value)) return "success";
  if (["PENDING", "REQUESTED", "DRAFT", "ISSUED", "PENDING_REVIEW", "TRIAL", "QUEUED", "RECOLLECTION", "PAST_DUE", "CREATED"].includes(value)) return "warning";
  if (["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "PROCESSING", "RECEIVED", "IN_TRANSIT", "ENTERED", "VERIFIED", "ASSIGNED", "EN_ROUTE", "SCHEDULED", "ACQUIRED", "AMENDED", "REFUNDED"].includes(value)) return "info";
  return "neutral";
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONES[toneFor(value)])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {titleCase(value)}
    </span>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: string; hint?: string; icon?: LucideIcon; tone?: "primary" | "info" | "success" | "warning" | "danger" }) {
  const ring = { primary: "bg-primary/10 text-primary", info: "bg-info/12 text-info", success: "bg-success/12 text-success", warning: "bg-warning/15 text-[oklch(0.5_0.12_65)] dark:text-warning", danger: "bg-destructive/12 text-destructive" }[tone];
  return (
    <div className="surface relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {Icon ? <span className={cn("hidden size-9 shrink-0 place-items-center rounded-xl sm:grid", ring)}><Icon className="size-4" aria-hidden /></span> : null}
      </div>
      <p className="mt-2 font-display text-2xl tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface p-5", className)}>
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AccessDenied({ need }: { need?: string }) {
  return (
    <EmptyState
      as="h1"
      icon={Lock}
      title="This desk is locked"
      body={need ?? "Your role does not include this workspace. Use the navigation for the areas assigned to you."}
      action={<Link className="text-sm font-medium text-primary underline" href="/console">Back to your home</Link>}
    />
  );
}

export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href ? <Link href={item.href} className="hover:text-foreground">{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            {index < items.length - 1 ? <span aria-hidden="true">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{message}</p>;
}

/** Main content with a side column for the "add new" form; stacks on smaller screens with the form after the list. */
export function Workspace({ children, aside, asideFirst = false }: { children: React.ReactNode; aside: React.ReactNode; asideFirst?: boolean }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
      <div className={cn("grid min-w-0 content-start gap-6", asideFirst && "order-2 xl:order-1")}>{children}</div>
      <div className={cn("grid content-start gap-6 xl:sticky xl:top-20", asideFirst && "order-1 xl:order-2")}>{aside}</div>
    </div>
  );
}

/** A labelled row of facts, e.g. "Valid until · 31 Mar 2027". */
export function Facts({ items, className }: { items: Array<{ label: string; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Rows inside a Panel; each row is a flex line with a leading icon tile. */
export function ItemList({ children }: { children: React.ReactNode }) {
  return <ul className="-mx-5 -mb-5 divide-y border-t">{children}</ul>;
}

export function Item({ icon: Icon, title, meta, trailing, children, tone = "primary" }: { icon?: LucideIcon; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode; children?: React.ReactNode; tone?: "primary" | "info" | "success" | "warning" | "danger" | "muted" }) {
  const toneClass = { primary: "bg-primary/10 text-primary", info: "bg-info/12 text-info", success: "bg-success/12 text-success", warning: "bg-warning/15 text-[oklch(0.5_0.12_65)] dark:text-warning", danger: "bg-destructive/12 text-destructive", muted: "bg-muted text-muted-foreground" }[tone];
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      {Icon ? <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneClass)}><Icon className="size-4" aria-hidden /></span> : null}
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 font-medium">{title}</div>
          {trailing}
        </div>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
        {children}
      </div>
    </li>
  );
}

/** Small trailing "Remove" button for list rows; the action is a plain server action form. */
export function RemoveForm({ action, id, label }: { action: (form: FormData) => void | Promise<void>; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label={label}>
        <Trash2 className="size-3.5" aria-hidden />Remove
      </button>
    </form>
  );
}

/** Horizontal progress steps. `current` is the index of the active step; `complete` marks every step done. */
export function Steps({ steps, current, complete = false, label }: { steps: string[]; current: number; complete?: boolean; label: string }) {
  return (
    <ol className="surface grid gap-1 p-3 sm:p-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={label}>
      {steps.map((step, position) => {
        const done = complete || position < current;
        const active = !complete && position === current;
        return (
          <li key={step} className="relative grid justify-items-center gap-1.5 text-center" aria-current={active ? "step" : undefined}>
            {position > 0 ? <span aria-hidden className={cn("absolute top-3.5 right-1/2 h-0.5 w-full", position <= current || complete ? "bg-primary" : "bg-muted-foreground/25")} /> : null}
            <span className={cn("relative grid size-7 place-items-center rounded-full text-xs font-semibold ring-4 ring-card", done ? "bg-primary text-primary-foreground" : active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
              {done ? <CheckIcon className="size-3.5" aria-hidden /> : position + 1}
            </span>
            <span className={cn("text-[11px] leading-tight sm:text-xs", active ? "font-semibold" : done ? "font-medium" : "text-muted-foreground")}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
