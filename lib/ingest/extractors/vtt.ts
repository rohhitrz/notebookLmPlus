import type { ExtractResult, ExtractUnit } from "../types";

export interface VttCue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(raw: string): number {
  const parts = raw.trim().replace(",", ".").split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  return Number(parts[0]);
}

export function parseVtt(content: string): VttCue[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const cues: VttCue[] = [];
  let i = 0;

  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.includes("-->")) {
      i++;
      continue;
    }
    const [startStr, rest] = line.split("-->");
    const endStr = rest.trim().split(/\s+/)[0];
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    i++;

    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }
    const text = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) cues.push({ start, end, text });
  }

  return cues;
}

export async function extractVtt(content: string): Promise<ExtractResult> {
  const cues = parseVtt(content);
  if (cues.length === 0) throw new Error("No cues found in VTT file");

  const units: ExtractUnit[] = cues.map((c) => ({
    text: c.text,
    startSec: c.start,
    endSec: c.end,
  }));

  return { fullText: cues.map((c) => c.text).join(" "), units };
}
