import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { roadmaps } from "@/lib/db/schema";
import { generateRoadmap } from "@/lib/learn";
import { DIFFICULTY_LEVELS, type RoadmapItem, type SuggestedResource } from "@/lib/types";

const createRoadmapSchema = z.object({
  notebookId: z.string().uuid(),
  goal: z.string().trim().min(1),
  level: z.enum(DIFFICULTY_LEVELS).default("beginner"),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, goal, level } = createRoadmapSchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  const { roadmap } = await generateRoadmap(notebookId, goal, level);

  return NextResponse.json(roadmap, { status: 201 });
});

const getRoadmapSchema = z.object({ notebookId: z.string().uuid() });

export const GET = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId } = getRoadmapSchema.parse({
    notebookId: new URL(req.url).searchParams.get("notebookId"),
  });
  await getOwnedNotebook(notebookId, userId);

  const [row] = await db.select().from(roadmaps).where(eq(roadmaps.notebookId, notebookId));
  if (!row) return NextResponse.json(null);

  return NextResponse.json({
    id: row.id,
    notebookId: row.notebookId,
    goal: row.goal,
    items: (row.items as RoadmapItem[]) ?? [],
    suggestedResources: (row.suggestedResources as SuggestedResource[]) ?? [],
  });
});
