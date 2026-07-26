import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while a notebook loads from the database. Mirrors
// NotebookShell (header · source sidebar · chat/studio pane) so the real
// content lands in the same regions with no layout shift.
export default function NotebookLoading() {
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
        <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r p-4 md:flex">
          <Skeleton className="h-9 w-full rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border p-3">
              <Skeleton className="size-4 shrink-0 rounded" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="px-3 pt-3">
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="border-t p-3">
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </main>
      </div>
    </div>
  );
}
