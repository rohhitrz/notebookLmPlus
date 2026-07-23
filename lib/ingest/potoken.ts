import { BG } from "bgutils-js";
import { JSDOM } from "jsdom";
import { Innertube } from "youtubei.js";

// YouTube now hard-requires a "proof of origin" (PO) token on caption/timedtext
// downloads. Without one, the timedtext endpoint returns HTTP 200 with an EMPTY
// body for every video, so captions can never be extracted. We mint a PO token
// locally with BotGuard (bgutils-js), then build an Innertube session bound to
// it. See extractYoutube in ./extractors/youtube.ts for how the token is used.

// Public YouTube BotGuard request key (stable, not a secret — it is shipped in
// YouTube's own web client).
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

// Tokens stay valid for several hours; refresh well before that. Minting takes a
// few seconds (it runs the BotGuard VM), so we cache the whole session.
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

export interface YoutubeSession {
  innertube: Innertube;
  poToken: string;
  createdAt: number;
}

let cached: YoutubeSession | null = null;
let inflight: Promise<YoutubeSession> | null = null;

// bgutils' BotGuard interpreter references `window`/`document`. We provide them
// via jsdom only for the duration of token generation, then restore the real
// globals so the rest of the Node process doesn't start believing it's a browser
// (which would break Next.js server rendering elsewhere in the same process).
async function generatePoToken(visitorData: string): Promise<string> {
  const dom = new JSDOM();
  const g = globalThis as unknown as Record<string, unknown>;
  const hadWindow = "window" in g;
  const hadDocument = "document" in g;
  const prevWindow = g.window;
  const prevDocument = g.document;
  g.window = dom.window;
  g.document = dom.window.document;

  try {
    const bgConfig = {
      fetch: (input: unknown, init?: unknown) =>
        fetch(input as RequestInfo, init as RequestInit),
      globalObj: globalThis,
      requestKey: REQUEST_KEY,
      identifier: visitorData,
    };

    const challenge = await BG.Challenge.create(bgConfig);
    if (!challenge) throw new Error("Could not create BotGuard challenge");

    const interpreter =
      challenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
    if (interpreter) new Function(interpreter)();

    const { poToken } = await BG.PoToken.generate({
      program: challenge.program,
      globalName: challenge.globalName,
      bgConfig,
    });
    if (!poToken) throw new Error("BotGuard returned an empty PO token");
    return poToken;
  } finally {
    if (hadWindow) g.window = prevWindow;
    else delete g.window;
    if (hadDocument) g.document = prevDocument;
    else delete g.document;
  }
}

async function mintSession(): Promise<YoutubeSession> {
  // A lightweight session just to obtain visitor data to bind the token to.
  const seed = await Innertube.create({ retrieve_player: false });
  const visitorData = seed.session.context.client.visitorData;
  if (!visitorData) throw new Error("Could not obtain YouTube visitor data");

  const poToken = await generatePoToken(visitorData);

  const innertube = await Innertube.create({
    po_token: poToken,
    visitor_data: visitorData,
    generate_session_locally: true,
  });

  return { innertube, poToken, createdAt: Date.now() };
}

/**
 * Returns a cached, PO-token-bound Innertube session, minting a fresh one when
 * absent or expired. Concurrent callers share a single in-flight mint.
 */
export async function getYoutubeSession(): Promise<YoutubeSession> {
  if (cached && Date.now() - cached.createdAt < SESSION_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = mintSession()
    .then((session) => {
      cached = session;
      return session;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Drops the cached session so the next call re-mints (used after a stale-token miss). */
export function invalidateYoutubeSession(): void {
  cached = null;
}
