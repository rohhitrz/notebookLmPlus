import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export class ContentPolicyError extends Error {}

export async function assertContentSafe(text: string, label: string): Promise<void> {
  if (!text.trim()) return;

  const result = await openai.moderations.create({
    model: process.env.OPENAI_MODERATION_MODEL!,
    input: text.slice(0, 20000),
  });

  if (result.results.some((r) => r.flagged)) {
    throw new ContentPolicyError(
      `"${label}" contains content that violates our content policy and can't be used to generate studio artifacts.`,
    );
  }
}
