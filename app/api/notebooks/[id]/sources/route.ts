import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// Indexing continues after the response via after(), so the invocation needs the
// Node runtime and headroom beyond the default 10s.
export const runtime = "nodejs";
export const maxDuration = 60;

// File sources (pdf, vtt) are uploaded straight to Storage from the browser via
// /sources/upload-url + /sources/[id]/process, so they never hit this route's
// request body (Vercel caps that at 4.5 MB). This route handles only the
// text-bearing source types.
const jsonSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), url: z.string().url() }),
  z.object({ type: z.literal("youtube"), url: z.string().url() }),
  z.object({
    type: z.literal("text"),
    text: z.string().trim().min(1),
    title: z.string().trim().min(1),
  }),
]);

// Indexing runs after the response so the request returns immediately and the
// UI polls for status. after() is required on serverless: a bare fire-and-forget
// promise is killed the moment the response is sent. The pipeline is imported
// dynamically so a load failure becomes a recorded "error" status rather than a
// module-init crash that kills the function before any handling exists.
function runInBackground(sourceId: string) {
  after(async () => {
    try {
      const { processSource } = await import("@/lib/ingest/pipeline");
      await processSource(sourceId);
    } catch (err) {
      console.error(`[sources] processSource(${sourceId}) failed`, err);
      await db
        .update(sources)
        .set({
          status: "error",
          errorMessage:
            err instanceof Error ? err.message.slice(0, 500) : "Indexing failed",
        })
        .where(eq(sources.id, sourceId))
        .catch(() => {});
    }
  });
}

export const POST = apiHandler(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser();
  const { id: notebookId } = await params;
  await getOwnedNotebook(notebookId, userId);

  const body = jsonSourceSchema.parse(await req.json());

  if (body.type === "youtube") {
    // Imported here so youtubei.js only loads when a YouTube URL is actually added.
    const { resolveYoutubeUrls } = await import("@/lib/ingest/extractors/youtube");
    const resolved = await resolveYoutubeUrls(body.url);
    const items = await Promise.all(
      resolved.map(async (video) => {
        const [source] = await db
          .insert(sources)
          .values({
            notebookId,
            type: "youtube",
            title: video.title ?? video.url,
            origin: video.url,
            status: "uploading",
          })
          .returning();
        runInBackground(source.id);
        return { id: source.id, type: source.type, title: source.title };
      }),
    );
    return NextResponse.json({ items }, { status: 201 });
  }

  if (body.type === "url") {
    const [source] = await db
      .insert(sources)
      .values({ notebookId, type: "url", title: body.url, origin: body.url, status: "uploading" })
      .returning();
    runInBackground(source.id);
    return NextResponse.json(
      { items: [{ id: source.id, type: source.type, title: source.title }] },
      { status: 201 },
    );
  }

  const [source] = await db
    .insert(sources)
    .values({
      notebookId,
      type: "text",
      title: body.title,
      rawContent: body.text,
      status: "uploading",
    })
    .returning();
  runInBackground(source.id);
  return NextResponse.json(
    { items: [{ id: source.id, type: source.type, title: source.title }] },
    { status: 201 },
  );
});
