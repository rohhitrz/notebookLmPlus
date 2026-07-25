import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { artifacts } from "@/lib/db/schema";
import { generatePodcast } from "@/lib/studio/podcast";
import { PODCAST_LENGTHS } from "@/lib/types";

const bodySchema = z.object({
  notebookId: z.string().uuid(),
  sourceIds: z.array(z.string().uuid()).min(1),
  length: z.enum(PODCAST_LENGTHS),
});

function runInBackground(
  artifactId: string,
  notebookId: string,
  sourceIds: string[],
  length: (typeof PODCAST_LENGTHS)[number],
) {
  generatePodcast(artifactId, notebookId, sourceIds, length).catch((err) => {
    console.error(`[studio] generatePodcast(${artifactId}) failed`, err);
  });
}

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, sourceIds, length } = bodySchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  enforceRateLimit(userId, RATE_LIMITS.studio);
  const [artifact] = await db
    .insert(artifacts)
    .values({ notebookId, type: "podcast", status: "generating", metadata: { length } })
    .returning();

  runInBackground(artifact.id, notebookId, sourceIds, length);

  return NextResponse.json({ id: artifact.id }, { status: 201 });
});
