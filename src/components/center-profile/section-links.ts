export type CenterSectionLink = { href: string; label: string };

const CENTER_SECTION_LINKS: CenterSectionLink[] = [
  { href: "#services", label: "Tests & scans" },
  { href: "#packages", label: "Packages" },
  { href: "#book", label: "Book" },
  { href: "#branches", label: "Branches" },
  { href: "#about", label: "About" },
  { href: "#gallery", label: "Gallery" },
  { href: "#contact", label: "Contact" },
];

export function centerSectionLinks(hasPackages: boolean): CenterSectionLink[] {
  return CENTER_SECTION_LINKS.filter((link) => {
    if (!hasPackages && link.href === "#packages") return false;
    return true;
  });
}
