"use client";

import type { Citation } from "@/lib/types";

interface CitationChipProps {
  n: number;
  citation?: Citation;
  onClick?: (citation: Citation) => void;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// "AI-System-Design.pdf · p. 12" — where the cited passage actually came from.
export function citationLocation(c: Citation): string | null {
  const where =
    c.page != null
      ? `p. ${c.page}`
      : c.startSec != null
        ? formatTimestamp(c.startSec)
        : null;
  if (c.sourceTitle && where) return `${c.sourceTitle} · ${where}`;
  return c.sourceTitle ?? where;
}

export function CitationChip({ n, citation, onClick }: CitationChipProps) {
  if (!citation) {
    return <sup className="text-xs text-muted-foreground">[{n}]</sup>;
  }

  const location = citationLocation(citation);

  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className="mx-0.5 inline-flex h-4 items-center justify-center gap-0.5 rounded-full bg-primary/10 px-1.5 align-super text-[10px] font-medium text-primary hover:bg-primary/20"
      title={location ? `${location}\n\n${citation.preview}` : citation.preview}
    >
      <span>{n}</span>
      {/* Page number inline, so the source is identifiable without clicking. */}
      {citation.page != null && (
        <span className="font-normal opacity-80">p.{citation.page}</span>
      )}
    </button>
  );
}
