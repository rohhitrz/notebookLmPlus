"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { citationLocation } from "@/components/notebook/citation-chip";
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
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {text.slice(0, idx)}
      <mark ref={markRef} className="rounded-sm bg-amber-300/70 px-0.5 text-inherit dark:bg-amber-400/40">
        {text.slice(idx, idx + highlight.length)}
      </mark>
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

function CitedPassage({ text, page }: { text: string; page?: number }) {
  return (
    <aside className="shrink-0 rounded-lg border bg-muted/40 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span>Cited passage</span>
        {page != null && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-normal normal-case tracking-normal text-primary">
            p. {page}
          </span>
        )}
      </div>
      <p className="line-clamp-4 text-sm leading-relaxed text-foreground/90">“{text}”</p>
    </aside>
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

  const page = chunk?.metadata?.page ?? citation?.page;
  const passage = chunk?.content ?? citation?.preview ?? "";
  const location = citation ? citationLocation(citation) : null;

  return (
    <Dialog
      open={!!citation}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex h-[min(92vh,900px)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="truncate text-base">
            {source?.title ?? "Loading…"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {location ?? (page != null ? `Page ${page}` : "Source citation")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4">
          {loading && (
            <div className="flex flex-col gap-2.5 pt-1">
              {[95, 100, 88, 92, 70, 100, 84].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {!loading && passage && source?.type === "pdf" && (
            <CitedPassage text={passage} page={page} />
          )}

          {!loading && source?.type === "pdf" && (
            <div className="min-h-0 flex-1">
              <PdfViewer
                fileUrl={`/api/sources/${source.id}/file`}
                page={page}
                highlightText={chunk?.content}
              />
            </div>
          )}

          {!loading && (source?.type === "text" || source?.type === "vtt") && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {passage && <CitedPassage text={passage} page={page} />}
              <div className={passage ? "mt-3" : undefined}>
                <HighlightedText text={source.rawContent ?? ""} highlight={chunk?.content ?? ""} />
              </div>
            </div>
          )}

          {!loading && source?.type === "url" && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {source.origin && (
                <a
                  href={source.origin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm text-primary underline"
                >
                  Open original ↗
                </a>
              )}
              {passage && <CitedPassage text={passage} page={page} />}
              <HighlightedText text={source.rawContent ?? ""} highlight={chunk?.content ?? ""} />
            </div>
          )}

          {!loading && source?.type === "youtube" && source.origin && (
            <div className="flex flex-col gap-3">
              {passage && <CitedPassage text={passage} />}
              <YoutubeEmbed origin={source.origin} startSec={chunk?.metadata?.startSec} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
