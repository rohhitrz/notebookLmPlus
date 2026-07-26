import { Skeleton } from "@/components/ui/skeleton";

// Instant feedback for the home page — shown while the notebook list loads,
// including when navigating back via "← Library" from a project.
export default function HomeLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">Curio</span>
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-36 rounded-md" />
              <Skeleton className="h-10 w-36 rounded-md" />
            </div>
          </section>

          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-28" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border p-6">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
