"use client";

import Link from "next/link";
import { toast } from "sonner";

const PULSE_KEY = "center-selection-pulse";
const SCROLL_KEY = "center-selection-scroll";

/** Client wrapper around profile toggle links — instant toast without changing URL behavior. */
export function ProfileToggleLink({
  href,
  selected,
  itemName,
  className,
  children,
}: {
  href: string;
  selected: boolean;
  itemName: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={className}
      onClick={() => {
        if (selected) {
          toast.message(`${itemName} removed from your booking`);
          return;
        }
        toast.success(`Added to your booking`, { description: itemName });
        try {
          sessionStorage.setItem(PULSE_KEY, "1");
          if (window.matchMedia("(max-width: 1023px)").matches) {
            sessionStorage.setItem(SCROLL_KEY, "1");
          }
        } catch {
          /* private mode */
        }
      }}
    >
      {children}
    </Link>
  );
}

export { PULSE_KEY, SCROLL_KEY };
