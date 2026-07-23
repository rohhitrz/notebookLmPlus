import type { ExtractResult } from "../types";

export async function extractText(text: string): Promise<ExtractResult> {
  return { fullText: text, units: [{ text }] };
}
