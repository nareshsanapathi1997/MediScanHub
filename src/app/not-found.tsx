import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-lg gap-4 px-4 py-24 text-center">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">404</p>
      <h1 className="font-display text-4xl">That page is not on this desk</h1>
      <p className="text-sm text-muted-foreground">The record may belong to another center, or the link is out of date. Cross-center records stay hidden.</p>
      <Link href="/" className="text-sm font-medium text-primary">Return home</Link>
    </main>
  );
}
