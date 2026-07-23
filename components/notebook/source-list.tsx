"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlertCircle,
  Check,
  FileText,
  Globe,
  Loader2,
  MoreVertical,
  RotateCw,
  Trash2,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddSourceDialog } from "@/components/notebook/add-source-dialog";
import { NON_TERMINAL_SOURCE_STATUSES, type SourceListItem, type SourceStatus } from "@/lib/types";

interface SourceListProps {
  notebookId: string;
  sources: SourceListItem[];
  onSourcesChange: Dispatch<SetStateAction<SourceListItem[]>>;
}

const TYPE_ICON: Record<SourceListItem["type"], React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  text: FileText,
  vtt: FileText,
  url: Globe,
  youtube: Video,
};

function StatusBadge({ status, errorMessage }: { status: SourceStatus; errorMessage: string | null }) {
  if (status === "ready") {
    return (
      <Badge variant="secondary">
        <Check className="size-3" />
        Ready
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" title={errorMessage ?? undefined}>
        <AlertCircle className="size-3" />
        Error
      </Badge>
    );
  }
  if (status === "uploading") {
    return (
      <Badge variant="outline">
        <Loader2 className="size-3 animate-spin" />
        Uploading
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Loader2 className="size-3 animate-spin" />
      Indexing…
    </Badge>
  );
}

export function SourceList({ notebookId, sources, onSourcesChange }: SourceListProps) {
  useEffect(() => {
    const hasNonTerminal = sources.some((s) =>
      NON_TERMINAL_SOURCE_STATUSES.includes(s.status),
    );
    if (!hasNonTerminal) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/status`);
      if (!res.ok) return;
      const statuses: { id: string; status: SourceStatus; errorMessage: string | null }[] =
        await res.json();
      onSourcesChange((prev) =>
        prev.map((s) => {
          const match = statuses.find((x) => x.id === s.id);
          return match ? { ...s, status: match.status, errorMessage: match.errorMessage } : s;
        }),
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [sources, notebookId, onSourcesChange]);

  async function handleReindex(id: string) {
    onSourcesChange((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "uploading", errorMessage: null } : s)),
    );
    await fetch(`/api/sources/${id}/reindex`, { method: "POST" });
  }

  async function handleDelete(id: string) {
    onSourcesChange((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Sources</h2>
        <AddSourceDialog
          notebookId={notebookId}
          onAdded={(items) => onSourcesChange((prev) => [...prev, ...items])}
        />
      </div>

      {sources.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Add a source to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sources.map((source) => {
            const Icon = TYPE_ICON[source.type];
            return (
              <li
                key={source.id}
                className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" title={source.title}>
                    {source.title}
                  </p>
                  <StatusBadge status={source.status} errorMessage={source.errorMessage} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleReindex(source.id)}>
                      <RotateCw className="size-4" />
                      Re-index
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => handleDelete(source.id)}>
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
