import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import pLimit from "p-limit";
import { z } from "zod";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
export type LlmProvider = "gemini" | "openai";

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

async function* streamGemini(
  messages: ChatMessage[],
  system?: string,
): AsyncGenerator<string> {
  const stream = await genai.models.generateContentStream({
    model: process.env.GEMINI_CHAT_MODEL!,
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: system ? { systemInstruction: system } : undefined,
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

async function* streamOpenAI(
  messages: ChatMessage[],
  system?: string,
): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model: process.env.OPENAI_FALLBACK_MODEL!,
    stream: true,
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

export async function* chat(
  messages: ChatMessage[],
  system?: string,
  opts?: { provider?: LlmProvider },
): AsyncGenerator<string> {
  if (opts?.provider === "openai") {
    yield* streamOpenAI(messages, system);
    return;
  }
  try {
    yield* streamGemini(messages, system);
  } catch (err) {
    if (!isRateLimitError(err)) throw err;
    console.error("[llm] Gemini quota exceeded in chat(), falling back to OpenAI", err);
    yield* streamOpenAI(messages, system);
  }
}

// ---------------------------------------------------------------------------
// chatJSON() — structured output
// ---------------------------------------------------------------------------

async function chatJSONGemini<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<z.infer<T>> {
  const response = await withBackoff(() =>
    genai.models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL!,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),
      },
    }),
  );
  if (!response.text) throw new Error("Gemini chatJSON: empty response");
  return schema.parse(JSON.parse(response.text));
}

async function chatJSONOpenAI<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<z.infer<T>> {
  const completion = await withBackoff(() =>
    openai.chat.completions.parse({
      model: process.env.OPENAI_FALLBACK_MODEL!,
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(schema, "response"),
    }),
  );
  const parsed = completion.choices[0]?.message?.parsed;
  if (parsed == null) throw new Error("OpenAI chatJSON: empty response");
  return schema.parse(parsed);
}

export async function chatJSON<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
  opts?: { provider?: LlmProvider },
): Promise<z.infer<T>> {
  if (opts?.provider === "openai") {
    return chatJSONOpenAI(prompt, schema);
  }
  try {
    return await chatJSONGemini(prompt, schema);
  } catch (err) {
    if (!isRateLimitError(err)) throw err;
    console.error("[llm] Gemini quota exceeded in chatJSON(), falling back to OpenAI", err);
    return chatJSONOpenAI(prompt, schema);
  }
}

// ---------------------------------------------------------------------------
// embedBatch() — Gemini only, locked to 768 dims
// ---------------------------------------------------------------------------

export async function embedBatch(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    batches.push(texts.slice(i, i + EMBED_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) =>
      embedLimit(() =>
        withBackoff(() =>
          genai.models.embedContent({
            model: process.env.GEMINI_EMBED_MODEL!,
            contents: batch,
            config: { taskType, outputDimensionality: EMBED_DIMENSIONS },
          }),
        ),
      ),
    ),
  );

  return batchResults.flatMap(
    (result) => result.embeddings?.map((e) => e.values ?? []) ?? [],
  );
}
