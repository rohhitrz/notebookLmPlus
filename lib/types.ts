import { z } from "zod";

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

export const ROADMAP_ITEM_STATUSES = ["todo", "in_progress", "done"] as const;
export type RoadmapItemStatus = (typeof ROADMAP_ITEM_STATUSES)[number];

export const roadmapItemSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  concept: z.string(),
  why: z.string(),
  status: z.enum(ROADMAP_ITEM_STATUSES),
  sources: z.array(
    z.object({
      sourceId: z.string().uuid(),
      startSec: z.number().optional(),
    }),
  ),
  chatId: z.string().uuid().nullable(),
});
export type RoadmapItem = z.infer<typeof roadmapItemSchema>;

export const suggestedResourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  type: z.string(),
});
export type SuggestedResource = z.infer<typeof suggestedResourceSchema>;

export interface Roadmap {
  id: string;
  notebookId: string;
  goal: string;
  items: RoadmapItem[];
  suggestedResources: SuggestedResource[];
}

export const ARTIFACT_TYPES = ["podcast", "pptx"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_STATUSES = ["generating", "ready", "error"] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export const PODCAST_LENGTHS = ["short", "medium"] as const;
export type PodcastLength = (typeof PODCAST_LENGTHS)[number];

export const podcastScriptTurnSchema = z.object({
  speaker: z.enum(["HOST_A", "HOST_B"]),
  text: z.string(),
});
export type PodcastScriptTurn = z.infer<typeof podcastScriptTurnSchema>;

export interface PodcastArtifactMetadata {
  length: PodcastLength;
  script: PodcastScriptTurn[];
}

export interface PptxArtifactMetadata {
  topic: string | null;
  slideCount: number | null;
}

export interface ArtifactListItem {
  id: string;
  type: ArtifactType;
  status: ArtifactStatus;
  createdAt: string;
}

export interface ArtifactDetail {
  id: string;
  notebookId: string;
  type: ArtifactType;
  status: ArtifactStatus;
  errorMessage: string | null;
  metadata: PodcastArtifactMetadata | PptxArtifactMetadata | null;
  url: string | null;
}
