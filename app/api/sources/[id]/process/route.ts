import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedSource } from "@/lib/db/queries";
import { PublicError } from "@/lib/errors";
import { processSource } from "@/lib/ingest/pipeline";
import { sourceFileExists } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

// Node runtime + headroom so the background extract → chunk → embed has time.
export const runtime = "nodejs";
export const maxDuration = 60;

// Step 2 of a direct-to-Storage file upload: the browser has finished PUTting
// the file, so kick off processing. We confirm the object actually landed first
// so a failed/half upload doesn't leave a source stuck "extracting".
export const POST = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);

  if (!source.origin || !(await sourceFileExists(source.origin))) {
    throw new PublicError("The file didn't finish uploading. Please try again.");
  }

  processSource(id).catch((err) => {
    console.error(`[sources] processSource(${id}) failed`, err);
  });

  return NextResponse.json({ id: source.id });
});
