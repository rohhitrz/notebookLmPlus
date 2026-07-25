import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedNotebook } from "@/lib/db/queries";
import { setRoadmapItemStatus, streamChapter } from "@/lib/learn";
import { ROADMAP_ITEM_STATUSES } from "@/lib/types";

const generateSchema = z.object({
  notebookId: z.string().uuid(),
  roadmapItemId: z.string(),
});

// Stream a web-grounded lesson for a roadmap item as it's written, so the text
// appears immediately instead of after a long blocking wait.
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, roadmapItemId } = generateSchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const evt of streamChapter(notebookId, roadmapItemId)) {
          if (evt.type === "token") send("token", { text: evt.text });
          else send("done", { content: evt.content });
        }
      } catch (err) {
        console.error("[learn] chapter stream failed", err);
        send("error", { message: "Failed to build this chapter. Please try again." });
      } finally {
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
