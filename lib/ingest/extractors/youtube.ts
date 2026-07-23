import type { ExtractResult, ExtractUnit } from "../types";
import { getYoutubeSession, invalidateYoutubeSession } from "../potoken";
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

  const { innertube } = await getYoutubeSession();
  const playlist = await innertube.getPlaylist(listId);

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

// Downloads the caption VTT for one video, signing the timedtext request with a
// PO token. Returns the raw VTT body (empty string if YouTube rejected the token).
async function fetchCaptionVtt(videoId: string): Promise<{ title: string; vtt: string }> {
  const { innertube, poToken } = await getYoutubeSession();
  const info = await innertube.getInfo(videoId);
  const title = info.basic_info.title ?? "YouTube video";

  const tracks = info.captions?.caption_tracks ?? [];
  if (tracks.length === 0) {
    throw new Error("This video has no caption tracks available");
  }
  const track =
    tracks.find((t) => t.language_code?.startsWith("en")) ?? tracks[0];

  // The pot + c=WEB params are what make YouTube return a non-empty body.
  const captionUrl = `${track.base_url}&fmt=vtt&c=WEB&pot=${poToken}`;
  const response = await fetch(captionUrl, {
    headers: { "User-Agent": BROWSER_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error("Failed to download captions for this video (YouTube returned an error)");
  }

  return { title, vtt: await response.text() };
}

export async function extractYoutube(url: string): Promise<ExtractResult> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Could not parse YouTube video ID from URL");

  let { title, vtt } = await fetchCaptionVtt(videoId);

  // An empty body means the PO token was rejected (usually expired). Re-mint once.
  if (!vtt.trim()) {
    invalidateYoutubeSession();
    ({ title, vtt } = await fetchCaptionVtt(videoId));
  }

  const cues = parseVtt(vtt);
  if (cues.length === 0) {
    throw new Error(
      "Could not extract captions for this video. It may have captions disabled, " +
        "or YouTube declined the request — try again in a moment.",
    );
  }

  const units: ExtractUnit[] = cues.map((c) => ({
    text: c.text,
    startSec: c.start,
    endSec: c.end,
  }));

  return { fullText: units.map((u) => u.text).join(" "), units, title };
}
