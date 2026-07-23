export const SOURCE_TYPES = ["pdf", "text", "url", "youtube", "vtt"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_STATUSES = [
  "uploading",
  "extracting",
  "chunking",
  "embedding",
  "ready",
  "error",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const NON_TERMINAL_SOURCE_STATUSES: SourceStatus[] = [
  "uploading",
  "extracting",
  "chunking",
  "embedding",
];

export interface Citation {
  n: number;
  chunkId: string;
  sourceId: string;
  preview: string;
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
}

export interface SourceListItem {
  id: string;
  type: SourceType;
  title: string;
  status: SourceStatus;
  errorMessage: string | null;
}

export interface SourceDetail {
  id: string;
  type: SourceType;
  title: string;
  origin: string | null;
  status: SourceStatus;
  errorMessage: string | null;
  rawContent: string | null;
}

export interface ChunkDetailMetadata {
  page?: number;
  charStart?: number;
  charEnd?: number;
  startSec?: number;
  endSec?: number;
}

export interface ChunkDetail {
  id: string;
  sourceId: string;
  content: string;
  metadata: ChunkDetailMetadata | null;
}
