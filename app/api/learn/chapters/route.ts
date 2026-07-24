import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedNotebook } from "@/lib/db/queries";
import { getOrGenerateChapter, setRoadmapItemStatus } from "@/lib/learn";
import { ROADMAP_ITEM_STATUSES } from "@/lib/types";

const generateSchema = z.object({
  notebookId: z.string().uuid(),
  roadmapItemId: z.string(),
});

// Generate (or return the cached) web-grounded lesson for a roadmap item.
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, roadmapItemId } = generateSchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  const content = await getOrGenerateChapter(notebookId, roadmapItemId);
  return NextResponse.json({ content });
});

const statusSchema = z.object({
  notebookId: z.string().uuid(),
  roadmapItemId: z.string(),
  status: z.enum(ROADMAP_ITEM_STATUSES),
});

// Update a chapter's completion status (used by "Mark complete").
export const PATCH = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, roadmapItemId, status } = statusSchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  const items = await setRoadmapItemStatus(notebookId, roadmapItemId, status);
  return NextResponse.json({ items });
});
