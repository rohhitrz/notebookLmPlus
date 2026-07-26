"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { DIFFICULTY_LEVELS, type DifficultyLevel, type ScopeResult } from "@/lib/types";

const LEVEL_LABELS: Record<DifficultyLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type Phase = "form" | "scoping" | "options" | "creating";

export function CreateLearningProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<DifficultyLevel>("beginner");
  const [phase, setPhase] = useState<Phase>("form");
  const [scope, setScope] = useState<ScopeResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const busy = phase === "scoping" || phase === "creating";

  function reset() {
    setTitle("");
    setGoal("");
    setLevel("beginner");
    setPhase("form");
    setScope(null);
    setSelected(new Set());
  }

  function handleOpenChange(next: boolean) {
    if (busy) return; // don't let the dialog close mid-flight
    setOpen(next);
    if (!next) reset();
  }

  // Creates the notebook + roadmap for a finalized goal, then opens it.
  async function build(finalGoal: string) {
    setPhase("creating");
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind: "learning_project" }),
      });
      if (!res.ok) throw new Error("Failed to create learning project");
      const notebook = await res.json();

      const roadmapRes = await fetch("/api/learn/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId: notebook.id, goal: finalGoal, level }),
      });
      if (!roadmapRes.ok) throw new Error("Failed to build your roadmap");

      router.push(`/learn/${notebook.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setPhase(scope ? "options" : "form");
    }
  }

  // Step 1: check whether the goal is focused enough before we build anything.
  async function handleStart() {
    if (!title.trim() || !goal.trim()) return;
    setPhase("scoping");
    try {
      const res = await fetch("/api/learn/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), level }),
      });
      if (!res.ok) throw new Error("Couldn't check your goal — try again.");
      const result = (await res.json()) as ScopeResult;

      if (result.broad && result.options.length > 0) {
        setScope(result);
        setSelected(new Set());
        setPhase("options");
      } else {
        await build(goal.trim());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setPhase("form");
    }
  }

  function toggleOption(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function buildFromSelection() {
    if (!scope || selected.size === 0) return;
    const chosen = [...selected].sort((a, b) => a - b).map((i) => scope.options[i].refinedGoal);
    build(chosen.join("; "));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="lg" className="shadow-sm">
            <GraduationCap className="size-4" />
            Start learning
          </Button>
        }
      />
      <DialogContent>
        {scope && (phase === "options" || phase === "creating") ? (
          <>
            <DialogHeader>
              <DialogTitle>Let&apos;s narrow this down</DialogTitle>
              <DialogDescription>{scope.clarifyingQuestion}</DialogDescription>
            </DialogHeader>

            {/* Only this list scrolls (capped at 45vh), so no matter how many
                options come back the dialog stays within the viewport and the
                footer keeps its flush-to-bottom bar styling. */}
            <div className="-mr-2 flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-2">
              {scope.options.map((opt, i) => {
                const isOn = selected.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleOption(i)}
                    className={cn(
                      "flex shrink-0 flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
                      isOn
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                        : "hover:border-foreground/30 hover:bg-muted/50",
                    )}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.refinedGoal}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              These are narrower slices of your topic. Tap the ones you want for a focused
              roadmap — or skip to cover your whole topic broadly.
            </p>

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => setPhase("form")} disabled={busy}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => build(goal.trim())} disabled={busy}>
                  Skip, cover it all
                </Button>
                <Button onClick={buildFromSelection} disabled={busy || selected.size === 0}>
                  {phase === "creating" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {selected.size === 0
                    ? "Pick an area"
                    : `Build roadmap${selected.size > 1 ? ` · ${selected.size}` : ""}`}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <>
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
              disabled={busy}
            />
            <Textarea
              placeholder="What do you want to learn? (e.g. “the fundamentals of macroeconomics”)"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              disabled={busy}
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Your current level</span>
              <div className="flex gap-1.5">
                {DIFFICULTY_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    disabled={busy}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                      level === lvl
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {LEVEL_LABELS[lvl]}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleStart} disabled={!title.trim() || !goal.trim() || busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {phase === "scoping"
                  ? "Checking your goal…"
                  : phase === "creating"
                    ? "Building your roadmap…"
                    : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
