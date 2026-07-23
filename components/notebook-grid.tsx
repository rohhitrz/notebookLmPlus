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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, NotebookText, Trash2 } from "lucide-react";
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your notebooks</h1>
        <div className="flex items-center gap-2">
          <CreateLearningProjectDialog />
          <CreateNotebookDialog />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center text-muted-foreground">
          <NotebookText className="size-8" />
          <p>No notebooks yet. Create one to get started.</p>
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
                    <CardTitle className="line-clamp-2">{notebook.title}</CardTitle>
                    {notebook.kind === "learning_project" && (
                      <Badge variant="secondary" className="shrink-0">
                        Learning
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {new Date(notebook.createdAt).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
