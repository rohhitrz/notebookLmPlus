"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Download, Loader2, Mic, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ArtifactDetail,
  ArtifactListItem,
  PodcastArtifactMetadata,
  PodcastLength,
  PptxArtifactMetadata,
  SourceListItem,
} from "@/lib/types";

interface StudioPanelProps {
  notebookId: string;
  sources: SourceListItem[];
  initialArtifacts: ArtifactListItem[];
}

function StatusBadge({ status, errorMessage }: { status: ArtifactDetail["status"]; errorMessage: string | null }) {
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (status === "error")
    return (
      <Badge variant="destructive" title={errorMessage ?? undefined}>
        <AlertCircle className="size-3" />
        Error
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Loader2 className="size-3 animate-spin" />
      Generating…
    </Badge>
  );
}

function PodcastCard({ detail }: { detail: ArtifactDetail }) {
  const [showScript, setShowScript] = useState(false);
  const meta = detail.metadata as PodcastArtifactMetadata | null;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mic className="size-4 shrink-0 text-muted-foreground" />
          Podcast{meta?.length ? ` (${meta.length})` : ""}
        </div>
        <StatusBadge status={detail.status} errorMessage={detail.errorMessage} />
      </div>

      {detail.status === "error" && detail.errorMessage && (
        <p className="text-xs text-destructive">{detail.errorMessage}</p>
      )}

      {detail.status === "ready" && detail.url && (
        <div className="flex flex-col gap-2">
          <audio controls src={detail.url} className="w-full" />
          {meta?.script && meta.script.length > 0 && (
            <Button size="sm" variant="outline" className="w-fit" onClick={() => setShowScript((s) => !s)}>
              {showScript ? "Hide script" : "Show script"}
            </Button>
          )}
          {showScript && meta?.script && (
            <div className="max-h-64 overflow-y-auto rounded-md bg-muted p-2 text-xs">
              {meta.script.map((turn, i) => (
                <p key={i} className="mb-2">
                  <span className="font-semibold">{turn.speaker === "HOST_A" ? "Host A" : "Host B"}: </span>
                  {turn.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PptxCard({ detail }: { detail: ArtifactDetail }) {
  const meta = detail.metadata as PptxArtifactMetadata | null;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Presentation className="size-4 shrink-0 text-muted-foreground" />
          {meta?.topic ?? "Slide deck"}
          {meta?.slideCount ? ` (${meta.slideCount} slides)` : ""}
        </div>
        <StatusBadge status={detail.status} errorMessage={detail.errorMessage} />
      </div>

      {detail.status === "error" && detail.errorMessage && (
        <p className="text-xs text-destructive">{detail.errorMessage}</p>
      )}

      {detail.status === "ready" && detail.url && (
        <a href={detail.url} download className="w-fit">
          <Button size="sm" variant="outline">
            <Download className="size-4" />
            Download .pptx
          </Button>
        </a>
      )}
    </div>
  );
}

export function StudioPanel({ notebookId, sources, initialArtifacts }: StudioPanelProps) {
  const readySources = sources.filter((s) => s.status === "ready");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [length, setLength] = useState<PodcastLength>("short");
  const [topic, setTopic] = useState("");
  const [submittingPodcast, setSubmittingPodcast] = useState(false);
  const [submittingPptx, setSubmittingPptx] = useState(false);

  const [artifactList, setArtifactList] = useState<ArtifactListItem[]>(initialArtifacts);
  const [details, setDetails] = useState<Record<string, ArtifactDetail>>({});

  async function fetchDetail(id: string) {
    const res = await fetch(`/api/artifacts/${id}`);
    if (!res.ok) return;
    const detail: ArtifactDetail = await res.json();
    setDetails((prev) => ({ ...prev, [id]: detail }));
  }

  useEffect(() => {
    initialArtifacts.forEach((a) => fetchDetail(a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const generatingIds = artifactList
      .filter((a) => (details[a.id]?.status ?? a.status) === "generating")
      .map((a) => a.id);
    if (generatingIds.length === 0) return;

    const interval = setInterval(() => {
      generatingIds.forEach((id) => fetchDetail(id));
    }, 2500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactList, details]);

  function toggleSource(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addArtifact(item: ArtifactListItem, detail: ArtifactDetail) {
    setArtifactList((prev) => [item, ...prev]);
    setDetails((prev) => ({ ...prev, [item.id]: detail }));
  }

  async function handleGeneratePodcast() {
    if (selectedIds.size === 0) return;
    setSubmittingPodcast(true);
    try {
      const res = await fetch("/api/studio/podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, sourceIds: [...selectedIds], length }),
      });
      if (!res.ok) throw new Error("Failed to start podcast generation");
      const { id } = (await res.json()) as { id: string };
      addArtifact(
        { id, type: "podcast", status: "generating", createdAt: new Date().toISOString() },
        {
          id,
          notebookId,
          type: "podcast",
          status: "generating",
          errorMessage: null,
          metadata: { length, script: [] },
          url: null,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start podcast generation");
    } finally {
      setSubmittingPodcast(false);
    }
  }

  async function handleGeneratePptx() {
    if (selectedIds.size === 0) return;
    setSubmittingPptx(true);
    try {
      const focus = topic.trim() || undefined;
      const res = await fetch("/api/studio/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, sourceIds: [...selectedIds], focus }),
      });
      if (!res.ok) throw new Error("Failed to start slide generation");
      const { id } = (await res.json()) as { id: string };
      addArtifact(
        { id, type: "pptx", status: "generating", createdAt: new Date().toISOString() },
        {
          id,
          notebookId,
          type: "pptx",
          status: "generating",
          errorMessage: null,
          metadata: { topic: focus ?? null, slideCount: null },
          url: null,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start slide generation");
    } finally {
      setSubmittingPptx(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Sources</h2>
        {readySources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add and index a source to use Studio.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {readySources.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSource(s.id)}
                    className="size-4 shrink-0"
                  />
                  <span className="truncate" title={s.title}>
                    {s.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">Podcast</h3>
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as PodcastLength)}
          className="h-8 w-fit rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
        >
          <option value="short">Short (~900 words)</option>
          <option value="medium">Medium (~1800 words)</option>
        </select>
        <Button
          size="sm"
          className="w-fit"
          disabled={selectedIds.size === 0 || submittingPodcast}
          onClick={handleGeneratePodcast}
        >
          {submittingPodcast ? "Starting…" : "Generate podcast"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">Slide deck</h3>
        <p className="text-xs text-muted-foreground">
          Slide count and title are decided automatically from the source content (up to 30 slides).
        </p>
        <Input
          placeholder="Optional: narrow the focus (leave blank to auto-summarize)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <Button
          size="sm"
          className="w-fit"
          disabled={selectedIds.size === 0 || submittingPptx}
          onClick={handleGeneratePptx}
        >
          {submittingPptx ? "Starting…" : "Generate slides"}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Artifacts</h2>
        {artifactList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No artifacts yet.</p>
        ) : (
          artifactList.map((a) => {
            const detail = details[a.id];
            if (!detail) return null;
            return a.type === "podcast" ? (
              <PodcastCard key={a.id} detail={detail} />
            ) : (
              <PptxCard key={a.id} detail={detail} />
            );
          })
        )}
      </div>
    </div>
  );
}
