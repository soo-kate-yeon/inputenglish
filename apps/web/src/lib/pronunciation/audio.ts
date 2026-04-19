import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export class PronunciationAudioError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DOWNLOAD_FAILED"
      | "TRANSCODE_FAILED"
      | "UNSUPPORTED_AUDIO"
      | "MISSING_TRANSCODER",
  ) {
    super(message);
    this.name = "PronunciationAudioError";
  }
}

async function writeBufferToTempFile(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "inputenglish-pronunciation-"),
  );
  const filePath = path.join(tempDir, `${randomUUID()}${extension}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function downloadRecordingToTempFile(
  recordingUrl: string,
): Promise<{ inputPath: string; cleanup: () => Promise<void> }> {
  const response = await fetch(recordingUrl);
  if (!response.ok) {
    throw new PronunciationAudioError(
      `Failed to download recording (${response.status})`,
      "DOWNLOAD_FAILED",
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const extension = contentType.includes("wav") ? ".wav" : ".m4a";
  const inputPath = await writeBufferToTempFile(
    Buffer.from(arrayBuffer),
    extension,
  );

  return {
    inputPath,
    cleanup: async () => {
      await fs.rm(path.dirname(inputPath), { recursive: true, force: true });
    },
  };
}

export async function ensureWavInput(inputPath: string): Promise<string> {
  if (inputPath.endsWith(".wav")) {
    return inputPath;
  }

  if (!ffmpegPath) {
    throw new PronunciationAudioError(
      "FFmpeg binary is not available for audio transcoding",
      "MISSING_TRANSCODER",
    );
  }
  const transcoderPath = ffmpegPath;

  const wavPath = inputPath.replace(/\.[^.]+$/, ".wav");

  await new Promise<void>((resolve, reject) => {
    execFile(
      transcoderPath,
      [
        "-y",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-acodec",
        "pcm_s16le",
        wavPath,
      ],
      (error: ExecFileException | null, _stdout: string, stderr: string) => {
        if (!error) {
          resolve();
          return;
        }

        reject(
          new PronunciationAudioError(
            stderr?.trim() || error.message || "Failed to transcode recording",
            "TRANSCODE_FAILED",
          ),
        );
      },
    );
  });

  return wavPath;
}
