import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { chats, roadmaps } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { RoadmapItem, SuggestedResource } from "@/lib/types";

const createChatSchema = z.object({
  notebookId: z.string().uuid(),
  roadmapItemId: z.string(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, roadmapItemId } = createChatSchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  const [roadmapRow] = await db.select().from(roadmaps).where(eq(roadmaps.notebookId, notebookId));
  if (!roadmapRow) throw new NotFoundError("Roadmap not found");

  const items = (roadmapRow.items as RoadmapItem[]) ?? [];
  const idx = items.findIndex((i) => i.id === roadmapItemId);
  if (idx === -1) throw new NotFoundError("Roadmap item not found");

  const suggestedResources = (roadmapRow.suggestedResources as SuggestedResource[]) ?? [];

  if (items[idx].chatId) {
    return NextResponse.json({
      chatId: items[idx].chatId,
      roadmap: {
        id: roadmapRow.id,
        notebookId: roadmapRow.notebookId,
        goal: roadmapRow.goal,
        items,
        suggestedResources,
      },
    });
  }

  const [newChat] = await db
    .insert(chats)
    .values({ notebookId, title: items[idx].concept, topic: items[idx].concept })
    .returning();

  items[idx] = {
    ...items[idx],
    chatId: newChat.id,
    status: items[idx].status === "todo" ? "in_progress" : items[idx].status,
  };

  const [updatedRow] = await db
    .update(roadmaps)
    .set({ items })
    .where(eq(roadmaps.id, roadmapRow.id))
    .returning();

  return NextResponse.json(
    {
      chatId: newChat.id,
      roadmap: {
        id: updatedRow.id,
        notebookId: updatedRow.notebookId,
        goal: updatedRow.goal,
        items: (updatedRow.items as RoadmapItem[]) ?? [],
        suggestedResources,
      },
    },
    { status: 201 },
  );
});
