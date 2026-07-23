"use client";

import Link from "next/link";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { ChatPanel } from "@/components/notebook/chat-panel";
import { SourceList } from "@/components/notebook/source-list";
import { SourceViewer } from "@/components/notebook/source-viewer";
import type { Citation, DisplayMessage, SourceListItem } from "@/lib/types";

interface NotebookShellProps {
  notebook: { id: string; title: string };
  initialSources: SourceListItem[];
  initialChatId?: string;
  initialMessages?: DisplayMessage[];
}

export function NotebookShell({
  notebook,
  initialSources,
  initialChatId,
  initialMessages,
}: NotebookShellProps) {
  const [sources, setSources] = useState<SourceListItem[]>(initialSources);
  const [viewerCitation, setViewerCitation] = useState<Citation | null>(null);

  const hasReadySource = sources.some((s) => s.status === "ready");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Notebooks
          </Link>
          <span className="truncate font-semibold">{notebook.title}</span>
        </div>
        <UserButton />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r">
          <SourceList notebookId={notebook.id} sources={sources} onSourcesChange={setSources} />
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <ChatPanel
            notebookId={notebook.id}
            disabled={!hasReadySource}
            onCitationClick={setViewerCitation}
            initialChatId={initialChatId}
            initialMessages={initialMessages}
          />
        </main>
      </div>

      <SourceViewer citation={viewerCitation} onClose={() => setViewerCitation(null)} />
    </div>
  );
}
