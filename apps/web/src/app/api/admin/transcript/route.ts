import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8: string }[];
}

// yt-dlp is the most reliable way to fetch YouTube transcripts server-side.
// Direct HTTP approaches (timedtext API, InnerTube) are blocked by YouTube's
// bot detection when called from server environments without browser cookies.
async function fetchTranscriptViaYtDlp(
  videoId: string,
  lang = "en",
): Promise<
  {
    text: string;
    start: number;
    duration: number;
    offset: number;
    lang: string;
  }[]
> {
  const outPath = join(tmpdir(), `yt_${videoId}_${Date.now()}`);

  try {
    // Try manual subtitles first, then fall back to auto-generated
    await execFileAsync(
      "yt-dlp",
      [
        `https://www.youtube.com/watch?v=${videoId}`,
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        lang,
        "--sub-format",
        "json3",
        "--skip-download",
        "--no-playlist",
        "-o",
        outPath,
        "--quiet",
      ],
      { timeout: 30000 },
    );

    // yt-dlp appends language to filename
    const subtitlePath = `${outPath}.${lang}.json3`;
    const raw = await readFile(subtitlePath, "utf8");
    await unlink(subtitlePath).catch(() => {});

    const data = JSON.parse(raw) as { events?: Json3Event[] };

    return (data.events ?? [])
      .filter(
        (e): e is Json3Event & { tStartMs: number; segs: { utf8: string }[] } =>
          Array.isArray(e.segs) && e.tStartMs !== undefined,
      )
      .map((e) => ({
        text: e.segs
          .map((s) => s.utf8)
          .join("")
          .replace(/\n/g, " ")
          .trim(),
        start: e.tStartMs / 1000, // seconds
        duration: (e.dDurationMs ?? 0) / 1000,
        offset: e.tStartMs / 1000,
        lang,
      }))
      .filter((e) => e.text && e.text !== " ");
  } catch (err) {
    // Clean up any partial files
    await unlink(`${outPath}.${lang}.json3`).catch(() => {});
    throw err;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get("videoId");
  const lang = searchParams.get("lang") ?? "en";
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");

  if (!videoId) {
    return NextResponse.json(
      { error: "Missing videoId parameter" },
      { status: 400 },
    );
  }

  try {
    let transcript = await fetchTranscriptViaYtDlp(videoId, lang);

    if (!transcript.length) {
      return NextResponse.json(
        { error: "No transcript available for this video" },
        { status: 404 },
      );
    }

    // Filter by time range if specified
    const startSec = startTime ? parseFloat(startTime) : null;
    const endSec = endTime ? parseFloat(endTime) : null;

    if (startSec !== null || endSec !== null) {
      transcript = transcript.filter((item) => {
        const itemEnd = item.start + item.duration;
        if (startSec !== null && itemEnd < startSec) return false;
        if (endSec !== null && item.start > endSec) return false;
        return true;
      });
    }

    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch transcript";
    console.error("Transcript fetch error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
