"use client";

import { useState } from "react";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatPanel, type ChatAction } from "@/components/notebook/chat-panel";
import { SourceViewer } from "@/components/notebook/source-viewer";
import { RoadmapPanel } from "@/components/learn/roadmap-panel";
import type { Citation, DisplayMessage, RoadmapItem, SuggestedResource } from "@/lib/types";

interface LearnChat {
  id: string;
  concept: string;
}

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
  initialChats: LearnChat[];
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
      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="underline">
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
        {added ? "Added" : "Add to project"}
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
  initialChats,
  initialMessagesByChat,
}: LearnShellProps) {
  const [items, setItems] = useState<RoadmapItem[]>(initialItems);
  const [chatList, setChatList] = useState<LearnChat[]>(initialChats);
  const [messagesByChat, setMessagesByChat] = useState(initialMessagesByChat);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(initialChats[0]?.id);
  const [viewerCitation, setViewerCitation] = useState<Citation | null>(null);
  const [resourcesByChat, setResourcesByChat] = useState<Record<string, { title: string; url: string }[]>>({});
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  async function refreshRoadmap() {
    const res = await fetch(`/api/learn/roadmap?notebookId=${notebook.id}`);
    if (!res.ok) return;
    const roadmap = await res.json();
    if (roadmap?.items) setItems(roadmap.items);
  }

  async function handleStartChat(item: RoadmapItem) {
    const res = await fetch("/api/learn/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId: notebook.id, roadmapItemId: item.id }),
    });
    if (!res.ok) return;
    const { chatId, roadmap } = await res.json();
    if (roadmap?.items) setItems(roadmap.items);
    setChatList((prev) =>
      prev.some((c) => c.id === chatId) ? prev : [...prev, { id: chatId, concept: item.concept }],
    );
    setMessagesByChat((prev) => (prev[chatId] ? prev : { ...prev, [chatId]: [] }));
    setActiveChatId(chatId);
  }

  function handleAddResource(url: string) {
    fetch(`/api/notebooks/${notebook.id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url", url }),
    });
  }

  function handleAction(chatId: string, action: ChatAction) {
    if (action.action === "complete_topic") {
      refreshRoadmap();
    } else if (action.action === "suggest_resources") {
      setResourcesByChat((prev) => ({ ...prev, [chatId]: action.resources }));
    }
  }

  function startChatAndCloseDrawer(item: RoadmapItem) {
    setRoadmapOpen(false);
    handleStartChat(item);
  }

  const roadmapContent = (
    <>
      <RoadmapPanel
        goal={goal}
        items={items}
        sources={sources}
        activeChatId={activeChatId}
        onStartChat={startChatAndCloseDrawer}
        onContinueChat={(id) => {
          setRoadmapOpen(false);
          setActiveChatId(id);
        }}
      />

      {initialSuggestedResources.length > 0 && (
        <div className="flex flex-col gap-2 border-t p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Suggested resources</h2>
          {initialSuggestedResources.map((r, i) => (
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
        <UserButton />
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
          {chatList.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Start a topic from the roadmap to begin.
            </div>
          ) : (
            <Tabs
              value={activeChatId}
              onValueChange={setActiveChatId}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <TabsList className="mx-3 mt-3 w-fit">
                {chatList.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>
                    {c.concept}
                  </TabsTrigger>
                ))}
              </TabsList>
              {chatList.map((c) => (
                <TabsContent
                  key={c.id}
                  value={c.id}
                  keepMounted
                  className="flex flex-1 flex-col overflow-hidden"
                >
                  <ChatPanel
                    notebookId={notebook.id}
                    disabled={false}
                    onCitationClick={setViewerCitation}
                    initialChatId={c.id}
                    initialMessages={messagesByChat[c.id] ?? []}
                    onAction={(action) => handleAction(c.id, action)}
                    emptyStateText={`This is a live tutoring chat on "${c.concept}". Send a message (even just "hi") to have your tutor start the lesson — keep chatting here to ask questions, go deeper, or say you're ready to move on.`}
                    placeholder={`Message your tutor about "${c.concept}"…`}
                  />
                  {resourcesByChat[c.id]?.length ? (
                    <div className="flex flex-wrap gap-2 border-t p-3">
                      {resourcesByChat[c.id].map((r, i) => (
                        <ResourceCard key={i} resource={r} onAdd={() => handleAddResource(r.url)} />
                      ))}
                    </div>
                  ) : null}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </main>
      </div>

      <SourceViewer citation={viewerCitation} onClose={() => setViewerCitation(null)} />
    </div>
  );
}
