import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedSource } from "@/lib/db/queries";
import { getSignedUrl } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: Request, { params }: Params) => {
  const userId = await requireUser();
  const { id } = await params;
  const source = await getOwnedSource(id, userId);
  if (!source.origin) {
    return NextResponse.json({ error: "No file for this source" }, { status: 404 });
  }
  const url = await getSignedUrl(source.origin);
  return NextResponse.redirect(url);
});
