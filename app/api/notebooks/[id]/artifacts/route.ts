import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { artifacts } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id: notebookId } = await params;
  await getOwnedNotebook(notebookId, userId);

  const rows = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      status: artifacts.status,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.notebookId, notebookId))
    .orderBy(desc(artifacts.createdAt));

  return NextResponse.json(rows);
});
