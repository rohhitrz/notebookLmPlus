"use client";

import type { Citation } from "@/lib/types";

interface CitationChipProps {
  n: number;
  citation?: Citation;
  onClick?: (citation: Citation) => void;
}

export function CitationChip({ n, citation, onClick }: CitationChipProps) {
  if (!citation) {
    return <sup className="text-xs text-muted-foreground">[{n}]</sup>;
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className="mx-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary/10 align-super text-[10px] font-medium text-primary hover:bg-primary/20"
      title={citation.preview}
    >
      {n}
    </button>
  );
}
