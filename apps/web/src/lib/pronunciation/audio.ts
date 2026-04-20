import { promises as fs } from "node:fs";
import { constants as fsConstants } from "node:fs";
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

function inferDownloadedAudioExtension(
  recordingUrl: string,
  contentType: string,
): string {
  const normalizedContentType = contentType.toLowerCase();
  const normalizedUrl = recordingUrl.split("?")[0].toLowerCase();

  if (normalizedContentType.includes("wav") || normalizedUrl.endsWith(".wav")) {
    return ".wav";
  }

  if (
    normalizedContentType.includes("audio/x-caf") ||
    normalizedContentType.includes("audio/caf") ||
    normalizedUrl.endsWith(".caf")
  ) {
    return ".caf";
  }

  return ".m4a";
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
  const extension = inferDownloadedAudioExtension(recordingUrl, contentType);
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

// @MX:NOTE: ffmpeg-static returns path.join(__dirname, 'ffmpeg'). On Vercel
//           serverless, outputFileTracingIncludes copies the binary but
//           __dirname in the bundled code often does not resolve to
//           node_modules/ffmpeg-static. We probe several candidate paths
//           and repair the exec bit if the binary lost it in transit.
async function resolveFfmpegBinary(): Promise<string> {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const add = (candidate: string | null | undefined): void => {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  };

  add(process.env.FFMPEG_BIN);
  // apps/web/bin/ffmpeg — copied at build time by scripts/copy-ffmpeg.mjs.
  // Primary path on Vercel because outputFileTracingIncludes bundles this.
  add(path.join(process.cwd(), "bin/ffmpeg"));
  add(ffmpegPath);

  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    add(path.join(current, "node_modules/ffmpeg-static/ffmpeg"));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const attempts: Array<{ path: string; result: string }> = [];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.F_OK);
    } catch {
      attempts.push({ path: candidate, result: "not_found" });
      continue;
    }
    try {
      await fs.access(candidate, fsConstants.X_OK);
      attempts.push({ path: candidate, result: "ok" });
      return candidate;
    } catch {
      try {
        await fs.chmod(candidate, 0o755);
        await fs.access(candidate, fsConstants.X_OK);
        attempts.push({ path: candidate, result: "repaired_chmod" });
        return candidate;
      } catch (chmodErr) {
        attempts.push({
          path: candidate,
          result: `exists_not_exec: ${chmodErr instanceof Error ? chmodErr.message : "unknown"}`,
        });
      }
    }
  }

  console.error("[ensureWavInput] ffmpeg binary not resolvable", {
    cwd: process.cwd(),
    platform: process.platform,
    arch: process.arch,
    ffmpegPathFromModule: ffmpegPath,
    attempts,
  });

  throw new PronunciationAudioError(
    `FFmpeg binary not found. Tried: ${attempts.map((a) => `${a.path} (${a.result})`).join("; ")}`,
    "MISSING_TRANSCODER",
  );
}

// @MX:ANCHOR: Always transcode the incoming recording to canonical
//             16kHz / mono / PCM_S16LE WAV before handing to Azure.
// @MX:REASON: iOS expo-av with outputFormat=lpcm and extension=.wav does
//             NOT emit a RIFF-compliant header; Azure SDK's
//             fromWavFileInput then throws "offset is outside the bounds
//             of the dataview" while parsing. Transcoding through ffmpeg
//             always produces a proper RIFF WAV and normalizes sample
//             rate/channels/bit depth to exactly what the Azure
//             pronunciation assessment expects.
export async function ensureWavInput(inputPath: string): Promise<string> {
  const transcoderPath = await resolveFfmpegBinary();

  // Distinct output path to avoid overwriting the input (which may itself
  // be a .wav that ffmpeg is still reading).
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const wavPath = path.join(dir, `${base}.normalized.wav`);

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
