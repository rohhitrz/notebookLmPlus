import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import pLimit from "p-limit";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const EMBED_BATCH_SIZE = 50;
const EMBED_DIMENSIONS = 768;
const embedLimit = pLimit(2);

function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number } | undefined)?.status;
  return status === 429;
}

async function withBackoff<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= retries) throw err;
      const delay = 500 * 2 ** attempt + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---------------------------------------------------------------------------
// chat() — streaming text
// ---------------------------------------------------------------------------

export async function* chat(
  messages: ChatMessage[],
  system?: string,
  opts: { temperature?: number } = {},
): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL!,
    stream: true,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    messages: [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

// ---------------------------------------------------------------------------
// chatJSON() — structured output
// ---------------------------------------------------------------------------

export async function chatJSON<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<z.infer<T>> {
  const completion = await withBackoff(() =>
    openai.chat.completions.parse({
      model: process.env.OPENAI_CHAT_MODEL!,
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(schema, "response"),
      // Structured calls (query rewrite, rerank scores, roadmaps) must be
      // repeatable: at default temperature the same question could retrieve
      // different chunks on different runs and produce contradictory answers.
      temperature: 0,
    }),
  );
  const parsed = completion.choices[0]?.message?.parsed;
  if (parsed == null) throw new Error("OpenAI chatJSON: empty response");
  return schema.parse(parsed);
}

// ---------------------------------------------------------------------------
// embedBatch() — OpenAI, locked to 768 dims to match the pgvector schema
// ---------------------------------------------------------------------------

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    batches.push(texts.slice(i, i + EMBED_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) =>
      embedLimit(() =>
        withBackoff(() =>
          openai.embeddings.create({
            model: process.env.OPENAI_EMBED_MODEL!,
            input: batch,
            dimensions: EMBED_DIMENSIONS,
          }),
        ),
      ),
    ),
  );

  return batchResults.flatMap((result) => result.data.map((e) => e.embedding));
}
