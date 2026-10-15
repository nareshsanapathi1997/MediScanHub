import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
