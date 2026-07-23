import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedChunk } from "@/lib/db/queries";

type Params = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const chunk = await getOwnedChunk(id, userId);
  return NextResponse.json({
    id: chunk.id,
    sourceId: chunk.sourceId,
    seq: chunk.seq,
    content: chunk.content,
    metadata: chunk.metadata,
    createdAt: chunk.createdAt,
  });
});
