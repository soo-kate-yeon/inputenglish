import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { parseTranscriptToSentences, extractVideoId } from "@shadowoo/shared";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      youtube_url,
      transcript_text,
      difficulty = "intermediate",
      tags = [],
      snippet_start_time,
      snippet_end_time,
    } = body;

    console.log("🚀 [Admin API] Received request:", {
      youtube_url,
      difficulty,
      snippet_start_time,
      snippet_end_time,
    });

    if (
      !youtube_url ||
      !transcript_text ||
      snippet_start_time === undefined ||
      snippet_end_time === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: youtube_url, transcript_text, snippet_start_time, snippet_end_time",
        },
        { status: 400 },
      );
    }

    const video_id = extractVideoId(youtube_url);
    if (!video_id) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 },
      );
    }

    let sentences = [];

    // Check if pre-parsed/synced transcript is provided
    if (body.transcript && Array.isArray(body.transcript)) {
      console.log("📦 Using pre-parsed transcript from request");
      sentences = body.transcript;
    } else {
      // Parse transcript text with timestamps
      const lines = transcript_text
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l);

      const transcriptItems = [];
      let currentItem: {
        text: string;
        start: number;
        duration: number;
        offset: number;
        lang: string;
      } | null = null;

      for (const line of lines) {
        // Check for timestamp-only line: "8:55", "1:08:55"
        const timestampOnlyMatch = line.match(/^(?:(\d+):)?(\d+):(\d+)$/);

        // Check for inline format: "8:55 text here"
        const inlineMatch = line.match(/^(?:(\d+):)?(\d+):(\d+)\s+(.+)$/);

        if (timestampOnlyMatch || inlineMatch) {
          if (currentItem) transcriptItems.push(currentItem);

          const match = timestampOnlyMatch || inlineMatch;
          const hours = match[1] ? parseInt(match[1]) : 0;
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
          const text = inlineMatch ? inlineMatch[4].trim() : "";

          currentItem = {
            text: text,
            start: timeInSeconds,
            duration: 2, // Default duration, will be adjusted by parser
            offset: timeInSeconds,
            lang: "en",
          };
        } else if (currentItem) {
          currentItem.text += (currentItem.text ? " " : "") + line;
        }
      }
      if (currentItem) transcriptItems.push(currentItem);

      if (transcriptItems.length === 0) {
        return NextResponse.json(
          {
            error:
              "No valid timestamped transcript found. Please keep timestamps ON when copying from YouTube.",
          },
          { status: 400 },
        );
      }

      console.log(`✅ Parsed ${transcriptItems.length} transcript items`);

      // Convert items to sentences
      sentences = parseTranscriptToSentences(transcriptItems);
    }

    // Fetch video metadata
    const title = `Video ${video_id}`;
    const thumbnail_url = `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`;

    console.log(
      "🔑 [Admin API] SERVICE_ROLE_KEY exists:",
      !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    console.log(
      "🔑 [Admin API] SERVICE_ROLE_KEY prefix:",
      process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20),
    );
    const supabase = createAdminClient();

    // Check for duplicates
    const { data: existing } = await supabase
      .from("curated_videos")
      .select("id")
      .eq("video_id", video_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Video already exists in curated library" },
        { status: 409 },
      );
    }

    // Insert into database
    const { data, error } = await supabase
      .from("curated_videos")
      .insert({
        video_id,
        title,
        thumbnail_url,
        transcript: sentences,
        difficulty,
        tags,
        source_url: youtube_url,
        attribution: `Video by ${title}`, // Basic attribution, can be improved
        snippet_start_time,
        snippet_end_time,
        // snippet_duration is generated always, do not insert
      })
      .select()
      .single();

    if (error) {
      console.error("Database insertion error:", error);
      throw error;
    }

    return NextResponse.json({
      message: "Video added successfully",
      video: data,
    });
  } catch (error: any) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
