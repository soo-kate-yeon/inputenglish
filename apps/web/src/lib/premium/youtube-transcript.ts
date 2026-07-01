import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { YoutubeTranscript } from "@danielxceron/youtube-transcript";
import { premiumTranscriptLineSchema } from "@/lib/premium/session-schema";

const execFileAsync = promisify(execFile);

export interface YtDlpCaptionTrack {
  ext?: string;
  url?: string;
}

export interface YtDlpMetadata {
  duration?: number;
  title?: string;
  channel?: string;
  uploader?: string;
  thumbnail?: string;
  subtitles?: Record<string, YtDlpCaptionTrack[]>;
  automatic_captions?: Record<string, YtDlpCaptionTrack[]>;
}

export interface Json3CaptionEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
}

type ExecFileAsync = (
  file: string,
  args: string[],
  options: { maxBuffer: number; cwd?: string },
) => Promise<{ stdout: string | Buffer }>;

const YT_DLP_ARGS = ["--dump-single-json", "--skip-download"] as const;
const YT_DLP_MAX_BUFFER = 1024 * 1024 * 8;
type PremiumLoadedTranscript = ReturnType<typeof parseJson3Transcript>;

export function parseJson3Transcript(payload: {
  events?: Json3CaptionEvent[];
}) {
  return premiumTranscriptLineSchema.array().parse(
    (payload.events ?? [])
      .map((event, index) => {
        const text = (event.segs ?? [])
          .map((segment) => segment.utf8 ?? "")
          .join("")
          .replace(/\s+/g, " ")
          .trim();
        if (!text) return null;
        const startTime = (event.tStartMs ?? 0) / 1000;
        const endTime =
          startTime + Math.max(0.5, (event.dDurationMs ?? 2000) / 1000);
        return {
          id: `yt-${index + 1}`,
          text,
          startTime,
          endTime,
        };
      })
      .filter(Boolean),
  );
}

function parseVttTimestamp(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  const secondsPart = parts.pop();
  if (!secondsPart) return null;

  const seconds = Number(secondsPart);
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);
  if (![seconds, minutes, hours].every(Number.isFinite)) return null;

  return hours * 3600 + minutes * 60 + seconds;
}

function cleanCaptionText(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVttTranscript(payload: string) {
  const lines = payload.replace(/\r/g, "").split("\n");
  const cues: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.includes("-->")) continue;

    const [rawStart, rawEndWithSettings] = line.split("-->");
    const rawEnd = rawEndWithSettings?.trim().split(/\s+/)[0];
    const startTime = parseVttTimestamp(rawStart ?? "");
    const endTime = parseVttTimestamp(rawEnd ?? "");
    if (startTime === null || endTime === null || endTime <= startTime) {
      continue;
    }

    const textLines: string[] = [];
    let textIndex = index + 1;
    while (textIndex < lines.length && lines[textIndex].trim()) {
      const textLine = cleanCaptionText(lines[textIndex]);
      if (textLine && !/^\d+$/.test(textLine)) {
        textLines.push(textLine);
      }
      textIndex += 1;
    }
    index = textIndex;

    const text = cleanCaptionText(textLines.join(" "));
    if (!text) continue;
    cues.push({ text, startTime, endTime });
  }

  return premiumTranscriptLineSchema.array().parse(
    cues.map((cue, index) => ({
      id: `yt-${index + 1}`,
      text: cue.text,
      startTime: cue.startTime,
      endTime: cue.endTime,
    })),
  );
}

function getEnglishTracks(
  tracksByLanguage?: Record<string, YtDlpCaptionTrack[]>,
) {
  return Object.entries(tracksByLanguage ?? {})
    .filter(([language]) => {
      const normalized = language.toLowerCase();
      return (
        normalized === "en" ||
        normalized.startsWith("en-") ||
        normalized.endsWith(".en")
      );
    })
    .flatMap(([, tracks]) => tracks);
}

function getYtDlpCommands() {
  return [
    process.env.YT_DLP_PATH,
    "yt-dlp",
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
  ].filter((command, index, commands): command is string =>
    Boolean(command && commands.indexOf(command) === index),
  );
}

function isMissingCommandError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function formatExecError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "unknown yt-dlp error";
}

async function loadYtDlpMetadata(
  sourceUrl: string,
  runExecFile: ExecFileAsync,
) {
  let lastError: unknown = null;
  for (const command of getYtDlpCommands()) {
    try {
      const { stdout } = await runExecFile(
        command,
        [...YT_DLP_ARGS, sourceUrl],
        { maxBuffer: YT_DLP_MAX_BUFFER },
      );
      return JSON.parse(String(stdout)) as YtDlpMetadata;
    } catch (error) {
      lastError = error;
      if (isMissingCommandError(error)) continue;
      throw new Error(`yt-dlp failed: ${formatExecError(error)}`);
    }
  }
  throw new Error(
    `yt-dlp command was not found: ${formatExecError(lastError)}`,
  );
}

function parseCaptionPayload(
  payload: string,
  format?: string,
  contentType = "",
): PremiumLoadedTranscript {
  if (format === "json3" || contentType.includes("json")) {
    try {
      return parseJson3Transcript(JSON.parse(payload));
    } catch {
      return parseVttTranscript(payload);
    }
  }
  return parseVttTranscript(payload);
}

async function fetchCaptionTrack(
  track: YtDlpCaptionTrack,
  runFetch: typeof fetch,
) {
  if (!track.url) {
    throw new Error("caption track has no URL");
  }
  const response = await runFetch(track.url);
  if (!response.ok) {
    throw new Error(`failed to fetch subtitle track: ${response.status}`);
  }
  const contentType = response.headers?.get?.("content-type") ?? "";
  return parseCaptionPayload(await response.text(), track.ext, contentType);
}

async function downloadSubtitleWithYtDlp(
  sourceUrl: string,
  runExecFile: ExecFileAsync,
) {
  const subtitleDir = await mkdtemp(join(tmpdir(), "inputenglish-subs-"));
  try {
    let lastError: unknown = null;
    for (const command of getYtDlpCommands()) {
      try {
        await runExecFile(
          command,
          [
            "--skip-download",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs",
            "en,en-US,en-GB,en.*",
            "--sub-format",
            "json3/vtt",
            "-o",
            "%(id)s.%(ext)s",
            sourceUrl,
          ],
          { cwd: subtitleDir, maxBuffer: YT_DLP_MAX_BUFFER },
        );
        break;
      } catch (error) {
        lastError = error;
        if (isMissingCommandError(error)) continue;
        throw new Error(
          `yt-dlp subtitle download failed: ${formatExecError(error)}`,
        );
      }
    }

    const files = await readdir(subtitleDir);
    const subtitleFile =
      files.find((file) => /\.json3$/i.test(file)) ??
      files.find((file) => /\.vtt$/i.test(file));
    if (!subtitleFile) {
      throw new Error(
        `yt-dlp did not write an English subtitle file: ${formatExecError(lastError)}`,
      );
    }

    const payload = await readFile(join(subtitleDir, subtitleFile), "utf8");
    return parseCaptionPayload(
      payload,
      subtitleFile.toLowerCase().endsWith(".json3") ? "json3" : "vtt",
    );
  } finally {
    await rm(subtitleDir, { recursive: true, force: true });
  }
}

async function loadTranscriptWithLibrary(sourceUrl: string) {
  const transcript = await YoutubeTranscript.fetchTranscript(sourceUrl, {
    lang: "en",
  });
  return premiumTranscriptLineSchema.array().parse(
    transcript
      .map((line, index) => {
        const text = cleanCaptionText(line.text);
        if (!text) return null;
        const startTime = line.offset / 1000;
        const endTime =
          startTime + Math.max(0.5, (line.duration || 2000) / 1000);
        return {
          id: `yt-${index + 1}`,
          text,
          startTime,
          endTime,
        };
      })
      .filter(Boolean),
  );
}

export function selectCaptionTrack(
  metadata: YtDlpMetadata,
): YtDlpCaptionTrack | null {
  const candidates = [
    ...getEnglishTracks(metadata.subtitles),
    ...getEnglishTracks(metadata.automatic_captions),
  ];
  return (
    candidates.find((track) => track.ext === "json3" && track.url) ??
    candidates.find((track) => track.ext === "vtt" && track.url) ??
    candidates.find((track) => track.url) ??
    null
  );
}

export async function loadTranscriptWithYtDlp(
  sourceUrl: string,
  deps: {
    execFileAsync?: ExecFileAsync;
    fetch?: typeof fetch;
  } = {},
) {
  const runExecFile = deps.execFileAsync ?? (execFileAsync as ExecFileAsync);
  const runFetch = deps.fetch ?? fetch;
  let metadata: YtDlpMetadata = {};
  let transcript: PremiumLoadedTranscript = [];
  let missingTrackError: Error | undefined;

  try {
    metadata = await loadYtDlpMetadata(sourceUrl, runExecFile);
    const track = selectCaptionTrack(metadata);
    if (!track) {
      // Metadata loaded successfully but reported no English subtitle track:
      // this is a definitive result, not a transient yt-dlp failure, so skip
      // the raw-file-download and library fallbacks and report it directly.
      missingTrackError = new Error(
        "yt-dlp did not return an English subtitle track",
      );
      throw missingTrackError;
    }
    transcript = track.url
      ? await fetchCaptionTrack(track, runFetch).catch(() =>
          downloadSubtitleWithYtDlp(sourceUrl, runExecFile),
        )
      : await downloadSubtitleWithYtDlp(sourceUrl, runExecFile);
  } catch (ytDlpError) {
    if (missingTrackError) throw missingTrackError;
    try {
      transcript = await loadTranscriptWithLibrary(sourceUrl);
    } catch (libraryError) {
      throw new Error(
        [
          `yt-dlp loader failed: ${formatExecError(ytDlpError)}`,
          `library loader failed: ${formatExecError(libraryError)}`,
        ].join("\n"),
      );
    }
  }
  if (transcript.length === 0) {
    throw new Error("subtitle track did not contain readable captions");
  }

  return {
    metadata,
    transcript,
  };
}
