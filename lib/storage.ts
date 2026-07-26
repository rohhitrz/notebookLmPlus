import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

const SOURCES_BUCKET = "sources";
const ARTIFACTS_BUCKET = "artifacts";

// One-time signed URL that lets the browser upload a source file straight to
// Storage, bypassing the serverless function's request-body limit (4.5 MB on
// Vercel). The returned token authorizes a write to exactly this path.
export async function createSourceUploadUrl(
  path: string,
): Promise<{ path: string; token: string }> {
  const { data, error } = await supabase.storage
    .from(SOURCES_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

export async function downloadSourceFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(SOURCES_BUCKET).download(path);
  if (error) throw error;
  return data.arrayBuffer();
}

export async function deleteSourceFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SOURCES_BUCKET).remove([path]);
  if (error) throw error;
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SOURCES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadArtifactFile(
  path: string,
  file: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
}

export async function getArtifactSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
