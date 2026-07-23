import { and, eq, inArray } from "drizzle-orm";
import pLimit from "p-limit";
import { z } from "zod";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { loadSourceBody } from "@/lib/learn";
import { chatJSON } from "@/lib/llm";
import { assertContentSafe } from "@/lib/studio/moderation";

const summaryConcurrency = pLimit(2);

interface SourceSummary {
  sourceId: string;
  title: string;
  summary: string;
}

const summarySchema = z.object({ summary: z.string() });

async function summarizeOneSource(source: {
  id: string;
  title: string;
  type: string;
}): Promise<SourceSummary> {
  const body = await loadSourceBody(source);
  await assertContentSafe(body, source.title);

  const prompt = `Write a dense, factual summary of the source titled "${source.title}", grounded strictly in the content below. Cover its key points, arguments, and facts plainly — no meta-commentary about the source itself.

Use ONLY information explicitly stated in the content. Do not add outside knowledge, and do not invent or "fill in" specifics (numbers, dates, names, terms) that are not actually written in the content. Summarize only what is genuinely present — a short source yields a short summary.

Content:
${body}`;

  const { summary } = await chatJSON(prompt, summarySchema);
  return { sourceId: source.id, title: source.title, summary };
}

// Map step: summarize each source independently and in parallel.
export async function summarizeSourcesForStudio(
  notebookId: string,
  sourceIds: string[],
): Promise<SourceSummary[]> {
  const rows = await db
    .select({ id: sources.id, title: sources.title, type: sources.type })
    .from(sources)
    .where(and(eq(sources.notebookId, notebookId), inArray(sources.id, sourceIds)));

  return Promise.all(rows.map((s) => summaryConcurrency(() => summarizeOneSource(s))));
}

const reduceSchema = z.object({ briefing: z.string() });

// Reduce step: combine per-source summaries into one cohesive briefing.
export async function reduceSummaries(summaries: SourceSummary[]): Promise<string> {
  if (summaries.length === 0) return "(No source material was available.)";

  const combined = summaries.map((s) => `Source: "${s.title}"\n${s.summary}`).join("\n\n");
  const prompt = `Combine the following per-source summaries into one cohesive briefing document that captures all the important material across sources, resolving overlap and connecting related points. Do not lose any distinct facts, and do not add any facts that are not present in the summaries below. If two sources cover unrelated topics, keep them as clearly separate sections rather than blending them.

${combined}`;

  const { briefing } = await chatJSON(prompt, reduceSchema);
  return briefing;
}
