"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitationChip } from "@/components/notebook/citation-chip";
import { parseSSEStream } from "@/lib/sse-client";
import type { Citation, DisplayMessage } from "@/lib/types";

export type ChatAction =
  | { action: "complete_topic" }
  | { action: "suggest_resources"; resources: { title: string; url: string }[] };

interface ChatPanelProps {
  notebookId: string;
  disabled: boolean;
  onCitationClick: (citation: Citation) => void;
  initialChatId?: string;
  initialMessages?: DisplayMessage[];
  onAction?: (action: ChatAction) => void;
  emptyStateText?: string;
  placeholder?: string;
}

function renderInline(
  text: string,
  citations: Citation[],
  onCitationClick: (c: Citation) => void,
  keyPrefix: string,
) {
  const citationByN = new Map(citations.map((c) => [c.n, c]));
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const n = Number(citationMatch[1]);
      return (
        <CitationChip
          key={`${keyPrefix}-${i}`}
          n={n}
          citation={citationByN.get(n)}
          onClick={onCitationClick}
        />
      );
    }
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) return <strong key={`${keyPrefix}-${i}`}>{boldMatch[1]}</strong>;
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

const BULLET_RE = /^\s*[*-]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;

function renderContent(
  content: string,
  citations: Citation[],
  onCitationClick: (c: Citation) => void,
) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInline(text, citations, onCitationClick, `p-${blocks.length}`)}
      </p>,
    );
  }

  let i = 0;
  while (i < lines.length) {
    const bulletMatch = lines[i].match(BULLET_RE);
    const numberedMatch = lines[i].match(NUMBERED_RE);
    const listRe = bulletMatch ? BULLET_RE : numberedMatch ? NUMBERED_RE : null;

    if (listRe) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(listRe);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      const ListTag = bulletMatch ? "ul" : "ol";
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={bulletMatch ? "list-disc space-y-1 pl-5" : "list-decimal space-y-1 pl-5"}
        >
          {items.map((item, idx) => (
            <li key={idx}>
              {renderInline(item, citations, onCitationClick, `list-${blocks.length}-${idx}`)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (lines[i].trim() === "") {
      flushParagraph();
      i++;
      continue;
    }

    paragraphBuffer.push(lines[i].trim());
    i++;
  }
  flushParagraph();

  return (
    <div className="flex flex-col gap-2">
      {blocks.length > 0 ? blocks : renderInline(content, citations, onCitationClick, "root")}
    </div>
  );
}

export function ChatPanel({
  notebookId,
  disabled,
  onCitationClick,
  initialChatId,
  initialMessages = [],
  onAction,
  emptyStateText,
  placeholder,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatIdRef = useRef<string | undefined>(initialChatId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Whether to auto-follow new content. True while the user is near the bottom;
  // false once they scroll up to read history.
  const stickRef = useRef(true);

  function updateStick() {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  // Follow new messages / streaming tokens only when sticking to the bottom.
  useEffect(() => {
    if (stickRef.current) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    // Sending always jumps to the bottom, even if the user had scrolled up.
    stickRef.current = true;

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      citations: [],
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, chatId: chatIdRef.current, message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Failed to reach chat");

      for await (const evt of parseSSEStream(res.body)) {
        if (evt.event === "meta") {
          chatIdRef.current = (evt.data as { chatId: string }).chatId;
        } else if (evt.event === "token") {
          const { text: piece } = evt.data as { text: string };
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + piece } : m)),
          );
        } else if (evt.event === "citations") {
          const { citations } = evt.data as { citations: Citation[] };
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)),
          );
        } else if (evt.event === "action") {
          onAction?.(evt.data as ChatAction);
        } else if (evt.event === "error") {
          toast.error((evt.data as { message: string }).message);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} onScroll={updateStick} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {disabled ? "Add a source to start chatting." : emptyStateText ?? "Ask a question about your sources."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "self-end" : "self-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-lg rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-2xl rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  {m.role === "assistant"
                    ? renderContent(m.content || "…", m.citations, onCitationClick)
                    : m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={disabled ? "Add a source to start chatting…" : placeholder ?? "Ask a question…"}
          disabled={disabled}
          rows={2}
          className="flex-1 resize-none"
        />
        <Button onClick={handleSend} disabled={disabled || streaming || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
