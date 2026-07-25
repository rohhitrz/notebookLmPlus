import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getOwnedNotebook } from "@/lib/db/queries";
import { generateChapterImage } from "@/lib/learn";

// Image generation is slow — well past the default 10s serverless budget.
export const runtime = "nodejs";
export const maxDuration = 60;

const imageSchema = z.object({
  notebookId: z.string().uuid(),
  roadmapItemId: z.string(),
});

// Generates (or returns the cached) illustration for a chapter. Called after the
// lesson text has already rendered, so the image loads progressively.
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { notebookId, roadmapItemId } = imageSchema.parse(await req.json());
  await getOwnedNotebook(notebookId, userId);
  enforceRateLimit(userId, RATE_LIMITS.chapterImage);

  const imageUrl = await generateChapterImage(notebookId, roadmapItemId);
  return NextResponse.json({ imageUrl });
});
