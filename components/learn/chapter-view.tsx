"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, CheckCircle2, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChatPanel, type ChatAction } from "@/components/notebook/chat-panel";
import type {
  ChapterCitation,
  ChapterContent,
  Citation,
  DisplayMessage,
  RoadmapItem,
} from "@/lib/types";

interface ChapterViewProps {
  notebookId: string;
  item: RoadmapItem;
  chatId?: string;
  initialMessages: DisplayMessage[];
  onCitation: (c: Citation) => void;
  onChapter: (itemId: string, content: ChapterContent) => void;
  onStatus: (itemId: string, status: RoadmapItem["status"]) => void;
  onAction: (chatId: string, action: ChatAction) => void;
}

// Renders lesson body text: paragraphs, "- " bullets, **bold**, and [n] markers
// as superscript links to the chapter's web sources.
function LessonBody({ text, citations }: { text: string; citations: ChapterCitation[] }) {
  const byN = new Map(citations.map((c) => [c.n, c]));

  function renderInline(line: string, key: string): ReactNode[] {
    return line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
      const cite = part.match(/^\[(\d+)\]$/);
      if (cite) {
        const c = byN.get(Number(cite[1]));
        if (!c) return <span key={`${key}-${i}`}>{part}</span>;
        return (
          <a
            key={`${key}-${i}`}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className="mx-0.5 align-super text-[10px] font-medium text-primary hover:underline"
          >
            [{c.n}]
          </a>
        );
      }
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={`${key}-${i}`}>{bold[1]}</strong>;
      return <span key={`${key}-${i}`}>{part}</span>;
    });
  }

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {items.map((b, i) => (
          <li key={i}>{renderInline(b, `ul-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    if (line) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-relaxed">
          {renderInline(line, `p-${blocks.length}`)}
        </p>,
      );
    }
  }
  flushBullets();

  return <div className="flex flex-col gap-2 text-sm">{blocks}</div>;
}

function Lesson({
  notebookId,
  item,
  onChapter,
  onStatus,
}: Pick<ChapterViewProps, "notebookId" | "item" | "onChapter" | "onStatus">) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const requested = useRef(false);

  const content = item.content;

  useEffect(() => {
    if (content || requested.current) return;
    requested.current = true;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch("/api/learn/chapters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebookId, roadmapItemId: item.id }),
        });
        if (!res.ok) throw new Error("Failed to build this chapter. Please try again.");
        const { content: generated } = (await res.json()) as { content: ChapterContent };
        if (!cancelled) onChapter(item.id, generated);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to build chapter");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, item.id, notebookId, onChapter]);

  async function markComplete() {
    const next = item.status === "done" ? "in_progress" : "done";
    setMarking(true);
    try {
      const res = await fetch("/api/learn/chapters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, roadmapItemId: item.id, status: next }),
      });
      if (!res.ok) throw new Error("Failed to update progress");
      onStatus(item.id, next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update progress");
    } finally {
      setMarking(false);
    }
  }

  if (generating || (!content && !error)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <div>
          <p className="font-medium text-foreground">Building your chapter…</p>
          <p>Searching the web and assembling a grounded lesson on “{item.concept}”.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm">
        <p className="text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            requested.current = false;
            setError(null);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <article className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{item.concept}</h1>
          <p className="text-sm text-muted-foreground">{content.overview}</p>
        </header>

        {content.sections.map((s, i) => (
          <section key={i} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            <LessonBody text={s.body} citations={content.citations} />
          </section>
        ))}

        {content.keyTakeaways.length > 0 && (
          <section className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-4">
            <h2 className="text-sm font-semibold">Key takeaways</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {content.keyTakeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        {content.citations.length > 0 && (
          <section className="flex flex-col gap-1.5 border-t pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sources
            </h2>
            {content.citations.map((c) => (
              <a
                key={c.n}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="text-primary">[{c.n}]</span>
                <span className="truncate">{c.title}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ))}
          </section>
        )}

        <div className="pt-2">
          <Button
            variant={item.status === "done" ? "outline" : "default"}
            onClick={markComplete}
            disabled={marking}
          >
            <CheckCircle2 className="size-4" />
            {item.status === "done" ? "Completed — mark as unread" : "Mark chapter complete"}
          </Button>
        </div>
      </article>
    </div>
  );
}

export function ChapterView({
  notebookId,
  item,
  chatId,
  initialMessages,
  onCitation,
  onChapter,
  onStatus,
  onAction,
}: ChapterViewProps) {
  const [tab, setTab] = useState<"lesson" | "ask">("lesson");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <SegBtn active={tab === "lesson"} onClick={() => setTab("lesson")} icon={BookOpen}>
          Lesson
        </SegBtn>
        <SegBtn active={tab === "ask"} onClick={() => setTab("ask")} icon={MessageCircle}>
          Ask the tutor
        </SegBtn>
      </div>

      {tab === "lesson" ? (
        <Lesson notebookId={notebookId} item={item} onChapter={onChapter} onStatus={onStatus} />
      ) : chatId ? (
        <ChatPanel
          key={chatId}
          notebookId={notebookId}
          disabled={false}
          onCitationClick={onCitation}
          initialChatId={chatId}
          initialMessages={initialMessages}
          onAction={(action) => onAction(chatId, action)}
          emptyStateText={`Ask anything about “${item.concept}” — your tutor answers from this chapter’s material.`}
          placeholder={`Ask about “${item.concept}”…`}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Preparing your tutor chat…
        </div>
      )}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
