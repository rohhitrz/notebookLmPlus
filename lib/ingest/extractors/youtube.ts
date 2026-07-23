import { Innertube } from "youtubei.js";
import type { ExtractResult, ExtractUnit } from "../types";
import { parseVtt } from "./vtt";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractVideoId(url: string): string | null {
  const u = new URL(url);
  if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
  return u.searchParams.get("v");
}

export interface ResolvedYoutubeVideo {
  url: string;
  title?: string;
}

export async function resolveYoutubeUrls(
  url: string,
): Promise<ResolvedYoutubeVideo[]> {
  const u = new URL(url);
  const listId = u.searchParams.get("list");
  if (!listId) return [{ url }];

  const yt = await Innertube.create();
  const playlist = await yt.getPlaylist(listId);

  const videos: ResolvedYoutubeVideo[] = [];
  for (const item of playlist.items) {
    const id = (item as { id?: string }).id;
    if (!id) continue;
    const title = (item as { title?: { toString(): string } }).title?.toString();
    videos.push({ url: `https://www.youtube.com/watch?v=${id}`, title });
  }

  if (videos.length === 0) {
    throw new Error("Playlist has no videos");
  }
  return videos;
}

export async function extractYoutube(url: string): Promise<ExtractResult> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Could not parse YouTube video ID from URL");

  const yt = await Innertube.create();
  const info = await yt.getInfo(videoId);
  const title = info.basic_info.title;

  const tracks = info.captions?.caption_tracks ?? [];
  if (tracks.length === 0) {
    throw new Error("No captions available for this video");
  }
  const track = tracks.find((t) => t.language_code?.startsWith("en")) ?? tracks[0];

  const response = await fetch(`${track.base_url}&fmt=vtt`, {
    headers: { "User-Agent": BROWSER_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error("No captions available for this video");
  }

  const cues = parseVtt(await response.text());
  if (cues.length === 0) {
    throw new Error("No captions available for this video");
  }

  const units: ExtractUnit[] = cues.map((c) => ({
    text: c.text,
    startSec: c.start,
    endSec: c.end,
  }));

  return { fullText: units.map((u) => u.text).join(" "), units, title };
}
