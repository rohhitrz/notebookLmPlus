"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoadmapItem } from "@/lib/types";

interface RoadmapSource {
  id: string;
  type: string;
  title: string;
  origin: string | null;
}

interface RoadmapPanelProps {
  goal: string;
  items: RoadmapItem[];
  sources: RoadmapSource[];
  activeChatId?: string;
  onStartChat: (item: RoadmapItem) => void;
  onContinueChat: (chatId: string) => void;
}

function StatusIcon({ status }: { status: RoadmapItem["status"] }) {
  if (status === "done") return <Check className="size-4 shrink-0 text-green-600" />;
  if (status === "in_progress") return <Loader2 className="size-4 shrink-0 text-muted-foreground" />;
  return <Circle className="size-4 shrink-0 text-muted-foreground" />;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RoadmapPanel({
  goal,
  items,
  sources,
  activeChatId,
  onStartChat,
  onContinueChat,
}: RoadmapPanelProps) {
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Roadmap</h2>
        {goal && <p className="mt-1 text-sm">{goal}</p>}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No roadmap yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-md border p-3 ${
                item.chatId && item.chatId === activeChatId ? "border-primary" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.concept}</p>
                  {item.why && <p className="mt-0.5 text-xs text-muted-foreground">{item.why}</p>}

                  {item.sources.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.sources.map((s, i) => {
                        const source = sourceById.get(s.sourceId);
                        if (!source) return null;
                        if (source.type === "youtube" && source.origin && s.startSec != null) {
                          const sep = source.origin.includes("?") ? "&" : "?";
                          return (
                            <a
                              key={i}
                              href={`${source.origin}${sep}t=${Math.floor(s.startSec)}s`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline"
                            >
                              {source.title} @ {formatTimestamp(s.startSec)}
                            </a>
                          );
                        }
                        return (
                          <span key={i} className="text-xs text-muted-foreground">
                            {source.title}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-2">
                    {item.chatId ? (
                      <Button size="sm" variant="outline" onClick={() => onContinueChat(item.chatId!)}>
                        Continue chat
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => onStartChat(item)}>
                        Start chat
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
