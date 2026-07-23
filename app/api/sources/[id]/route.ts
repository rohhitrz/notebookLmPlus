import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedSource } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";
import { deleteSourceFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const FILE_BACKED_TYPES = new Set(["pdf", "vtt"]);

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);
  return NextResponse.json(source);
});

export const DELETE = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);

  const isFileBacked =
    FILE_BACKED_TYPES.has(source.type) || (source.type === "text" && !!source.origin);
  if (isFileBacked && source.origin) {
    await deleteSourceFile(source.origin).catch((err) => {
      console.error(`[sources] storage delete failed for ${source.origin}`, err);
    });
  }

  await db.delete(sources).where(eq(sources.id, id));
  return new NextResponse(null, { status: 204 });
});
