"use client";

export default function ConsoleError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-6">
      <h1 className="font-display text-3xl">This desk could not finish the request</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button type="button" className="h-10 w-fit rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => reset()}>Retry</button>
    </div>
  );
}
