import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
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

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const tone = value.includes("CANCEL") || value.includes("REJECT") || value.includes("FAIL") || value === "CRITICAL" || value === "HIGH" || value === "LOW"
    ? "destructive"
    : value === "RELEASED" || value === "COMPLETED" || value === "PAID" || value === "NORMAL" || value === "ACTIVE" || value === "CAPTURED"
      ? "default"
      : "secondary";
  return <Badge variant={tone}>{titleCase(value)}</Badge>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AccessDenied({ need }: { need?: string }) {
  return (
    <EmptyState
      title="This desk is locked"
      body={need ?? "Your role does not include this workspace. Use the navigation for the areas assigned to you."}
      action={<Link className="text-sm font-medium text-primary underline" href="/console">Back to your home</Link>}
    />
  );
}

export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm", props.className)} />;
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
