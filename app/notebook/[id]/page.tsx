import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { NotebookShell } from "@/components/notebook/notebook-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { artifacts, chats, messages, sources } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { ArtifactListItem, Citation, DisplayMessage } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export default async function NotebookPage({ params }: Params) {
  const userId = await requireUser();
  const { id } = await params;

  let notebook;
  try {
    notebook = await getOwnedNotebook(id, userId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const sourceRows = await db
    .select({
      id: sources.id,
      type: sources.type,
      title: sources.title,
      status: sources.status,
      errorMessage: sources.errorMessage,
    })
    .from(sources)
    .where(eq(sources.notebookId, id))
    .orderBy(asc(sources.createdAt));

  const [latestChat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(eq(chats.notebookId, id))
    .orderBy(desc(chats.createdAt))
    .limit(1);

  let initialMessages: DisplayMessage[] | undefined;
  if (latestChat) {
    const messageRows = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, latestChat.id))
      .orderBy(asc(messages.createdAt));
    initialMessages = messageRows.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      citations: (m.citations as Citation[] | null) ?? [],
    }));
  }

  const artifactRows = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      status: artifacts.status,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.notebookId, id))
    .orderBy(desc(artifacts.createdAt));
  const initialArtifacts: ArtifactListItem[] = artifactRows.map((a) => ({
    id: a.id,
    type: a.type as ArtifactListItem["type"],
    status: a.status as ArtifactListItem["status"],
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <NotebookShell
      notebook={notebook}
      initialSources={sourceRows}
      initialChatId={latestChat?.id}
      initialMessages={initialMessages}
      initialArtifacts={initialArtifacts}
    />
  );
}
