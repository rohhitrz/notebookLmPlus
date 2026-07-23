import { asc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedChat, getOwnedNotebook } from "@/lib/db/queries";
import { chats, messages } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/llm";
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

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, chatId: chatIdInput, message } = chatRequestSchema.parse(
    await req.json(),
  );
  await getOwnedNotebook(notebookId, userId);

  let chatId = chatIdInput;
  let history: ChatMessage[] = [];

  if (chatId) {
    await getOwnedChat(chatId, notebookId);
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
