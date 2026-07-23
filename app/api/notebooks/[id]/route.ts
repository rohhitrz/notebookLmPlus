import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { notebooks } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const notebook = await getOwnedNotebook(id, userId);
  return NextResponse.json(notebook);
});

export const DELETE = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  await getOwnedNotebook(id, userId);
  await db.delete(notebooks).where(eq(notebooks.id, id));
  return new NextResponse(null, { status: 204 });
});
