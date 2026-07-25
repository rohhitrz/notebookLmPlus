"use client";

import Link from "next/link";
import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { ChatPanel } from "@/components/notebook/chat-panel";
import { SourceList } from "@/components/notebook/source-list";
import { SourceViewer } from "@/components/notebook/source-viewer";
import { StudioPanel } from "@/components/notebook/studio-panel";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArtifactListItem, Citation, DisplayMessage, SourceListItem } from "@/lib/types";

interface NotebookShellProps {
  notebook: { id: string; title: string };
  initialSources: SourceListItem[];
  initialChatId?: string;
  initialMessages?: DisplayMessage[];
  initialArtifacts?: ArtifactListItem[];
}

export function NotebookShell({
  notebook,
  initialSources,
  initialChatId,
  initialMessages,
  initialArtifacts = [],
}: NotebookShellProps) {
  const [sources, setSources] = useState<SourceListItem[]>(initialSources);
  const [viewerCitation, setViewerCitation] = useState<Citation | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const hasReadySource = sources.some((s) => s.status === "ready");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Show sources"
            onClick={() => setSourcesOpen(true)}
          >
            <PanelLeft className="size-4" />
          </Button>
          <Link href="/" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            ← Library
          </Link>
          <span className="truncate font-semibold">{notebook.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r md:block">
          <SourceList notebookId={notebook.id} sources={sources} onSourcesChange={setSources} />
        </aside>

        <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm gap-0 p-0">
            <SheetHeader className="border-b">
              <SheetTitle>Sources</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SourceList notebookId={notebook.id} sources={sources} onSourcesChange={setSources} />
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Tabs defaultValue="chat" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="studio">Studio</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" keepMounted className="flex flex-1 flex-col overflow-hidden">
              <ChatPanel
                notebookId={notebook.id}
                disabled={!hasReadySource}
                onCitationClick={setViewerCitation}
                initialChatId={initialChatId}
                initialMessages={initialMessages}
              />
            </TabsContent>
            <TabsContent value="studio" keepMounted className="flex flex-1 flex-col overflow-hidden">
              <StudioPanel
                notebookId={notebook.id}
                sources={sources}
                initialArtifacts={initialArtifacts}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <SourceViewer citation={viewerCitation} onClose={() => setViewerCitation(null)} />
    </div>
  );
}
