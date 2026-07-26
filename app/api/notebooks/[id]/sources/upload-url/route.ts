import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";
import { PublicError } from "@/lib/errors";
import { createSourceUploadUrl } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// The storage key's extension always comes from this allowlist, never from the
// attacker-controlled filename.
const EXTENSION_BY_TYPE = { pdf: "pdf", vtt: "vtt" } as const;

const uploadUrlSchema = z.object({
  type: z.enum(["pdf", "vtt"]),
  filename: z.string().trim().min(1),
  size: z.number().int().positive(),
});

// Step 1 of a direct-to-Storage file upload. Creates the source row and returns
// a one-time signed upload URL so the browser can PUT the file straight to
// Supabase Storage — bypassing Vercel's 4.5 MB serverless request-body limit,
// which was making larger PDFs fail with a platform 500.
export const POST = apiHandler(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser();
  const { id: notebookId } = await params;
  await getOwnedNotebook(notebookId, userId);

  const { type, filename, size } = uploadUrlSchema.parse(await req.json());
  if (size > MAX_UPLOAD_BYTES) {
    throw new PublicError(
      `That file is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`,
    );
  }

  const title = filename.slice(0, 200);

  const [source] = await db
    .insert(sources)
    .values({ notebookId, type, title, status: "uploading" })
    .returning();

  const path = `${notebookId}/${source.id}.${EXTENSION_BY_TYPE[type]}`;
  await db.update(sources).set({ origin: path }).where(eq(sources.id, source.id));

  const { token } = await createSourceUploadUrl(path);

  return NextResponse.json(
    {
      sourceId: source.id,
      path,
      token,
      item: { id: source.id, type: source.type, title: source.title },
    },
    { status: 201 },
  );
});
