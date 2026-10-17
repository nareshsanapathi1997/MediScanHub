import Link from "next/link";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { currentSession } from "@/server/session";
import { homeFor } from "@/domain/actor";
import { buttonVariants } from "@/components/ui/button";
import { NavLinks } from "@/components/marketing/nav-links";

const links = [
  ["Tests", "/tests"],
  ["Scans", "/imaging"],
  ["Packages", "/packages"],
  ["Home collection", "/home-collection"],
  ["Centers", "/centers"],
  ["Compare", "/centers/compare"],
] as const;

export async function SiteHeader({ brand }: { brand?: { name: string; brandColor: string } | null }) {
  const session = await currentSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="MediScan Hub home"><Logo /></Link>
        <nav className="hidden items-center gap-1 text-sm lg:flex" aria-label="Primary">
          <NavLinks links={links} variant="desktop" />
        </nav>
        <div className="flex items-center gap-2">
          {brand ? <span className="hidden rounded-full px-2 py-1 text-xs text-white sm:inline" style={{ background: brand.brandColor }}>{brand.name}</span> : null}
          <ThemeToggle />
          {session ? (
            <Link href={homeFor(session.actor)} className={buttonVariants({ size: "sm" })}>Open desk</Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ size: "sm", variant: "ghost" })}>Sign in</Link>
              <Link href="/register" className={buttonVariants({ size: "sm", className: "hidden sm:inline-flex" })}>Create account</Link>
            </>
          )}
        </div>
      </div>
      <nav className="-mt-1 flex gap-1 overflow-x-auto px-3 pb-2.5 text-sm lg:hidden" aria-label="Mobile">
        <NavLinks links={links} variant="mobile" />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Book blood tests, scans and health checkups at reviewed diagnostic centers. Get your report on your phone.</p>
        </div>
        <FooterColumn title="For patients" links={[["Find a test", "/tests"], ["Book a scan", "/imaging"], ["Health packages", "/packages"], ["Home collection", "/home-collection"]]} />
        <FooterColumn title="MediScan" links={[["About us", "/about"], ["Help and FAQ", "/faq"], ["Contact", "/contact"], ["List your center", "/onboarding"]]} />
        <FooterColumn title="Policies" links={[["Privacy", "/privacy"], ["Terms", "/terms"], ["Cancellation and refunds", "/cancellation"]]} />
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground">© {year} MediScan Hub · Demo with synthetic data. Reports are not a diagnosis; please show them to your doctor.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <nav aria-label={title} className="grid content-start gap-2.5 text-sm">
      <p className="font-medium">{title}</p>
      {links.map(([label, href]) => <Link key={href} href={href} className="text-muted-foreground transition-colors hover:text-foreground">{label}</Link>)}
    </nav>
  );
}
