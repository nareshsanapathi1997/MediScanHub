import Link from "next/link";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { currentSession } from "@/server/session";
import { homeFor } from "@/domain/actor";
import { buttonVariants } from "@/components/ui/button";

const links = [
  ["Tests", "/tests"],
  ["Packages", "/packages"],
  ["Imaging", "/imaging"],
  ["Home collection", "/home-collection"],
  ["Centers", "/centers"],
  ["Compare", "/centers/compare"],
];

export async function SiteHeader({ brand }: { brand?: { name: string; brandColor: string } | null }) {
  const session = await currentSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="MediScan Hub home"><Logo /></Link>
        <nav className="hidden items-center gap-5 text-sm md:flex" aria-label="Primary">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="font-medium text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
          ))}
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
      <nav className="flex gap-4 overflow-x-auto px-4 pb-3 text-sm md:hidden" aria-label="Mobile">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="whitespace-nowrap text-muted-foreground">{label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">Bookings, samples, imaging slots, and released reports for diagnostic centers. One codebase, strict tenant isolation.</p>
        </div>
        <div className="grid gap-2 text-sm">
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/onboarding">List your center</Link>
        </div>
        <div className="grid gap-2 text-sm">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cancellation">Cancellation</Link>
        </div>
      </div>
    </footer>
  );
}
