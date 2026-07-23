"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitationChip } from "@/components/notebook/citation-chip";
import { parseSSEStream } from "@/lib/sse-client";
import type { Citation, DisplayMessage } from "@/lib/types";

interface ChatPanelProps {
  notebookId: string;
  disabled: boolean;
  onCitationClick: (citation: Citation) => void;
  initialChatId?: string;
  initialMessages?: DisplayMessage[];
}

function renderContent(
  content: string,
  citations: Citation[],
  onCitationClick: (c: Citation) => void,
) {
  const citationByN = new Map(citations.map((c) => [c.n, c]));
  const parts = content.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <span key={i}>{part}</span>;
    const n = Number(match[1]);
    return <CitationChip key={i} n={n} citation={citationByN.get(n)} onClick={onCitationClick} />;
  });
}

export function ChatPanel({
  notebookId,
  disabled,
  onCitationClick,
  initialChatId,
  initialMessages = [],
}: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatIdRef = useRef<string | undefined>(initialChatId);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

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
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {disabled ? "Add a source to start chatting." : "Ask a question about your sources."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "self-end" : "self-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-lg rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-2xl rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
                  }
                >
                  {m.role === "assistant"
                    ? renderContent(m.content || "…", m.citations, onCitationClick)
                    : m.content}
                </div>
              </div>
            ))}
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
          placeholder={disabled ? "Add a source to start chatting…" : "Ask a question…"}
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
