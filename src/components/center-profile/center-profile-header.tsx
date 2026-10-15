import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { homeFor } from "@/domain/actor";
import { currentSession } from "@/server/session";
import { CenterSectionMenu } from "./center-section-menu";
import { centerSectionLinks } from "./section-links";
import { initials, safeColor, type CenterProfile } from "./utils";

export async function CenterProfileHeader({
  center,
  showDirectoryLink,
}: {
  center: CenterProfile;
  showDirectoryLink: boolean;
}) {
  const session = await currentSession();
  const brand = safeColor(center.brandColor, "#0F766E");
  const links = centerSectionLinks(center.packages.length > 0, center.galleryUrls.length > 0);
  const deskHref = session ? homeFor(session.actor) : null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {showDirectoryLink ? (
            <Link
              href="/centers"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to centers directory"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          ) : null}
          <Link href={`/centers/${center.slug}`} className="flex min-w-0 items-center gap-2.5">
            {center.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={center.logoUrl}
                alt=""
                className="size-9 shrink-0 rounded-xl border bg-card object-contain p-1 shadow-sm"
              />
            ) : (
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: brand }}
              >
                {initials(center.name)}
              </span>
            )}
            <span className="truncate font-display text-base tracking-tight sm:text-lg">{center.name}</span>
          </Link>
        </div>
        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Page sections">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex h-8 items-center rounded-full px-3 whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {session && deskHref ? (
              <Link href={deskHref} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                Open desk
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-2 py-2 text-sm">
                  Sign in
                </Link>
                <Link href="/register" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                  Create account
                </Link>
              </>
            )}
          </div>
          <CenterSectionMenu links={links} centerName={center.name} deskHref={deskHref} signedIn={Boolean(session)} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
