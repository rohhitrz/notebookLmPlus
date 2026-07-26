import { and, eq, isNotNull, lt } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

// A file source is uploaded by the browser in three steps (get signed URL → PUT
// to Storage → ask the server to index). If the tab is closed or reloaded
// between the last two, indexing is never requested and the row would sit on
// "uploading" forever. Anything older than this that is still "uploading" is
// treated as orphaned and picked up here.
const ORPHAN_AFTER_MS = 60_000;

// Claims orphaned uploads and resumes indexing. The status flip is conditional
// on the row still being "uploading", so concurrent pollers can't start the same
// source twice — only the one whose UPDATE returns a row proceeds.
async function resumeOrphanedUploads(notebookId: string): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_AFTER_MS);

  const claimed = await db
    .update(sources)
    .set({ status: "extracting" })
    .where(
      and(
        eq(sources.notebookId, notebookId),
        eq(sources.status, "uploading"),
        isNotNull(sources.origin), // the file did reach Storage
        lt(sources.createdAt, cutoff),
      ),
    )
    .returning({ id: sources.id });

  if (claimed.length === 0) return;

  after(async () => {
    const { processSource } = await import("@/lib/ingest/pipeline");
    for (const { id } of claimed) {
      try {
        await processSource(id);
      } catch (err) {
        console.error(`[sources] resume processSource(${id}) failed`, err);
        await db
          .update(sources)
          .set({
            status: "error",
            errorMessage:
              err instanceof Error ? err.message.slice(0, 500) : "Indexing failed",
          })
          .where(eq(sources.id, id))
          .catch(() => {});
      }
    }
  });
}

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id: notebookId } = await params;
  await getOwnedNotebook(notebookId, userId);

  await resumeOrphanedUploads(notebookId);

  const rows = await db
    .select({
      id: sources.id,
      status: sources.status,
      errorMessage: sources.errorMessage,
    })
    .from(sources)
    .where(eq(sources.notebookId, notebookId));

  return NextResponse.json(rows);
});
