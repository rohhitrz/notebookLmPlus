import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedSource } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";
import { deleteBySource } from "@/lib/vectorstore";

type Params = { params: Promise<{ id: string }> };

// Re-indexing continues after the response via after().
export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);

  await deleteBySource(id);
  await db
    .update(sources)
    .set({ status: "uploading", errorMessage: null })
    .where(eq(sources.id, id));

  after(async () => {
    try {
      const { processSource } = await import("@/lib/ingest/pipeline");
      await processSource(id);
    } catch (err) {
      console.error(`[sources] reindex processSource(${id}) failed`, err);
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
  });

  return NextResponse.json({ id: source.id });
});
