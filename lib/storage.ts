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

// Whether an object exists at `path` in the sources bucket — used to confirm a
// direct browser upload actually landed before we kick off processing.
export async function sourceFileExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const dir = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);
  const { data, error } = await supabase.storage
    .from(SOURCES_BUCKET)
    .list(dir, { search: name, limit: 1 });
  if (error) throw error;
  return (data ?? []).some((f) => f.name === name);
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

// A year — chapter illustrations are generated once and their URL is persisted
// into the chapter content, so the signed link must outlive a browsing session.
const LEARN_IMAGE_TTL_SECONDS = 60 * 60 * 24 * 365;

// Stores a generated chapter illustration and returns a long-lived signed URL.
// Reuses the private artifacts bucket under a "learn/" prefix.
export async function uploadLearnImage(path: string, file: Buffer): Promise<string> {
  const key = `learn/${path}`;
  const { error } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .upload(key, file, { contentType: "image/png", upsert: true });
  if (error) throw error;
  return getArtifactSignedUrl(key, LEARN_IMAGE_TTL_SECONDS);
}
