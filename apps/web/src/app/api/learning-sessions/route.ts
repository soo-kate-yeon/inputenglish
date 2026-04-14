import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { LearningSession } from "@inputenglish/shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const difficulty = searchParams.get("difficulty");
    const sessionId = searchParams.get("sessionId");

    // Query learning_sessions
    let query = supabase.from("learning_sessions").select(`
                *,
                context:session_contexts (
                    session_id,
                    strategic_intent,
                    reusable_scenarios,
                    key_vocabulary,
                    grammar_rhetoric_note,
                    expected_takeaway,
                    generated_by,
                    updated_by,
                    created_at,
                    updated_at
                ),
                source_video:source_video_id (
                    video_id,
                    title,
                    transcript,
                    thumbnail_url
                )
            `);

    if (sessionId && UUID_PATTERN.test(sessionId)) {
      query = query.eq("id", sessionId);
    } else if (sessionId) {
      console.warn(
        "Ignoring non-UUID sessionId in learning sessions API:",
        sessionId,
      );
      return NextResponse.json({ sessions: [] });
    } else {
      query = query.order("created_at", { ascending: false });

      if (difficulty && difficulty !== "all") {
        query = query.eq("difficulty", difficulty);
      }
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error("Learning sessions fetch error:", error);
      throw error;
    }

    if (!sessions) {
      return NextResponse.json({ sessions: [] });
    }

    // Hydrate sessions with actual sentences from source_video transcript
    const hydratedSessions = sessions.map((session: any) => {
      const sourceVideo = session.source_video;
      let sentences = [];

      if (
        sourceVideo &&
        sourceVideo.transcript &&
        Array.isArray(session.sentence_ids)
      ) {
        // Filter sentences that match IDs in session.sentence_ids
        const idSet = new Set(session.sentence_ids);
        sentences = sourceVideo.transcript.filter((s: any) => idSet.has(s.id));
      }

      // Fallback thumbnail if session doesn't have one
      const thumbnail_url =
        session.thumbnail_url ||
        sourceVideo?.thumbnail_url ||
        `https://img.youtube.com/vi/${session.source_video_id}/hqdefault.jpg`;

      // We return a LearningSession object, ensuring structural compatibility
      return {
        ...session,
        thumbnail_url,
        sentences,
        source_video: undefined,
        context: Array.isArray(session.context)
          ? (session.context[0] ?? null)
          : (session.context ?? null),
      };
    });

    return NextResponse.json({ sessions: hydratedSessions });
  } catch (error: any) {
    console.error("Learning sessions API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
