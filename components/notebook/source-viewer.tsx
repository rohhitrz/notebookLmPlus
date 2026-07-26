"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChunkDetail, Citation, SourceDetail } from "@/lib/types";

// react-pdf touches browser-only globals (DOMMatrix) at module load, which
// crashes during server rendering. Load it only on the client.
const PdfViewer = dynamic(
  () => import("@/components/notebook/pdf-viewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => <p className="p-8 text-sm text-muted-foreground">Loading viewer…</p>,
  },
);

interface SourceViewerProps {
  citation: Citation | null;
  onClose: () => void;
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [text, highlight]);

  const idx = highlight ? text.indexOf(highlight) : -1;
  if (idx === -1) {
    return <p className="whitespace-pre-wrap text-sm">{text}</p>;
  }

  return (
    <p className="whitespace-pre-wrap text-sm">
      {text.slice(0, idx)}
      <mark ref={markRef}>{text.slice(idx, idx + highlight.length)}</mark>
      {text.slice(idx + highlight.length)}
    </p>
  );
}

function YoutubeEmbed({ origin, startSec }: { origin: string; startSec?: number }) {
  const videoId = extractYoutubeId(origin);
  if (!videoId) {
    return <p className="text-sm text-muted-foreground">Could not load video.</p>;
  }
  const src = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(startSec ?? 0)}&autoplay=1`;
  return (
    <iframe
      src={src}
      className="aspect-video w-full rounded-lg"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

export function SourceViewer({ citation, onClose }: SourceViewerProps) {
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [chunk, setChunk] = useState<ChunkDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!citation) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      // Clear the previous citation's content so it can't flash while the new
      // one loads.
      setSource(null);
      setChunk(null);
      try {
        const [s, c] = await Promise.all([
          fetch(`/api/sources/${citation!.sourceId}`).then((r) => r.json()),
          fetch(`/api/chunks/${citation!.chunkId}`).then((r) => r.json()),
        ]);
        if (!cancelled) {
          setSource(s);
          setChunk(c);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [citation]);

  return (
    <Sheet
      open={!!citation}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="truncate">{source?.title ?? "Loading…"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && (
            <div className="flex flex-col gap-2.5 pt-1">
              {[95, 100, 88, 92, 70, 100, 84].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {!loading && source?.type === "pdf" && (
            <PdfViewer
              fileUrl={`/api/sources/${source.id}/file`}
              page={chunk?.metadata?.page}
              highlightText={chunk?.content}
            />
          )}

          {!loading && (source?.type === "text" || source?.type === "vtt") && (
            <HighlightedText text={source.rawContent ?? ""} highlight={chunk?.content ?? ""} />
          )}

          {!loading && source?.type === "url" && (
            <div className="flex flex-col gap-3">
              {source.origin && (
                <a
                  href={source.origin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open original ↗
                </a>
              )}
              <HighlightedText text={source.rawContent ?? ""} highlight={chunk?.content ?? ""} />
            </div>
          )}

          {!loading && source?.type === "youtube" && source.origin && (
            <YoutubeEmbed origin={source.origin} startSec={chunk?.metadata?.startSec} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
