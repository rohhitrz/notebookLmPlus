import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getOwnedNotebook } from "@/lib/db/queries";
import { artifacts } from "@/lib/db/schema";
import { generatePptx } from "@/lib/studio/pptx";

// Generation continues after the response via after(), so it runs inside this
// invocation. 60s is the Vercel Hobby ceiling; raise it if you upgrade plans.
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  notebookId: z.string().uuid(),
  sourceIds: z.array(z.string().uuid()).min(1),
  focus: z.string().trim().max(200).optional(),
});

function runInBackground(
  artifactId: string,
  notebookId: string,
  sourceIds: string[],
  focus: string | undefined,
) {
  // after() keeps the serverless invocation alive; a bare promise is killed
  // when the response is sent, leaving the artifact stuck "generating".
  after(async () => {
    try {
      await generatePptx(artifactId, notebookId, sourceIds, focus);
    } catch (err) {
      console.error(`[studio] generatePptx(${artifactId}) failed`, err);
    }
  });
}

export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, sourceIds, focus } = bodySchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);

  enforceRateLimit(userId, RATE_LIMITS.studio);
  const [artifact] = await db
    .insert(artifacts)
    .values({ notebookId, type: "pptx", status: "generating", metadata: { topic: focus ?? null } })
    .returning();

  runInBackground(artifact.id, notebookId, sourceIds, focus);

  return NextResponse.json({ id: artifact.id }, { status: 201 });
});
