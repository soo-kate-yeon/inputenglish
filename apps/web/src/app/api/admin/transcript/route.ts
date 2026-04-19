import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);
const YT_DLP_TIMEOUT_MS = 30_000;

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
  const workDir = await mkdtemp(join(tmpdir(), `yt_${videoId}_`));
  const outPath = join(workDir, "subtitle");

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
      { timeout: YT_DLP_TIMEOUT_MS },
    );

    const files = await readdir(workDir);
    const subtitleFile = files.find(
      (fileName) =>
        fileName.endsWith(".json3") &&
        (fileName.includes(`.${lang}.`) ||
          fileName.includes(`.${lang}-`) ||
          fileName.includes(`.${lang}.json3`)),
    );

    if (!subtitleFile) {
      throw new Error(`No ${lang} subtitles were generated for this video`);
    }

    const subtitlePath = join(workDir, subtitleFile);
    const raw = await readFile(subtitlePath, "utf8");

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
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

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
    console.error("Transcript fetch error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to fetch transcript";

    if (message.includes("No transcript available")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes("No en subtitles were generated")) {
      return NextResponse.json(
        {
          error:
            "This video does not have English subtitles available through yt-dlp",
        },
        { status: 404 },
      );
    }

    if (message.includes("timed out")) {
      return NextResponse.json(
        { error: "Transcript request timed out" },
        { status: 504 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
