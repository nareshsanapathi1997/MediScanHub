"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

/** Primary links with the current section highlighted. */
export function NavLinks({ links, variant }: { links: ReadonlyArray<readonly [string, string]>; variant: "desktop" | "mobile" }) {
  const pathname = usePathname() ?? "/";
  const active = (href: string) => (href === "/centers" ? pathname === "/centers" || (pathname.startsWith("/centers/") && !pathname.startsWith("/centers/compare")) : pathname === href || pathname.startsWith(`${href}/`));
  if (variant === "mobile") {
    return (
      <>
        {links.map(([label, href]) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("inline-flex h-8 shrink-0 items-center rounded-full px-3 whitespace-nowrap transition-colors", active(href) ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>{label}</Link>
        ))}
      </>
    );
  }
  return (
    <>
      {links.map(([label, href]) => (
        <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("inline-flex h-9 items-center rounded-lg px-3 font-medium transition-colors", active(href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{label}</Link>
      ))}
    </>
  );
}
