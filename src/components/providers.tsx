"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { FlashToast } from "@/components/flash-toast";

export function Providers({ children, flash }: { children: React.ReactNode; flash?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
        <FlashToast flash={flash} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
