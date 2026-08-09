import ffmpegPathImport from "ffmpeg-static";
import { Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import multer from "multer";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import type { TranscribeAudioResponse } from "@dashboard/shared";
import { getOpenAIClient } from "../lib/openaiClient.js";
import { multerErrorHandler } from "../lib/uploads.js";

// Same NodeNext/CJS default-export interop quirk documented in documents.ts (pptxgenjs).
const ffmpegPath = ffmpegPathImport as unknown as string | null;
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export const audioRouter = Router();

// Formats OpenAI's transcription API accepts natively - no conversion needed for these.
const NATIVELY_SUPPORTED_AUDIO_EXTENSIONS = new Set([
  "flac",
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "oga",
  "ogg",
  "wav",
  "webm",
]);

function getExtension(filename: string): string {
  return path.extname(filename).replace(".", "").toLowerCase();
}

// OpenAI's transcription API caps uploads at 25MB. We accept much larger raw
// recordings from the browser and transcode/compress them down to fit this first.
const OPENAI_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024;
// Generous ceiling on what the browser may upload - real meeting recordings (long,
// uncompressed) can be large; ffmpeg does the work of getting them under the API cap.
const UPLOAD_LIMIT_BYTES = 300 * 1024 * 1024;

async function transcodeAudio(inputBuffer: Buffer, inputExt: string, opts: { compress: boolean }): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = path.join(os.tmpdir(), `${id}-in.${inputExt || "bin"}`);
  const outputPath = path.join(os.tmpdir(), `${id}-out.mp3`);

  await fs.writeFile(inputPath, inputBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg(inputPath).audioCodec("libmp3lame").format("mp3");
      if (opts.compress) {
        // Mono, 16kHz, low bitrate - still clearly intelligible for speech transcription
        // (speech models downsample internally anyway) but shrinks large recordings a lot.
        command = command.audioChannels(1).audioFrequency(16000).audioBitrate("24k");
      }
      command
        .on("end", () => resolve())
        .on("error", (err) => reject(err instanceof Error ? err : new Error(String(err))))
        .save(outputPath);
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(inputPath, { force: true });
    await fs.rm(outputPath, { force: true });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMIT_BYTES },
});

audioRouter.post("/transcribe", upload.single("audio"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "An audio file is required." });
    return;
  }

  try {
    const openai = getOpenAIClient("audio transcription");
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe";

    const ext = getExtension(file.originalname) || "webm";
    const needsFormatConversion = !NATIVELY_SUPPORTED_AUDIO_EXTENSIONS.has(ext);
    const needsCompression = file.buffer.length > OPENAI_AUDIO_LIMIT_BYTES;

    let audioBuffer = file.buffer;
    let uploadFilename = `audio.${ext}`;
    if (needsFormatConversion || needsCompression) {
      audioBuffer = await transcodeAudio(file.buffer, ext, { compress: needsCompression });
      uploadFilename = "audio.mp3";

      if (audioBuffer.length > OPENAI_AUDIO_LIMIT_BYTES) {
        throw new Error(
          "This recording is too long to fit under OpenAI's 25MB transcription limit even after compression. Try trimming it or splitting it into shorter clips.",
        );
      }
    }

    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, uploadFilename),
      model,
      language: "id", // Bahasa Indonesia
    });

    const body: TranscribeAudioResponse = { transcript: transcription.text };
    res.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to transcribe audio.";
    console.error("Audio transcription failed:", message);
    res.status(502).json({ error: message });
  }
});

audioRouter.use(multerErrorHandler(`Audio file is too large (max ${UPLOAD_LIMIT_BYTES / (1024 * 1024)}MB).`));
