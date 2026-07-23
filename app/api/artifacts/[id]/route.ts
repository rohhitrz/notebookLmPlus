import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedArtifact } from "@/lib/db/queries";
import { getArtifactSignedUrl } from "@/lib/storage";
import type { ArtifactDetail } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const artifact = await getOwnedArtifact(id, userId);

  const url =
    artifact.status === "ready" && artifact.storagePath
      ? await getArtifactSignedUrl(artifact.storagePath)
      : null;

  const detail: ArtifactDetail = {
    id: artifact.id,
    notebookId: artifact.notebookId,
    type: artifact.type as ArtifactDetail["type"],
    status: artifact.status as ArtifactDetail["status"],
    errorMessage: artifact.errorMessage,
    metadata: artifact.metadata as ArtifactDetail["metadata"],
    url,
  };

  return NextResponse.json(detail);
});
