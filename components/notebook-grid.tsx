"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  MoreVertical,
  NotebookText,
  Trash2,
} from "lucide-react";
import { CreateNotebookDialog } from "@/components/create-notebook-dialog";
import { CreateLearningProjectDialog } from "@/components/create-learning-project-dialog";

export interface NotebookSummary {
  id: string;
  title: string;
  kind: string;
  createdAt: string | Date;
}

export function NotebookGrid({ notebooks }: { notebooks: NotebookSummary[] }) {
  const router = useRouter();
  const [items, setItems] = useState(notebooks);

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Learning is the headline feature, so it leads: a full-width prompt with
          the primary CTA, and "chat with your own files" as the quieter option. */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What do you want to learn?
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Name any topic and Curio builds you a roadmap of chapters, each
            taught by your own AI tutor. Or bring your own documents and ask
            them anything.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <CreateLearningProjectDialog />
          <CreateNotebookDialog />
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Your library</h2>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center text-muted-foreground">
            <NotebookText className="size-8" />
            <p>
              Nothing here yet — start a learning project above to get going.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((notebook) => (
              <Card key={notebook.id} className="group relative">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDelete(notebook.id)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link
                  href={
                    notebook.kind === "learning_project"
                      ? `/learn/${notebook.id}`
                      : `/notebook/${notebook.id}`
                  }
                >
                  <CardHeader>
                    <div className="flex items-center gap-2 pr-6">
                      {notebook.kind === "learning_project" ? (
                        <GraduationCap className="size-4 shrink-0 text-primary" />
                      ) : (
                        <NotebookText className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <CardTitle className="line-clamp-2">
                        {notebook.title}
                      </CardTitle>
                    </div>
                    <CardDescription>
                      {notebook.kind === "learning_project"
                        ? "Learning project"
                        : "Notebook"}{" "}
                      ·{" "}
                      {new Date(notebook.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          dateStyle: "medium",
                        },
                      )}
                    </CardDescription>
                  </CardHeader>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
