import { asc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedChat, getOwnedNotebook } from "@/lib/db/queries";
import { chats, messages } from "@/lib/db/schema";
import {
  buildTeachingSystemPrompt,
  extractTopicAction,
  getOrGenerateChapter,
  getTeachingContext,
  markRoadmapItemDone,
  updateChatSummary,
} from "@/lib/learn";
import { chat, type ChatMessage } from "@/lib/llm";
import {
  generateAnswer,
  NO_SOURCES_MESSAGE,
  parseCitations,
  retrieve,
} from "@/lib/rag";

const chatRequestSchema = z.object({
  notebookId: z.string().uuid(),
  chatId: z.string().uuid().optional(),
  message: z.string().trim().min(1),
});

// Portion of a streaming tutor reply that's safe to show — everything before a
// trailing ```json action block. Holds back a 1-2 backtick tail that might be
// the start of that fence, so a partial fence never flashes on screen.
function safeVisible(raw: string): string {
  const fence = raw.indexOf("```");
  if (fence !== -1) return raw.slice(0, fence).trimEnd();
  const tail = raw.match(/`{1,2}$/);
  return tail ? raw.slice(0, raw.length - tail[0].length) : raw;
}

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, chatId: chatIdInput, message } = chatRequestSchema.parse(
    await req.json(),
  );
  await getOwnedNotebook(notebookId, userId);

  let chatId = chatIdInput;
  let history: ChatMessage[] = [];
  let topic: string | null = null;

  if (chatId) {
    const existingChat = await getOwnedChat(chatId, notebookId);
    topic = existingChat.topic;
    const priorMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt));
    history = priorMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  } else {
    const [newChat] = await db.insert(chats).values({ notebookId }).returning();
    chatId = newChat.id;
  }

  await db.insert(messages).values({ chatId, role: "user", content: message, citations: [] });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("meta", { chatId });

        const { standaloneQuestion, chunks } = await retrieve(notebookId, message, history);

        if (topic) {
          const context = await getTeachingContext(notebookId, chatId, topic);

          // Learning chats teach from the chapter's web-grounded lesson. Generate
          // it on the fly if the student jumped straight into chat before it was
          // prepared, so the tutor always has material even with no notebook sources.
          let chapter = context.chapter;
          if (!chapter && context.currentItemId) {
            try {
              chapter = await getOrGenerateChapter(notebookId, context.currentItemId);
            } catch (err) {
              console.error("[learn] on-the-fly chapter generation failed", err);
            }
          }

          if (!chapter && chunks.length === 0) {
            send("token", { text: NO_SOURCES_MESSAGE });
            await db.insert(messages).values({
              chatId,
              role: "assistant",
              content: NO_SOURCES_MESSAGE,
              citations: [],
            });
            send("citations", { citations: [] });
            send("done", {});
            controller.close();
            return;
          }

          const system = buildTeachingSystemPrompt({
            concept: context.concept,
            why: context.why,
            roadmap: context.roadmapItems,
            siblingSummaries: context.siblingSummaries,
            chunks,
            chapter,
          });

          if (process.env.NODE_ENV !== "production") {
            console.log(`[learn] teaching system prompt (chat ${chatId})\n${system}`);
          }

          // Stream tokens as they arrive, but withhold the trailing ```json
          // action block (if any) so it never flashes in the UI.
          let raw = "";
          let emitted = 0;
          for await (const piece of chat([{ role: "user", content: standaloneQuestion }], system)) {
            raw += piece;
            const visible = safeVisible(raw);
            if (visible.length > emitted) {
              send("token", { text: visible.slice(emitted) });
              emitted = visible.length;
            }
          }

          const { visibleText, action } = extractTopicAction(raw);
          if (visibleText.length > emitted) {
            send("token", { text: visibleText.slice(emitted) });
          }

          const citations = parseCitations(visibleText, chunks);
          await db.insert(messages).values({ chatId, role: "assistant", content: visibleText, citations });
          send("citations", { citations });

          if (action?.type === "complete_topic") {
            await markRoadmapItemDone(notebookId, chatId);
            send("action", { action: "complete_topic" });
          } else if (action?.type === "suggest_resources") {
            send("action", { action: "suggest_resources", resources: action.resources });
          }

          const transcript = [
            ...history,
            { role: "user" as const, content: message },
            { role: "assistant" as const, content: visibleText },
          ]
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");
          await updateChatSummary(chatId, transcript);

          send("done", {});
          controller.close();
          return;
        }

        if (chunks.length === 0) {
          send("token", { text: NO_SOURCES_MESSAGE });
          await db.insert(messages).values({
            chatId,
            role: "assistant",
            content: NO_SOURCES_MESSAGE,
            citations: [],
          });
          send("citations", { citations: [] });
          send("done", {});
          controller.close();
          return;
        }

        let full = "";
        for await (const token of generateAnswer(standaloneQuestion, chunks)) {
          full += token;
          send("token", { text: token });
        }

        const citations = parseCitations(full, chunks);
        await db.insert(messages).values({ chatId, role: "assistant", content: full, citations });

        send("citations", { citations });
        send("done", {});
        controller.close();
      } catch (err) {
        console.error("[chat] stream failed", err);
        send("error", { message: "Something went wrong generating a response." });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
