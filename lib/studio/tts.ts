import { randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
import pLimit from "p-limit";
import type { PodcastScriptTurn } from "@/lib/types";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const ttsConcurrency = pLimit(3);

const VOICE_BY_SPEAKER: Record<PodcastScriptTurn["speaker"], string> = {
  HOST_A: "onyx",
  HOST_B: "nova",
};

async function synthesizeTurn(turn: PodcastScriptTurn): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL!,
    voice: VOICE_BY_SPEAKER[turn.speaker],
    input: turn.text,
    response_format: "mp3",
  });
  return Buffer.from(await response.arrayBuffer());
}

async function concatMp3(buffers: Buffer[]): Promise<Buffer> {
  const dir = tmpdir();
  const id = randomUUID();
  const inputPaths = await Promise.all(
    buffers.map(async (buf, i) => {
      const p = path.join(dir, `${id}-${i}.mp3`);
      await writeFile(p, buf);
      return p;
    }),
  );
  const listPath = path.join(dir, `${id}-list.txt`);
  await writeFile(listPath, inputPaths.map((p) => `file '${p}'`).join("\n"));
  const outputPath = path.join(dir, `${id}-out.mp3`);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy"])
        .save(outputPath)
        .on("end", () => resolve())
        .on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await Promise.all([...inputPaths, listPath, outputPath].map((p) => unlink(p).catch(() => {})));
  }
}

export async function generateSpeech(script: PodcastScriptTurn[]): Promise<Buffer> {
  const turnBuffers = await Promise.all(
    script.map((turn) => ttsConcurrency(() => synthesizeTurn(turn))),
  );
  if (turnBuffers.length === 1) return turnBuffers[0];
  return concatMp3(turnBuffers);
}
