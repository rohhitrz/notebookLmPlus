"use client";

import { useState } from "react";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type ChatAction } from "@/components/notebook/chat-panel";
import { SourceViewer } from "@/components/notebook/source-viewer";
import { ChapterView } from "@/components/learn/chapter-view";
import { RoadmapPanel } from "@/components/learn/roadmap-panel";
import type {
  ChapterContent,
  Citation,
  DisplayMessage,
  RoadmapItem,
  SuggestedResource,
} from "@/lib/types";

interface LearnSource {
  id: string;
  type: string;
  title: string;
  origin: string | null;
}

interface LearnShellProps {
  notebook: { id: string; title: string };
  goal: string;
  initialItems: RoadmapItem[];
  initialSuggestedResources: SuggestedResource[];
  sources: LearnSource[];
  initialMessagesByChat: Record<string, DisplayMessage[]>;
}

function ResourceCard({
  resource,
  onAdd,
}: {
  resource: { title: string; url: string };
  onAdd: () => void;
}) {
  const [added, setAdded] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate underline"
      >
        {resource.title}
      </a>
      <Button
        size="sm"
        variant="outline"
        disabled={added}
        onClick={() => {
          onAdd();
          setAdded(true);
        }}
      >
        {added ? "Added" : "Add"}
      </Button>
    </div>
  );
}

export function LearnShell({
  notebook,
  goal,
  initialItems,
  initialSuggestedResources,
  sources,
  initialMessagesByChat,
}: LearnShellProps) {
  const [items, setItems] = useState<RoadmapItem[]>(initialItems);
  const [messagesByChat, setMessagesByChat] = useState(initialMessagesByChat);
  const [activeItemId, setActiveItemId] = useState<string | undefined>(
    () => initialItems.find((i) => i.chatId || i.content)?.id ?? initialItems[0]?.id,
  );
  const [viewerCitation, setViewerCitation] = useState<Citation | null>(null);
  const [extraResources, setExtraResources] = useState<{ title: string; url: string }[]>([]);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  const activeItem = items.find((i) => i.id === activeItemId);

  async function refreshRoadmap() {
    const res = await fetch(`/api/learn/roadmap?notebookId=${notebook.id}`);
    if (!res.ok) return;
    const roadmap = await res.json();
    if (roadmap?.items) setItems(roadmap.items);
  }

  // Every chapter gets its own scoped tutoring chat (created lazily so the topic
  // is bound to the concept). Called when a chapter is opened.
  async function ensureChat(item: RoadmapItem) {
    if (item.chatId) return;
    const res = await fetch("/api/learn/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId: notebook.id, roadmapItemId: item.id }),
    });
    if (!res.ok) return;
    const { chatId, roadmap } = await res.json();
    if (roadmap?.items) setItems(roadmap.items);
    else setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, chatId } : i)));
    setMessagesByChat((prev) => (prev[chatId] ? prev : { ...prev, [chatId]: [] }));
  }

  function handleOpen(item: RoadmapItem) {
    setActiveItemId(item.id);
    setRoadmapOpen(false);
    ensureChat(item);
  }

  function handleChapter(itemId: string, content: ChapterContent) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, content, status: i.status === "todo" ? "in_progress" : i.status }
          : i,
      ),
    );
  }

  function handleStatus(itemId: string, status: RoadmapItem["status"]) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status } : i)));
  }

  function handleAddResource(url: string) {
    fetch(`/api/notebooks/${notebook.id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url", url }),
    });
  }

  function handleAction(_chatId: string, action: ChatAction) {
    if (action.action === "complete_topic") {
      refreshRoadmap();
    } else if (action.action === "suggest_resources") {
      setExtraResources((prev) => {
        const seen = new Set(prev.map((r) => r.url));
        return [...prev, ...action.resources.filter((r) => !seen.has(r.url))];
      });
    }
  }

  const allResources = [...initialSuggestedResources, ...extraResources];

  const roadmapContent = (
    <>
      <RoadmapPanel
        goal={goal}
        items={items}
        sources={sources}
        activeItemId={activeItemId}
        onOpen={handleOpen}
      />

      {allResources.length > 0 && (
        <div className="flex flex-col gap-2 border-t p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Suggested resources</h2>
          {allResources.map((r, i) => (
            <ResourceCard key={i} resource={r} onAdd={() => handleAddResource(r.url)} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Show roadmap"
            onClick={() => setRoadmapOpen(true)}
          >
            <PanelLeft className="size-4" />
          </Button>
          <Link href="/" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            ← Notebooks
          </Link>
          <span className="truncate font-semibold">{notebook.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-96 shrink-0 overflow-y-auto border-r md:block">
          {roadmapContent}
        </aside>

        <Sheet open={roadmapOpen} onOpenChange={setRoadmapOpen}>
          <SheetContent side="left" className="w-[90vw] max-w-md gap-0 p-0">
            <SheetHeader className="border-b">
              <SheetTitle>Roadmap</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{roadmapContent}</div>
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeItem ? (
            <ChapterView
              key={activeItem.id}
              notebookId={notebook.id}
              item={activeItem}
              chatId={activeItem.chatId ?? undefined}
              initialMessages={
                activeItem.chatId ? messagesByChat[activeItem.chatId] ?? [] : []
              }
              onCitation={setViewerCitation}
              onChapter={handleChapter}
              onStatus={handleStatus}
              onAction={handleAction}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Pick a chapter from the roadmap to begin.
            </div>
          )}
        </main>
      </div>

      <SourceViewer citation={viewerCitation} onClose={() => setViewerCitation(null)} />
    </div>
  );
}
