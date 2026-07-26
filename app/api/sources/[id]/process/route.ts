import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedSource } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";
import { PublicError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

// Step 2 of a direct-to-Storage upload: the file is in Storage, so index it.
//
// The ingest pipeline is imported dynamically rather than at module scope. A
// static import pulls its whole dependency graph into this function's bundle at
// initialization; if any of that fails to load, the function dies before our
// error handling exists and Vercel returns its own HTML 500 — invisible and
// undebuggable. Loading it inside the try block turns that same failure into a
// recorded "error" status the source list can show.
export const POST = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);

  if (!source.origin) {
    throw new PublicError("Upload didn't complete. Please try again.");
  }

  // after() keeps the invocation alive past the response; a bare promise would
  // be killed the moment the response is sent.
  after(async () => {
    try {
      const { processSource } = await import("@/lib/ingest/pipeline");
      await processSource(id);
    } catch (err) {
      console.error(`[sources] processSource(${id}) failed`, err);
      // Never leave a source stuck on "uploading" — surface the failure.
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
