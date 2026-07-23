import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

const SOURCES_BUCKET = "sources";

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
