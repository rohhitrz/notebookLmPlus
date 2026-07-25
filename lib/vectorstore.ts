import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { chunks } from "./db/schema";

export interface ChunkSearchResult {
  id: string;
  sourceId: string;
  content: string;
  metadata: unknown;
  similarity: number;
}

const TOP_K = 24;
// A loose floor to drop near-orthogonal noise only. The LLM reranker is the real
// relevance gate, so keeping this low avoids false "not found" results for valid
// matches that score modestly (e.g. cross-lingual: an English query against a
// Hindi transcript, or terse queries against formal source text).
const MIN_SIMILARITY = 0.2;

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function searchChunks(
  notebookId: string,
  queryEmbedding: number[],
): Promise<ChunkSearchResult[]> {
  const vector = toVectorLiteral(queryEmbedding);

  const rows = (await db.execute(sql`
    select id, source_id, content, metadata,
           1 - (embedding <=> ${vector}::vector) as similarity
    from chunks
    where notebook_id = ${notebookId}
    order by embedding <=> ${vector}::vector
    limit ${TOP_K}
  `)) as unknown as {
    id: string;
    source_id: string;
    content: string;
    metadata: unknown;
    similarity: string;
  }[];

  return rows
    .map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      content: r.content,
      metadata: r.metadata,
      similarity: Number(r.similarity),
    }))
    .filter((r) => r.similarity >= MIN_SIMILARITY);
}

export async function upsertChunks(
  rows: (typeof chunks.$inferInsert)[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(chunks).values(rows);
}

export async function deleteBySource(sourceId: string): Promise<void> {
  await db.delete(chunks).where(eq(chunks.sourceId, sourceId));
}
