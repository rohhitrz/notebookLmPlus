import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

const SOURCES_BUCKET = "sources";
const ARTIFACTS_BUCKET = "artifacts";

export async function uploadSourceFile(
  path: string,
  file: Blob,
  contentType?: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(SOURCES_BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
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
