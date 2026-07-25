import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Guards server-side fetches of user-supplied URLs against SSRF. Without this, a
// signed-in user could add a "url" source pointing at cloud metadata
// (169.254.169.254), localhost, or a private-network host; the server would fetch
// it and store the body as a chunk they can then read back through chat.
//
// Defences: scheme allowlist, DNS resolution checked against private/reserved IP
// ranges (so a public hostname can't resolve inward), every redirect hop
// re-validated, plus response size and time caps.

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

function ipv4IsBlocked(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // unparseable — refuse rather than guess
  }
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

function ipv6IsBlocked(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id

  if (addr === "::1" || addr === "::") return true; // loopback / unspecified

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible forms: judge the IPv4 part.
  const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsBlocked(mapped[1]);

  const head = addr.split(":")[0];
  const leading = parseInt(head, 16);
  if (Number.isNaN(leading)) return true;

  if ((leading & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((leading & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((leading & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

function ipIsBlocked(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4IsBlocked(ip);
  if (version === 6) return ipv6IsBlocked(ip);
  return true;
}

/**
 * Validates one URL: http(s) only, and every address its hostname resolves to
 * must be publicly routable. Returns the parsed URL.
 */
async function assertUrlAllowed(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http and https URLs can be added as sources.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // unwrap [::1]

  // A literal IP needs no DNS lookup.
  if (isIP(host)) {
    if (ipIsBlocked(host)) {
      throw new BlockedUrlError("That URL points to a private or reserved address.");
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("Could not resolve that hostname.");
  }

  if (addresses.length === 0 || addresses.some((a) => ipIsBlocked(a.address))) {
    throw new BlockedUrlError("That URL points to a private or reserved address.");
  }

  return url;
}

export interface SafeFetchResult {
  body: string;
  finalUrl: string;
  contentType: string | null;
}

/**
 * Fetches a user-supplied URL with SSRF protection, following redirects manually
 * so each hop is validated (a public URL must not be able to 302 into a private
 * network). Reads at most MAX_RESPONSE_BYTES.
 */
export async function safeFetchText(rawUrl: string): Promise<SafeFetchResult> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertUrlAllowed(current);

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new BlockedUrlError(`Fetching that URL failed: ${response.status} redirect with no target.`);
      }
      current = new URL(location, url).toString(); // re-validated next iteration
      continue;
    }

    if (!response.ok) {
      throw new BlockedUrlError(
        `Failed to fetch URL: ${response.status} ${response.statusText}`,
      );
    }

    const declared = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      throw new BlockedUrlError("That page is too large to import.");
    }

    return {
      body: await readCapped(response),
      finalUrl: response.url || url.toString(),
      contentType: response.headers.get("content-type"),
    };
  }

  throw new BlockedUrlError("That URL redirected too many times.");
}

// Streams the body, aborting past the cap so a server that lies about (or omits)
// content-length can't exhaust memory.
async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new BlockedUrlError("That page is too large to import.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
