import type { SourceType } from "@/lib/types";
import type { Chunk, ExtractResult, ExtractUnit } from "./types";

const TARGET_SIZE = 1100;
const OVERLAP_RATIO = 0.15;
const OVERLAP_SIZE = Math.round(TARGET_SIZE * OVERLAP_RATIO);

interface TextSpan {
  text: string;
  start: number;
  end: number;
}

/** Splits `text` into paragraph -> sentence spans, tracking char offsets. */
function splitIntoSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let cursor = 0;

  for (const para of paragraphs) {
    if (!para) continue;
    const start = text.indexOf(para, cursor);
    const end = start + para.length;
    cursor = end;

    if (para.length <= TARGET_SIZE) {
      spans.push({ text: para, start, end });
      continue;
    }

    const sentences = para.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [para];
    let sCursor = start;
    for (const sentence of sentences) {
      const sStart = text.indexOf(sentence, sCursor);
      const sEnd = sStart + sentence.length;
      spans.push({ text: sentence, start: sStart, end: sEnd });
      sCursor = sEnd;
    }
  }

  return spans;
}

/** Greedily merges spans into ~TARGET_SIZE chunks with char overlap. */
function mergeSpans(
  text: string,
  spans: TextSpan[],
): { content: string; charStart: number; charEnd: number }[] {
  const chunks: { content: string; charStart: number; charEnd: number }[] = [];
  let i = 0;

  while (i < spans.length) {
    let size = 0;
    let j = i;
    while (j < spans.length && (size === 0 || size + spans[j].text.length <= TARGET_SIZE)) {
      size += spans[j].text.length;
      j++;
    }
    const charStart = spans[i].start;
    const charEnd = spans[j - 1].end;
    const content = text.slice(charStart, charEnd).trim();
    if (content) chunks.push({ content, charStart, charEnd });

    if (j >= spans.length) break;

    let backSize = 0;
    let k = j - 1;
    while (k > i && backSize < OVERLAP_SIZE) {
      backSize += spans[k].text.length;
      k--;
    }
    i = Math.max(k, i + 1);
  }

  return chunks;
}

function chunkPlainText(units: ExtractUnit[]): Chunk[] {
  const text = units[0]?.text ?? "";
  const spans = splitIntoSpans(text);
  return mergeSpans(text, spans).map((piece, seq) => ({
    seq,
    content: piece.content,
    metadata: { charStart: piece.charStart, charEnd: piece.charEnd },
  }));
}

function chunkPdf(units: ExtractUnit[]): Chunk[] {
  const chunks: Chunk[] = [];
  let seq = 0;
  for (const unit of units) {
    const spans = splitIntoSpans(unit.text);
    for (const piece of mergeSpans(unit.text, spans)) {
      chunks.push({
        seq: seq++,
        content: piece.content,
        metadata: { page: unit.page, charStart: piece.charStart, charEnd: piece.charEnd },
      });
    }
  }
  return chunks;
}

function chunkTimed(units: ExtractUnit[]): Chunk[] {
  const chunks: Chunk[] = [];
  let seq = 0;
  let i = 0;

  while (i < units.length) {
    let size = 0;
    let j = i;
    const texts: string[] = [];
    while (
      j < units.length &&
      (size === 0 || size + units[j].text.length <= TARGET_SIZE)
    ) {
      texts.push(units[j].text);
      size += units[j].text.length;
      j++;
    }

    const content = texts.join(" ").trim();
    if (content) {
      chunks.push({
        seq: seq++,
        content,
        metadata: { startSec: units[i].startSec, endSec: units[j - 1].endSec },
      });
    }

    if (j >= units.length) break;

    let backSize = 0;
    let k = j - 1;
    while (k > i && backSize < OVERLAP_SIZE) {
      backSize += units[k].text.length;
      k--;
    }
    i = Math.max(k, i + 1);
  }

  return chunks;
}

export function chunkExtractResult(
  result: ExtractResult,
  sourceType: SourceType,
): Chunk[] {
  if (sourceType === "pdf") return chunkPdf(result.units);
  if (sourceType === "vtt" || sourceType === "youtube") return chunkTimed(result.units);
  return chunkPlainText(result.units);
}
