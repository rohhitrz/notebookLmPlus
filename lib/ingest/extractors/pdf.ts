import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import type { ExtractResult, ExtractUnit } from "../types";

export async function extractPdf(data: Uint8Array): Promise<ExtractResult> {
  const pdf = await getDocumentProxy(data);
  const { text } = await unpdfExtractText(pdf, { mergePages: false });

  const units: ExtractUnit[] = text.map((pageText, i) => ({
    text: pageText,
    page: i + 1,
  }));

  return { fullText: text.join("\n\n"), units };
}
