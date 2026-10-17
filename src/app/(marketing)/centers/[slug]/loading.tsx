import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the center page, so the layout does not jump when it loads. */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading center">
      <Skeleton className="h-36 w-full rounded-none sm:h-48 lg:h-56" />
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-10">
        <Skeleton className="-mt-12 size-24 rounded-3xl border-4 border-background sm:size-28" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-16 w-full max-w-2xl" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-14 w-full" />
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)}
        </div>
        <Skeleton className="hidden h-56 w-full lg:block" />
      </div>
    </main>
  );
}
