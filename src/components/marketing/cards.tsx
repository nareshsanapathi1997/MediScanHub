import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Check, ChevronDown, FlaskConical, Home, ImageOff, Info, MapPin, PackageCheck, ScanLine, Timer } from "lucide-react";
import { formatInr } from "@/lib/format";
import { modalityLabel } from "@/domain/scan-scheduling";
import { tatLabel } from "@/components/center-profile/utils";
import { centerCoverSrc, imageObjectPosition } from "@/lib/center-marketing";
import { cn } from "cn";
import { ListView } from "@/components/list-view";

/** Section title used on every public page, so headings line up the same way everywhere. */
export function SectionTitle({ eyebrow, title, description, action, id }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1.5">
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p> : null}
        <h2 id={id} className="font-display text-2xl tracking-tight sm:text-3xl">{title}</h2>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{children}<ArrowRight className="size-4" aria-hidden /></Link>;
}

type Price = { pricePaise: number; discountPaise: number } | undefined;

export function priceOf(price: Price) {
  if (!price) return null;
  return { final: price.pricePaise - price.discountPaise, original: price.pricePaise, discounted: price.discountPaise > 0 };
}

export type TestCardData = {
  id: string;
  name: string;
  description: string;
  kind: string;
  modality?: string | null;
  tatHours: number;
  sampleType?: string | null;
  preparation?: string | null;
  category: { name: string };
  tenant: { name: string; slug: string; city: string };
  prices: Array<{ pricePaise: number; discountPaise: number }>;
};

/** One test or scan offered by one center, with its price and a single clear action. */
export function TestCard({ test, layout = "card", showPrep = false }: { test: TestCardData; layout?: "card" | "row"; showPrep?: boolean }) {
  const price = priceOf(test.prices[0]);
  const scan = test.kind === "IMAGING";
  const Icon = scan ? ScanLine : FlaskConical;
  const href = `/centers/${test.tenant.slug}?service=${test.id}#book`;
  return (
    <article className={cn("group grid content-between gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md", layout === "row" && "sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6")}>
      <div className="flex min-w-0 gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", scan ? "bg-info/12 text-info" : "bg-accent text-accent-foreground")}><Icon className="size-5" aria-hidden /></span>
        <div className="grid min-w-0 gap-1.5">
          <p className="text-xs text-muted-foreground">{scan && test.modality ? modalityLabel(test.modality) : test.category.name}</p>
          <h3 className="leading-snug font-medium text-pretty">{test.name}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{test.description}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" aria-hidden />{test.tenant.name}, {test.tenant.city}</span>
            <span className="inline-flex items-center gap-1"><Timer className="size-3.5" aria-hidden />{tatLabel(test.tatHours)}</span>
          </p>
          {showPrep && test.preparation ? <p className="flex gap-1.5 text-xs text-muted-foreground"><Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden /><span><span className="font-medium text-foreground">Preparation: </span>{test.preparation}</span></p> : null}
        </div>
      </div>
      <div className={cn("flex items-center justify-between gap-4 border-t pt-4", layout === "row" && "sm:border-t-0 sm:pt-0")}>
        {price ? (
          <p className="grid">
            <span className="font-display text-xl leading-tight tabular-nums">{formatInr(price.final)}</span>
            {price.discounted ? <span className="text-xs text-muted-foreground line-through">{formatInr(price.original)}</span> : null}
          </p>
        ) : <p className="text-sm text-muted-foreground">Price on request</p>}
        <Link href={href} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
          Book<span className="sr-only"> {test.name} at {test.tenant.name}</span><ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export type PackageCardData = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  tenant: { name: string; slug: string; city?: string };
  items: Array<{ serviceId: string; service: { name: string } }>;
};

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  const shown = pkg.items.slice(0, 5);
  return (
    <article className="grid content-between gap-5 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><PackageCheck className="size-5" aria-hidden /></span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{pkg.items.length} tests</span>
        </div>
        <h3 className="font-display text-xl leading-snug">{pkg.name}</h3>
        <p className="text-sm text-muted-foreground">{pkg.description}</p>
        <ul className="grid gap-1 text-sm">
          {shown.map((item) => <li key={item.serviceId} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{item.service.name}</li>)}
          {pkg.items.length > shown.length ? <li className="pl-6 text-xs text-muted-foreground">and {pkg.items.length - shown.length} more</li> : null}
        </ul>
      </div>
      <div className="grid gap-3 border-t pt-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="size-3.5" aria-hidden />{pkg.tenant.name}{pkg.tenant.city ? `, ${pkg.tenant.city}` : ""}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-2xl tabular-nums">{formatInr(pkg.pricePaise)}</span>
          <Link href={`/centers/${pkg.tenant.slug}?package=${pkg.id}#book`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            Book package<span className="sr-only"> {pkg.name}</span><ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

export type CenterCardData = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  brandColor: string;
  logoUrl: string | null;
  coverImageUrl?: string | null;
  branches: Array<{ id: string; name: string; city: string; homeCollection: boolean }>;
};

export function CenterCard({ center }: { center: CenterCardData }) {
  const home = center.branches.some((branch) => branch.homeCollection);
  const brand = /^#[0-9a-f]{6}$/i.test(center.brandColor) ? center.brandColor : "#0F766E";
  const cover = centerCoverSrc({ coverImageUrl: center.coverImageUrl ?? null });
  return (
    <Link
      href={`/centers/${center.slug}`}
      className="group grid h-full content-between overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            className={cn(
              "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
              imageObjectPosition(cover),
            )}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center gap-1.5 bg-gradient-to-br from-muted to-muted/60 text-muted-foreground">
            <ImageOff className="size-7 opacity-70" aria-hidden />
            <span className="text-xs font-medium">No photo yet</span>
          </div>
        )}
      </div>
      <div className="grid gap-5 p-5">
        <div className="flex items-start gap-4">
          {center.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={center.logoUrl} alt="" className="size-14 shrink-0 rounded-2xl border bg-card object-contain p-1.5" />
          ) : (
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl font-display text-xl text-white" style={{ backgroundColor: brand }}>{center.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
          )}
          <div className="grid min-w-0 gap-1">
            <h3 className="font-display text-xl leading-tight group-hover:text-primary">{center.name}</h3>
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" aria-hidden />{center.city}, {center.state}</p>
          </div>
        </div>
        <div className="grid gap-3">
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {center.branches.slice(0, 3).map((branch) => <li key={branch.id} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{branch.name}</li>)}
            {center.branches.length > 3 ? <li className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">+{center.branches.length - 3} more</li> : null}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
            <span className="text-muted-foreground">{center.branches.length} {center.branches.length === 1 ? "branch" : "branches"}{home ? <> · <Home className="inline size-3.5 align-[-2px]" aria-hidden /> Home collection</> : null}</span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">View<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Accessible accordion built on <details>, so it works without JavaScript. */
export function FaqList({ items, className }: { items: Array<[string, string] | { q: string; a: string }>; className?: string }) {
  const rows = items.map((item) => (Array.isArray(item) ? { q: item[0], a: item[1] } : item));
  return (
    <div className={cn("divide-y rounded-2xl border bg-card", className)}>
      {rows.map((item) => (
        <details key={item.q} className="group px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="pb-4 text-sm text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function EmptyResults({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

const bookLink = "inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90";

function PriceCell({ price }: { price: ReturnType<typeof priceOf> }) {
  if (!price) return <span className="text-muted-foreground">On request</span>;
  return (
    <span className="grid justify-items-end leading-tight">
      <span className="font-semibold">{formatInr(price.final)}</span>
      {price.discounted ? <span className="text-[11px] text-muted-foreground line-through">{formatInr(price.original)}</span> : null}
    </span>
  );
}

/** List view of tests: name, type, center, report time, price and Book. */
export function TestList({ tests, label = "Tests" }: { tests: TestCardData[]; label?: string }) {
  return (
    <ListView
      label={label}
      columns={[
        { key: "name", label: "Test" },
        { key: "type", label: "Type" },
        { key: "center", label: "Center" },
        { key: "tat", label: "Report" },
        { key: "price", label: "Price", align: "right" },
      ]}
      rows={tests.map((test) => ({
        id: test.id,
        href: `/centers/${test.tenant.slug}?service=${test.id}#book`,
        cells: {
          name: test.name,
          type: test.kind === "IMAGING" && test.modality ? modalityLabel(test.modality) : test.category.name,
          center: `${test.tenant.name}, ${test.tenant.city}`,
          tat: tatLabel(test.tatHours),
          price: <PriceCell price={priceOf(test.prices[0])} />,
        },
        actions: <Link href={`/centers/${test.tenant.slug}?service=${test.id}#book`} className={bookLink}>Book<span className="sr-only"> {test.name} at {test.tenant.name}</span></Link>,
      }))}
    />
  );
}

export function PackageList({ packages, label = "Packages" }: { packages: PackageCardData[]; label?: string }) {
  return (
    <ListView
      label={label}
      columns={[
        { key: "name", label: "Package" },
        { key: "tests", label: "Includes" },
        { key: "center", label: "Center" },
        { key: "price", label: "Price", align: "right" },
      ]}
      rows={packages.map((pkg) => ({
        id: pkg.id,
        href: `/centers/${pkg.tenant.slug}?package=${pkg.id}#book`,
        cells: {
          name: pkg.name,
          tests: `${pkg.items.length} tests`,
          center: `${pkg.tenant.name}${pkg.tenant.city ? `, ${pkg.tenant.city}` : ""}`,
          price: <span className="font-semibold">{formatInr(pkg.pricePaise)}</span>,
        },
        actions: <Link href={`/centers/${pkg.tenant.slug}?package=${pkg.id}#book`} className={bookLink}>Book<span className="sr-only"> {pkg.name}</span></Link>,
      }))}
    />
  );
}

export function CenterList({ centers, label = "Centers" }: { centers: CenterCardData[]; label?: string }) {
  return (
    <ListView
      label={label}
      columns={[
        { key: "name", label: "Center" },
        { key: "city", label: "City" },
        { key: "branches", label: "Branches" },
        { key: "home", label: "Home collection" },
      ]}
      rows={centers.map((center) => ({
        id: center.slug,
        href: `/centers/${center.slug}`,
        cells: {
          name: center.name,
          city: `${center.city}, ${center.state}`,
          branches: `${center.branches.length} ${center.branches.length === 1 ? "branch" : "branches"}`,
          home: center.branches.some((branch) => branch.homeCollection) ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" aria-hidden />Available</span> : <span className="text-muted-foreground">Not listed</span>,
        },
        actions: <Link href={`/centers/${center.slug}`} className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium hover:bg-muted">View<span className="sr-only"> {center.name}</span></Link>,
      }))}
    />
  );
}
