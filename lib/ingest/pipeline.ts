import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { embedBatch } from "@/lib/llm";
import { downloadSourceFile } from "@/lib/storage";
import type { SourceStatus } from "@/lib/types";
import { upsertChunks } from "@/lib/vectorstore";
import { chunkExtractResult } from "./chunker";
import { extractPdf } from "./extractors/pdf";
import { extractText } from "./extractors/text";
import { extractUrl } from "./extractors/url";
import { extractVtt } from "./extractors/vtt";
import { extractYoutube } from "./extractors/youtube";
import type { ExtractResult } from "./types";

type SourceRow = typeof sources.$inferSelect;

async function setStatus(
  sourceId: string,
  status: SourceStatus,
  errorMessage: string | null = null,
): Promise<void> {
  await db.update(sources).set({ status, errorMessage }).where(eq(sources.id, sourceId));
}

async function extract(source: SourceRow): Promise<ExtractResult> {
  switch (source.type) {
    case "text": {
      if (source.origin) {
        const buf = await downloadSourceFile(source.origin);
        return extractText(new TextDecoder().decode(buf));
      }
      return extractText(source.rawContent ?? "");
    }
    case "pdf": {
      const buf = await downloadSourceFile(source.origin!);
      return extractPdf(new Uint8Array(buf));
    }
    case "vtt": {
      const buf = await downloadSourceFile(source.origin!);
      return extractVtt(new TextDecoder().decode(buf));
    }
    case "url":
      return extractUrl(source.origin!);
    case "youtube":
      return extractYoutube(source.origin!);
  }
}

export async function processSource(sourceId: string): Promise<void> {
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new Error(`Source ${sourceId} not found`);

  try {
    await setStatus(sourceId, "extracting");
    const result = await extract(source);

    await setStatus(sourceId, "chunking");
    const chunkList = chunkExtractResult(result, source.type);
    if (chunkList.length === 0) {
      throw new Error("No content could be extracted from this source");
    }

    await setStatus(sourceId, "embedding");
    const embedTexts = chunkList.map((c) => `[${source.title}] ${c.content}`);
    const vectors = await embedBatch(embedTexts, "RETRIEVAL_DOCUMENT");

    await upsertChunks(
      chunkList.map((c, i) => ({
        sourceId: source.id,
        notebookId: source.notebookId,
        seq: c.seq,
        content: c.content,
        embedding: vectors[i],
        metadata: c.metadata,
      })),
    );

    await db
      .update(sources)
      .set({
        status: "ready",
        errorMessage: null,
        rawContent: result.fullText,
        ...(result.finalUrl ? { origin: result.finalUrl } : {}),
      })
      .where(eq(sources.id, sourceId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during processing";
    await setStatus(sourceId, "error", message);
  }
}
