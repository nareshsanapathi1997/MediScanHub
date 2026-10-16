import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "MediScan Hub", template: "%s · MediScan Hub" },
  description: "Multi-tenant diagnostic center and laboratory operations for bookings, samples, imaging, and released reports.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MediScan Hub" },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const flash = (await cookies()).get("ms_flash")?.value;
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground antialiased">
        <Providers flash={flash}>{children}</Providers>
      </body>
    </html>
  );
}
