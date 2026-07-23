"use client";

import { useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SourceListItem } from "@/lib/types";

interface AddSourceDialogProps {
  notebookId: string;
  onAdded: (items: SourceListItem[]) => void;
}

function extToType(filename: string): "pdf" | "text" | "vtt" | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "text";
  if (ext === "vtt") return "vtt";
  return null;
}

export function AddSourceDialog({ notebookId, onAdded }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
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
      resetForm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setSubmitting(false);
    }
  }

  function handleUploadSubmit() {
    if (!file) return;
    const type = extToType(file.name);
    if (!type) {
      toast.error("Only .pdf, .txt, and .vtt files are supported");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Add source
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="flex flex-col gap-3">
            <label
              htmlFor="source-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted"
            >
              <Upload className="size-6" />
              {file ? file.name : "Click to choose a .pdf, .txt, or .vtt file"}
            </label>
            <input
              id="source-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.vtt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button onClick={handleUploadSubmit} disabled={!file || submitting}>
              {submitting ? "Uploading…" : "Upload"}
            </Button>
          </TabsContent>

          <TabsContent value="url" className="flex flex-col gap-3">
            <Input
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={handleUrlSubmit} disabled={!url.trim() || submitting}>
              {submitting ? "Adding…" : "Add URL"}
            </Button>
          </TabsContent>

          <TabsContent value="youtube" className="flex flex-col gap-3">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <Button onClick={handleYoutubeSubmit} disabled={!youtubeUrl.trim() || submitting}>
              {submitting ? "Adding…" : "Add video"}
            </Button>
          </TabsContent>

          <TabsContent value="paste" className="flex flex-col gap-3">
            <Input
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
