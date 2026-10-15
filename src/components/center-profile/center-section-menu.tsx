"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CenterSectionLink } from "./section-links";

export function CenterSectionMenu({
  links,
  centerName,
  signedIn,
  deskHref,
}: {
  links: CenterSectionLink[];
  centerName: string;
  signedIn: boolean;
  deskHref: string | null;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" size="icon" className="size-9 shrink-0 md:hidden" aria-label="Open page sections" />}
      >
        <Menu className="size-4" aria-hidden />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,20rem)]">
        <SheetHeader>
          <SheetTitle className="text-left font-display text-lg">{centerName}</SheetTitle>
        </SheetHeader>
        <nav aria-label="Page sections" className="mt-6 grid gap-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mt-6 border-t pt-4 md:hidden" aria-label="Account">
          {signedIn && deskHref ? (
            <a
              href={deskHref}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm text-primary-foreground"
            >
              Open desk
            </a>
          ) : (
            <div className="grid gap-1">
              <a href="/login" className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                Sign in
              </a>
              <a
                href="/register"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm text-primary-foreground"
              >
                Create account
              </a>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
