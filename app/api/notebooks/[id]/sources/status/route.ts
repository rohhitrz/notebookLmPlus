import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id: notebookId } = await params;
  await getOwnedNotebook(notebookId, userId);

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
