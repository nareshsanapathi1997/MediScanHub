"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto grid max-w-lg gap-4 px-4 py-24">
      <h1 className="font-display text-4xl">Something interrupted this page</h1>
      <p className="text-sm text-muted-foreground">{error.message || "Try again. If this keeps happening, the action was rejected by a permission or validation check."}</p>
      <button type="button" className="h-10 w-fit rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => reset()}>Try again</button>
    </main>
  );
}
