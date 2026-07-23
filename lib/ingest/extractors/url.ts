import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { ExtractResult } from "../types";

export async function extractUrl(url: string): Promise<ExtractResult> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const finalUrl = response.url || url;

  const dom = new JSDOM(html, { url: finalUrl });
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
