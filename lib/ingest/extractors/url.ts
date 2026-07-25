import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { safeFetchText } from "@/lib/net/safe-fetch";
import type { ExtractResult } from "../types";

export async function extractUrl(url: string): Promise<ExtractResult> {
  // safeFetchText enforces http(s)-only, blocks private/reserved addresses, and
  // re-validates every redirect hop — this URL is user-supplied.
  const { body: html, finalUrl } = await safeFetchText(url);

  // Readability needs a DOM, but JSDOM must not execute page scripts or load
  // subresources — that would give a hostile page a foothold on our server.
  const dom = new JSDOM(html, { url: finalUrl, runScripts: "outside-only" });
  const article = new Readability(dom.window.document).parse();
  if (!article?.textContent?.trim()) {
    throw new Error("Could not extract readable content from URL");
  }

  const fullText = article.textContent.trim();
  return {
    fullText,
    units: [{ text: fullText }],
    title: article.title?.trim() || undefined,
    finalUrl,
  };
}
