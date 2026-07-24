"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  Captions,
  FileText,
  Globe,
  Plus,
  Type,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SourceListItem } from "@/lib/types";

interface AddSourceDialogProps {
  notebookId: string;
  onAdded: (items: SourceListItem[]) => void;
}

type Mode = "pdf" | "youtube" | "url" | "text" | "vtt";

const TILES: {
  mode: Mode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { mode: "pdf", label: "PDF", icon: FileText },
  { mode: "youtube", label: "YT Link", icon: Video },
  { mode: "url", label: "Web Link", icon: Globe },
  { mode: "text", label: "Text", icon: Type },
  { mode: "vtt", label: "VTT", icon: Captions },
];

export function AddSourceDialog({ notebookId, onAdded }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFile(null);
    setUrl("");
    setYoutubeUrl("");
    setPasteTitle("");
    setPasteText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMode(null);
      resetForm();
    }
  }

  async function submitAndClose(request: () => Promise<Response>) {
    setSubmitting(true);
    try {
      const res = await request();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add source");
      }
      const { items } = (await res.json()) as {
        items: { id: string; type: SourceListItem["type"]; title: string }[];
      };
      onAdded(
        items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          status: "uploading" as const,
          errorMessage: null,
        })),
      );
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileSubmit(type: "pdf" | "vtt") {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== type) {
      toast.error(`Please choose a .${type} file`);
      return;
    }
    const form = new FormData();
    form.set("type", type);
    form.set("file", file);
    submitAndClose(() =>
      fetch(`/api/notebooks/${notebookId}/sources`, { method: "POST", body: form }),
    );
  }

  function handleUrlSubmit() {
    if (!url.trim()) return;
    submitAndClose(() =>
      fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url: url.trim() }),
      }),
    );
  }

  function handleYoutubeSubmit() {
    if (!youtubeUrl.trim()) return;
    submitAndClose(() =>
      fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "youtube", url: youtubeUrl.trim() }),
      }),
    );
  }

  function handlePasteSubmit() {
    if (!pasteTitle.trim() || !pasteText.trim()) return;
    submitAndClose(() =>
      fetch(`/api/notebooks/${notebookId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", title: pasteTitle.trim(), text: pasteText.trim() }),
      }),
    );
  }

  const activeTile = TILES.find((t) => t.mode === mode);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Add source
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back"
                onClick={() => setMode(null)}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {mode && activeTile ? `Add ${activeTile.label}` : "Add a source"}
          </DialogTitle>
        </DialogHeader>

        {!mode && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TILES.map(({ mode: m, label, icon: Icon }) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium",
                  "transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-7 text-primary" />
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "pdf" && (
          <FileForm
            accept=".pdf"
            hint="Click to choose a .pdf file"
            file={file}
            fileInputRef={fileInputRef}
            onFile={setFile}
            onSubmit={() => handleFileSubmit("pdf")}
            submitting={submitting}
          />
        )}

        {mode === "vtt" && (
          <FileForm
            accept=".vtt"
            hint="Click to choose a .vtt transcript file"
            file={file}
            fileInputRef={fileInputRef}
            onFile={setFile}
            onSubmit={() => handleFileSubmit("vtt")}
            submitting={submitting}
          />
        )}

        {mode === "url" && (
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={handleUrlSubmit} disabled={!url.trim() || submitting}>
              {submitting ? "Adding…" : "Add web link"}
            </Button>
          </div>
        )}

        {mode === "youtube" && (
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="https://www.youtube.com/watch?v=…"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <Button onClick={handleYoutubeSubmit} disabled={!youtubeUrl.trim() || submitting}>
              {submitting ? "Adding…" : "Add video"}
            </Button>
          </div>
        )}

        {mode === "text" && (
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Title"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
            <Textarea
              placeholder="Paste your text here…"
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteTitle.trim() || !pasteText.trim() || submitting}
            >
              {submitting ? "Adding…" : "Add text"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FileForm({
  accept,
  hint,
  file,
  fileInputRef,
  onFile,
  onSubmit,
  submitting,
}: {
  accept: string;
  hint: string;
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File | null) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor="source-file"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent"
      >
        <Upload className="size-6" />
        {file ? file.name : hint}
      </label>
      <input
        id="source-file"
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <Button onClick={onSubmit} disabled={!file || submitting}>
        {submitting ? "Uploading…" : "Upload"}
      </Button>
    </div>
  );
}
