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
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [{ url }];
  }

  const listId = u.searchParams.get("list");
  const hasVideoId = !!extractVideoId(url);

  // A plain video link (including a video that merely carries a &list= param)
  // needs no lookup at all — just index that video.
  if (!listId || hasVideoId) return [{ url }];

  // Expanding a playlist needs an Innertube session, which mints a PO token via
  // BotGuard. That is slow and can fail outright in a serverless environment, so
  // it must never take down the request: fall back to adding the URL as-is and
  // let the extractor report any problem as a per-source error instead of a 500.
  try {
    const { innertube } = await getYoutubeSession();
    const playlist = await innertube.getPlaylist(listId);

    const videos: ResolvedYoutubeVideo[] = [];
    for (const item of playlist.items) {
      const id = (item as { id?: string }).id;
      if (!id) continue;
      const title = (item as { title?: { toString(): string } }).title?.toString();
      videos.push({ url: `https://www.youtube.com/watch?v=${id}`, title });
    }

    return videos.length > 0 ? videos : [{ url }];
  } catch (err) {
    console.error("[youtube] playlist expansion failed; adding URL as-is", err);
    return [{ url }];
  }
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
  // Minting a PO token runs BotGuard through jsdom, which can fail in a
  // serverless environment. That must not cost us the whole video: without a
  // token we can still read title/description via a plain session and index
  // those, we just can't download captions.
  let innertube: Awaited<ReturnType<typeof getYoutubeSession>>["innertube"];
  let poToken: string | null = null;
  try {
    const session = await getYoutubeSession();
    innertube = session.innertube;
    poToken = session.poToken;
  } catch (err) {
    console.error("[youtube] PO token unavailable; indexing metadata only", err);
    const { Innertube } = await import("youtubei.js");
    innertube = await Innertube.create({ retrieve_player: false });
  }

  const info = await innertube.getInfo(videoId);
  const title = info.basic_info.title ?? "YouTube video";
  const description = info.basic_info.short_description ?? "";

  const tracks = info.captions?.caption_tracks ?? [];
  if (tracks.length === 0 || !poToken) {
    // No captions available (or no token to fetch them) — the caller still
    // indexes the title + description.
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
  if (!videoId) {
    // Usually a playlist link whose expansion couldn't be reached. Say what to
    // do rather than reporting a parser detail.
    throw new Error(
      "This YouTube link has no video in it — paste a single video link (youtube.com/watch?v=… or youtu.be/…).",
    );
  }

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
