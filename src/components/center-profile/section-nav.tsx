import { centerSectionLinks } from "./section-links";

export function SectionNav({ hasPackages }: { hasPackages: boolean }) {
  const links = centerSectionLinks(hasPackages);
  return (
    <nav aria-label="Page sections" className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md md:hidden">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="inline-flex h-8 items-center rounded-full px-3 whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{link.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
