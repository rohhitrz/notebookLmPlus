import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/lib/db/schema";

const createNotebookSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { title } = createNotebookSchema.parse(await req.json());

  const [notebook] = await db
    .insert(notebooks)
    .values({ userId, title })
    .returning();

  return NextResponse.json(notebook, { status: 201 });
});

export const GET = apiHandler(async () => {
  const userId = await requireUser();
  const rows = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, userId))
    .orderBy(desc(notebooks.createdAt));

  return NextResponse.json(rows);
});
