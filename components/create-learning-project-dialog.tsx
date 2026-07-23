"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CreateLearningProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!title.trim() || !goal.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind: "learning_project" }),
      });
      if (!res.ok) throw new Error("Failed to create learning project");
      const notebook = await res.json();

      await fetch("/api/learn/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId: notebook.id, goal: goal.trim() }),
      });

      setOpen(false);
      setTitle("");
      setGoal("");
      router.push(`/learn/${notebook.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <GraduationCap className="size-4" />
            New learning project
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a learning project</DialogTitle>
          <DialogDescription>
            Tell us your goal — we&apos;ll build a roadmap. You can add sources now or later.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Project title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          placeholder="What do you want to learn?"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!title.trim() || !goal.trim() || submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
