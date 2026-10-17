import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-lg justify-items-center gap-4 px-4 py-24 text-center">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Page not found</p>
      <h1 className="font-display text-4xl text-balance">We could not find that page</h1>
      <p className="text-sm text-muted-foreground">The link may be old, or the page belongs to another center. Records from other centers always stay hidden.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants()}>Go to home</Link>
        <Link href="/tests" className={buttonVariants({ variant: "outline" })}>Find a test</Link>
      </div>
    </main>
  );
}
