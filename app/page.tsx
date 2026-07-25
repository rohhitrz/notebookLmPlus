import { desc, eq } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { NotebookGrid } from "@/components/notebook-grid";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/lib/db/schema";

export default async function Home() {
  const userId = await requireUser();
  const rows = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, userId))
    .orderBy(desc(notebooks.createdAt));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">Curio</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <NotebookGrid notebooks={rows} />
      </main>
    </div>
  );
}
