import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LearnShell } from "@/components/learn/learn-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { chats, messages, roadmaps, sources } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Citation, DisplayMessage, RoadmapItem, SuggestedResource } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export default async function LearnPage({ params }: Params) {
  const userId = await requireUser();
  const { id } = await params;

  let notebook;
  try {
    notebook = await getOwnedNotebook(id, userId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [roadmapRow] = await db.select().from(roadmaps).where(eq(roadmaps.notebookId, id));
  const items = ((roadmapRow?.items as RoadmapItem[]) ?? []).sort((a, b) => a.order - b.order);
  const suggestedResources = (roadmapRow?.suggestedResources as SuggestedResource[]) ?? [];

  const sourceRows = await db
    .select({ id: sources.id, type: sources.type, title: sources.title, origin: sources.origin })
    .from(sources)
    .where(eq(sources.notebookId, id));

  const chatRows = await db
    .select()
    .from(chats)
    .where(eq(chats.notebookId, id))
    .orderBy(asc(chats.createdAt));
  const topicChats = chatRows.filter((c) => c.topic);

  const chatMessages: Record<string, DisplayMessage[]> = {};
  for (const chatRow of topicChats) {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatRow.id))
      .orderBy(asc(messages.createdAt));
    chatMessages[chatRow.id] = rows.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      citations: (m.citations as Citation[] | null) ?? [],
    }));
  }

  return (
    <LearnShell
      notebook={notebook}
      goal={roadmapRow?.goal ?? ""}
      initialItems={items}
      initialSuggestedResources={suggestedResources}
      sources={sourceRows}
      initialMessagesByChat={chatMessages}
    />
  );
}
