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
  /** Source title, so a citation can name where it came from. */
  sourceTitle?: string;
  /** 1-based PDF page the cited passage sits on. */
  page?: number;
  /** Start time in seconds for timed sources (video / transcript). */
  startSec?: number;
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

export const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// Result of checking whether a learning goal is specific enough to build a
// focused roadmap. When `broad` is true the UI shows the options as clickable
// chips so the student can narrow their goal before we generate anything.
export const scopeOptionSchema = z.object({
  label: z.string(),
  refinedGoal: z.string(),
});
export type ScopeOption = z.infer<typeof scopeOptionSchema>;

export const scopeResultSchema = z.object({
  broad: z.boolean(),
  clarifyingQuestion: z.string(),
  options: z.array(scopeOptionSchema),
});
export type ScopeResult = z.infer<typeof scopeResultSchema>;

// A generated, web-grounded lesson for one roadmap item ("chapter").
export const chapterCitationSchema = z.object({
  n: z.number().int(),
  title: z.string(),
  url: z.string(),
});
export type ChapterCitation = z.infer<typeof chapterCitationSchema>;

export const chapterSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});
export type ChapterSection = z.infer<typeof chapterSectionSchema>;

export const chapterContentSchema = z.object({
  // The lesson as GitHub-flavored Markdown, streamed as it's generated.
  body: z.string().default(""),
  citations: z.array(chapterCitationSchema).default([]),
  // Legacy structured fields — chapters generated before the streaming refactor
  // stored their content this way; kept optional so they still render.
  overview: z.string().optional(),
  sections: z.array(chapterSectionSchema).optional(),
  keyTakeaways: z.array(z.string()).optional(),
});
export type ChapterContent = z.infer<typeof chapterContentSchema>;

export const roadmapItemSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  concept: z.string(),
  why: z.string(),
  status: z.enum(ROADMAP_ITEM_STATUSES),
  // Calibrated per chapter so a "big" topic can carry a heavier, longer chapter
  // than a foundational one — the syllabus is not one-size-fits-all.
  difficulty: z.enum(DIFFICULTY_LEVELS).default("beginner"),
  estMinutes: z.number().int().positive().default(10),
  sources: z.array(
    z.object({
      sourceId: z.string().uuid(),
      startSec: z.number().optional(),
    }),
  ),
  chatId: z.string().uuid().nullable(),
  // Lesson content, generated on demand the first time the chapter is opened.
  content: chapterContentSchema.nullable().default(null),
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
