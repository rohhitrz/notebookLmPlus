import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { sources } from "@/lib/db/schema";
import { resolveYoutubeUrls } from "@/lib/ingest/extractors/youtube";
import { processSource } from "@/lib/ingest/pipeline";

type Params = { params: Promise<{ id: string }> };

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

function runInBackground(sourceId: string) {
  processSource(sourceId).catch((err) => {
    console.error(`[sources] processSource(${sourceId}) failed`, err);
  });
}

export const POST = apiHandler(async (req: NextRequest, { params }: Params) => {
  const userId = await requireUser();
  const { id: notebookId } = await params;
  await getOwnedNotebook(notebookId, userId);

  const body = jsonSourceSchema.parse(await req.json());

  if (body.type === "youtube") {
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
