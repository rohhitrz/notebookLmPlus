import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while the learning project loads from the database, so
// clicking a project gives immediate feedback instead of a frozen screen.
// Mirrors LearnShell's layout (header · roadmap sidebar · lesson pane) so the
// real content drops into the same regions with no jump.
export default function LearnLoading() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">← Library</span>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-96 shrink-0 flex-col gap-4 overflow-y-auto border-r p-4 md:flex">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-2 w-full rounded-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border p-3">
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="mt-1 h-8 w-28 rounded-md" />
            </div>
          ))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
            <Skeleton className="h-7 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="aspect-[3/2] w-full rounded-xl" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-4"
                  style={{ width: `${[100, 96, 90, 98, 82, 70][i]}%` }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
