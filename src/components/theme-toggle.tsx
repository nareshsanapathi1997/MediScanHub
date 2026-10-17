"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@/components/icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the saved theme; use a neutral label until the client has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = !mounted ? "Change theme" : dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </Button>
  );
}
