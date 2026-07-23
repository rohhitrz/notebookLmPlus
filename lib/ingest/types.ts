export interface ExtractUnit {
  text: string;
  /** PDF only: 1-indexed page number. */
  page?: number;
  /** Timed sources only (vtt/youtube). */
  startSec?: number;
  endSec?: number;
}

export interface ExtractResult {
  fullText: string;
  units: ExtractUnit[];
  title?: string;
  /** url extractor: the URL after following redirects. */
  finalUrl?: string;
}

export interface ChunkMetadata {
  page?: number;
  charStart?: number;
  charEnd?: number;
  startSec?: number;
  endSec?: number;
}

export interface Chunk {
  seq: number;
  content: string;
  metadata: ChunkMetadata;
}
