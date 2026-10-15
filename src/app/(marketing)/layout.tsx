import { headers } from "next/headers";
import { CenterProfileHeader } from "@/components/center-profile/center-profile-header";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { centerProfileSlugFromPath } from "@/lib/center-profile-path";
import { loadCenterProfile } from "@/lib/services/center-profile";
import { getCenterByDomain } from "@/lib/services/catalog";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const host = headerList.get("x-tenant-host");
  const pathname = headerList.get("x-pathname") ?? "";
  const brand = await getCenterByDomain(host);
  const profileSlug = centerProfileSlugFromPath(pathname);
  const profileCenter = profileSlug ? await loadCenterProfile(profileSlug) : null;
  const brandChip = brand ? { name: brand.name, brandColor: brand.brandColor } : null;

  return (
    <div style={brand ? ({ ["--primary" as string]: brand.brandColor } as React.CSSProperties) : undefined}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-3">Skip to content</a>
      {profileCenter ? (
        <CenterProfileHeader center={profileCenter} showDirectoryLink={!brand} />
      ) : (
        <SiteHeader brand={brandChip} />
      )}
      <div id="content">{children}</div>
      <SiteFooter />
    </div>
  );
}
