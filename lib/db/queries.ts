import { eq } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors";
import { db } from "./index";
import { chats, chunks, notebooks, sources } from "./schema";

export async function getOwnedNotebook(notebookId: string, userId: string) {
  const [notebook] = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.id, notebookId));
  if (!notebook || notebook.userId !== userId) {
    throw new NotFoundError("Notebook not found");
  }
  return notebook;
}

export async function getOwnedSource(sourceId: string, userId: string) {
  const [row] = await db
    .select({ source: sources, notebookUserId: notebooks.userId })
    .from(sources)
    .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
    .where(eq(sources.id, sourceId));
  if (!row || row.notebookUserId !== userId) {
    throw new NotFoundError("Source not found");
  }
  return row.source;
}

export async function getOwnedChat(chatId: string, notebookId: string) {
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
  if (!chat || chat.notebookId !== notebookId) {
    throw new NotFoundError("Chat not found");
  }
  return chat;
}

export async function getOwnedChunk(chunkId: string, userId: string) {
  const [row] = await db
    .select({ chunk: chunks, notebookUserId: notebooks.userId })
    .from(chunks)
    .innerJoin(notebooks, eq(chunks.notebookId, notebooks.id))
    .where(eq(chunks.id, chunkId));
  if (!row || row.notebookUserId !== userId) {
    throw new NotFoundError("Chunk not found");
  }
  return row.chunk;
}
