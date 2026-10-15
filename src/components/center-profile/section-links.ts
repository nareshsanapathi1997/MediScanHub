export type CenterSectionLink = { href: string; label: string };

export const CENTER_SECTION_LINKS: CenterSectionLink[] = [
  { href: "#about", label: "About" },
  { href: "#gallery", label: "Gallery" },
  { href: "#branches", label: "Branches" },
  { href: "#services", label: "Services" },
  { href: "#packages", label: "Packages" },
  { href: "#book", label: "Book" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function centerSectionLinks(hasPackages: boolean, hasGallery = true): CenterSectionLink[] {
  return CENTER_SECTION_LINKS.filter((link) => {
    if (!hasPackages && link.href === "#packages") return false;
    if (!hasGallery && link.href === "#gallery") return false;
    return true;
  });
}
