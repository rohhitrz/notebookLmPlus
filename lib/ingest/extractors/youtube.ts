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

interface VideoData {
  title: string;
  description: string;
  vtt: string;
  hasCaptions: boolean;
}

// Fetches a video's title, description, and (if available) caption VTT. The
// timedtext request is signed with a PO token. `vtt` is "" when YouTube rejects
// the token or the video has no captions.
async function fetchVideoData(videoId: string): Promise<VideoData> {
  const { innertube, poToken } = await getYoutubeSession();
  const info = await innertube.getInfo(videoId);
  const title = info.basic_info.title ?? "YouTube video";
  const description = info.basic_info.short_description ?? "";

  const tracks = info.captions?.caption_tracks ?? [];
  if (tracks.length === 0) {
    // No captions — the caller still indexes the title + description.
    return { title, description, vtt: "", hasCaptions: false };
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

  return { title, description, vtt: await response.text(), hasCaptions: true };
}

export async function extractYoutube(url: string): Promise<ExtractResult> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Could not parse YouTube video ID from URL");

  let data = await fetchVideoData(videoId);

  // Tracks exist but an empty body means the PO token was rejected (usually
  // expired) — re-mint once and retry.
  if (data.hasCaptions && !data.vtt.trim()) {
    invalidateYoutubeSession();
    data = await fetchVideoData(videoId);
  }

  const captionUnits: ExtractUnit[] = parseVtt(data.vtt).map((c) => ({
    text: c.text,
    startSec: c.start,
    endSec: c.end,
  }));

  // Index the title + description first. It's often richer than the captions and
  // frequently in a different language, so it answers metadata questions the
  // (possibly non-English) transcript can't. It anchors to the video start (t=0).
  const header = [data.title, data.description]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");
  const headerUnit: ExtractUnit[] = header ? [{ text: header, startSec: 0, endSec: 0 }] : [];

  const units = [...headerUnit, ...captionUnits];
  if (units.length === 0) {
    throw new Error(
      "Could not extract anything from this video — it has no captions or description available.",
    );
  }

  const fullText = [header, ...captionUnits.map((u) => u.text)].filter(Boolean).join(" ");
  return { fullText, units, title: data.title };
}
