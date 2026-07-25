import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkGoalScope } from "@/lib/learn";
import { assertContentSafe } from "@/lib/studio/moderation";
import { DIFFICULTY_LEVELS } from "@/lib/types";

const scopeSchema = z.object({
  goal: z.string().trim().min(1),
  level: z.enum(DIFFICULTY_LEVELS).default("beginner"),
});

// Pre-flight check for the "create learning project" flow: is the goal focused
// enough to build a good roadmap, or should we ask the student to narrow it?
// No notebook exists yet at this stage, so this only needs an authenticated user.
export const POST = apiHandler(async (req: NextRequest) => {
  const userId = await requireUser();
  const { goal, level } = scopeSchema.parse(await req.json());
  enforceRateLimit(userId, RATE_LIMITS.scope);

  await assertContentSafe(goal, "learning goal");
  const result = await checkGoalScope(goal, level);

  return NextResponse.json(result);
});
