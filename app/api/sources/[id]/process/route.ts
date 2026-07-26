import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedSource } from "@/lib/db/queries";
import { PublicError } from "@/lib/errors";
import { processSource } from "@/lib/ingest/pipeline";

type Params = { params: Promise<{ id: string }> };

// Node runtime + headroom so the background extract → chunk → embed has time.
export const runtime = "nodejs";
export const maxDuration = 60;

// Step 2 of a direct-to-Storage file upload: the browser has finished PUTting
// the file, so kick off processing. If the file never actually landed,
// processSource itself will fail the source cleanly (status "error"), which the
// source list surfaces — no need to pre-check Storage here.
export const POST = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);

  if (!source.origin) {
    throw new PublicError("Upload didn't complete. Please try again.");
  }

  processSource(id).catch((err) => {
    console.error(`[sources] processSource(${id}) failed`, err);
  });

  return NextResponse.json({ id: source.id });
});
