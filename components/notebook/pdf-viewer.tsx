"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  page?: number;
  highlightText?: string;
}

export function PdfViewer({ fileUrl, page, highlightText }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const targetPageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (numPages > 0) {
      targetPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [page, numPages]);

  function customTextRenderer({ str }: { str: string }): string {
    const trimmed = str.trim();
    if (highlightText && trimmed.length > 3 && highlightText.includes(trimmed)) {
      return `<mark>${str}</mark>`;
    }
    return str;
  }

  return (
    <div className="flex flex-col items-center gap-4 overflow-y-auto">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={<p className="p-8 text-sm text-muted-foreground">Loading PDF…</p>}
        error={<p className="p-8 text-sm text-destructive">Could not load PDF.</p>}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
          <div key={p} ref={p === page ? targetPageRef : undefined} className="mb-4">
            <Page
              pageNumber={p}
              width={480}
              customTextRenderer={p === page ? customTextRenderer : undefined}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
