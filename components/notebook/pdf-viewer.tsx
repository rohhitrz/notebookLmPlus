"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  page?: number;
  highlightText?: string;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function PdfViewer({ fileUrl, page, highlightText }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(page && page > 0 ? page : 1);

  // Jump to the cited page whenever the citation (or file) changes.
  useEffect(() => {
    setCurrentPage(page && page > 0 ? page : 1);
    setNumPages(0);
  }, [fileUrl, page]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      // Leave a little padding so the page doesn't clip against the dialog edge.
      setWidth(Math.max(280, Math.floor(entry.contentRect.width) - 8));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const normalizedHighlight = highlightText ? normalize(highlightText) : "";

  function customTextRenderer({ str }: { str: string }): string {
    const trimmed = str.trim();
    if (!normalizedHighlight || trimmed.length < 2) return str;
    const hay = normalize(str);
    // PDF text is split into tiny spans; mark any span that appears in the cited chunk.
    if (hay.length >= 2 && normalizedHighlight.includes(hay)) {
      return `<mark class="citation-mark">${str}</mark>`;
    }
    return str;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-28 text-center text-sm text-muted-foreground tabular-nums">
          {numPages > 0 ? (
            <>
              Page <span className="font-medium text-foreground">{currentPage}</span>
              <span className="mx-1">/</span>
              {numPages}
            </>
          ) : (
            "Loading…"
          )}
          {page != null && page !== currentPage && (
            <button
              type="button"
              className="ml-2 text-primary hover:underline"
              onClick={() => setCurrentPage(page)}
            >
              cited p.{page}
            </button>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={numPages === 0 || currentPage >= numPages}
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex justify-center pb-2">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setCurrentPage((p) => Math.min(Math.max(1, p), n));
            }}
            loading={<p className="p-8 text-sm text-muted-foreground">Loading PDF…</p>}
            error={<p className="p-8 text-sm text-destructive">Could not load PDF.</p>}
          >
            {width > 0 && numPages > 0 && (
              <Page
                pageNumber={currentPage}
                width={width}
                customTextRenderer={
                  page != null && currentPage === page ? customTextRenderer : undefined
                }
                className="citation-pdf-page shadow-sm ring-1 ring-foreground/10"
              />
            )}
          </Document>
        </div>
      </div>

    </div>
  );
}
