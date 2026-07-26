"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  SignalHigh,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseSSEStream } from "@/lib/sse-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { ChatPanel, type ChatAction } from "@/components/notebook/chat-panel";
import type {
  ChapterCitation,
  ChapterContent,
  Citation,
  DifficultyLevel,
  DisplayMessage,
  RoadmapItem,
} from "@/lib/types";

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function ChapterMeta({ item }: { item: RoadmapItem }) {
  const difficulty = item.difficulty ?? "beginner";
  const minutes = item.estMinutes ?? null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary" className="gap-1">
        <SignalHigh className="size-3" />
        {DIFFICULTY_LABEL[difficulty]}
      </Badge>
      {minutes != null && (
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          ~{minutes} min
        </span>
      )}
    </div>
  );
}

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
    return line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).map((part, i) => {
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
      const inlineCode = part.match(/^`([^`]+)`$/);
      if (inlineCode) {
        return (
          <code
            key={`${key}-${i}`}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
          >
            {inlineCode[1]}
          </code>
        );
      }
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={`${key}-${i}`}>{bold[1]}</strong>;
      return <span key={`${key}-${i}`}>{part}</span>;
    });
  }

  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (!listItems.length) return;
    const items = listItems;
    listItems = [];
    const Tag = listOrdered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={
          listOrdered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"
        }
      >
        {items.map((b, i) => (
          <li key={i}>{renderInline(b, `list-${blocks.length}-${i}`)}</li>
        ))}
      </Tag>,
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Fenced code block: ```lang … ```. Collect raw (untrimmed) lines so
    // indentation survives. A fence left unclosed mid-stream renders anyway.
    const fence = line.match(/^```([\w+-]*)/);
    if (fence) {
      flushList();
      const lang = fence[1] || undefined;
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume the closing fence
      blocks.push(
        <CodeBlock key={`code-${blocks.length}`} code={code.join("\n")} lang={lang} />,
      );
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const big = heading[1].length <= 2;
      blocks.push(
        big ? (
          <h2
            key={`h-${blocks.length}`}
            className="mt-4 font-sans text-lg font-semibold tracking-tight"
          >
            {renderInline(heading[2], `h-${blocks.length}`)}
          </h2>
        ) : (
          <h3
            key={`h-${blocks.length}`}
            className="mt-3 font-sans text-base font-semibold tracking-tight"
          >
            {renderInline(heading[2], `h-${blocks.length}`)}
          </h3>
        ),
      );
      i++;
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (ordered || bullet) {
      const isOrdered = Boolean(ordered);
      // A change of list type ends the previous list and starts a new one.
      if (listItems.length && isOrdered !== listOrdered) flushList();
      listOrdered = isOrdered;
      listItems.push((ordered ?? bullet)![1]);
      i++;
      continue;
    }
    flushList();
    if (line) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-relaxed">
          {renderInline(line, `p-${blocks.length}`)}
        </p>,
      );
    }
    i++;
  }
  flushList();

  // Long-form lesson prose gets the reading serif at a comfortable measure;
  // headings stay in the UI sans (set on each heading) for contrast.
  return (
    <div className="flex flex-col gap-3 font-serif text-[15px] leading-[1.75] sm:text-base">
      {blocks}
    </div>
  );
}

function Lesson({
  notebookId,
  item,
  onChapter,
  onStatus,
}: Pick<ChapterViewProps, "notebookId" | "item" | "onChapter" | "onStatus">) {
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  // Markdown accumulated live while the lesson streams in (before it's persisted
  // into item.content).
  const [streamedBody, setStreamedBody] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const content = item.content;

  // Keep the latest onChapter without making it an effect dependency. If it were
  // a dependency, an unrelated parent re-render (e.g. the tutor chat being
  // created via ensureChat) would change its identity, abort the in-flight
  // stream, and leave the lesson stuck buffering until a manual refresh.
  const onChapterRef = useRef(onChapter);
  useEffect(() => {
    onChapterRef.current = onChapter;
  });

  useEffect(() => {
    if (item.content) return; // already generated — render the stored lesson
    const controller = new AbortController();
    (async () => {
      setStreaming(true);
      setStreamedBody("");
      setError(null);
      try {
        const res = await fetch("/api/learn/chapters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notebookId, roadmapItemId: item.id }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error("Failed to build this chapter. Please try again.");

        for await (const evt of parseSSEStream(res.body)) {
          if (evt.event === "token") {
            const { text } = evt.data as { text: string };
            setStreamedBody((prev) => prev + text);
          } else if (evt.event === "done") {
            const { content: generated } = evt.data as { content: ChapterContent };
            onChapterRef.current(item.id, generated);
          } else if (evt.event === "error") {
            throw new Error((evt.data as { message: string }).message);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to build chapter");
        }
      } finally {
        if (!controller.signal.aborted) setStreaming(false);
      }
    })();
    return () => controller.abort();
    // item.content is read but intentionally omitted: generation runs once per
    // mount (or per manual retry via `attempt`), never on later content updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, notebookId, attempt]);

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

  // Nothing to show yet and nothing streaming: initial connect / web search.
  if (!content && !streamedBody && !error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <div>
          <p className="font-medium text-foreground">Building your chapter…</p>
          <p>Searching the web for a grounded lesson on “{item.concept}”.</p>
        </div>
      </div>
    );
  }

  if (error && !content && !streamedBody) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm">
        <p className="text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setStreamedBody("");
            setAttempt((a) => a + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const body = content?.body ?? streamedBody;
  const citations = content?.citations ?? [];
  const legacy = content && !content.body && (content.sections?.length ?? 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <article className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{item.concept}</h1>
          <ChapterMeta item={item} />
          {legacy && content?.overview && (
            <p className="text-sm text-muted-foreground">{content.overview}</p>
          )}
        </header>

        {legacy ? (
          <>
            {content!.sections!.map((s, i) => (
              <section key={i} className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">{s.heading}</h2>
                <LessonBody text={s.body} citations={citations} />
              </section>
            ))}
            {(content!.keyTakeaways?.length ?? 0) > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-4">
                <h2 className="text-sm font-semibold">Key takeaways</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {content!.keyTakeaways!.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          body && <LessonBody text={body} citations={citations} />
        )}

        {streaming && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Writing your lesson…
          </p>
        )}

        {citations.length > 0 && (
          <section className="flex flex-col gap-1.5 border-t pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sources
            </h2>
            {citations.map((c) => (
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

        {content && (
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
        )}
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
