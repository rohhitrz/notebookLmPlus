"use client";

import { Check, Circle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DifficultyLevel, RoadmapItem } from "@/lib/types";

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

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
  activeItemId?: string;
  onOpen: (item: RoadmapItem) => void;
}

function StatusIcon({ status }: { status: RoadmapItem["status"] }) {
  if (status === "done") return <Check className="size-4 shrink-0 text-success" />;
  if (status === "in_progress")
    return <Loader2 className="size-4 shrink-0 text-primary" />;
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
  activeItemId,
  onOpen,
}: RoadmapPanelProps) {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const done = items.filter((i) => i.status === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground">Roadmap</h2>
        {goal && <p className="mt-1 text-sm">{goal}</p>}
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>
              {done}/{items.length} chapters · {pct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No roadmap yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-md border p-3 ${
                item.id === activeItemId ? "border-primary ring-1 ring-primary/40" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.concept}</p>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {DIFFICULTY_LABEL[item.difficulty ?? "beginner"]}
                    </Badge>
                    {item.estMinutes != null && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="size-3" />~{item.estMinutes} min
                      </span>
                    )}
                  </div>

                  {item.why && <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>}

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
                    <Button
                      size="sm"
                      variant={item.id === activeItemId ? "default" : "outline"}
                      onClick={() => onOpen(item)}
                    >
                      {item.status === "done"
                        ? "Review chapter"
                        : item.content || item.chatId
                          ? "Continue"
                          : "Study chapter"}
                    </Button>
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
