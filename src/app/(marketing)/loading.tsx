import { PageSkeleton } from "@/components/widgets";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <PageSkeleton />
    </main>
  );
}
