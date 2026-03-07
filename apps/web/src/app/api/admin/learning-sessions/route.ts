import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import type { LearningSession } from "@shadowoo/shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_video_id, sessions } = body;

    if (!source_video_id || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "Missing defined parameters" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // 1. Delete existing sessions for this video (Full replacement strategy)
    // This is simpler than diffing. For admin tool, this is acceptable.
    // HOWEVER, be careful if user history links to session IDs.
    // Ideally we should upsert, but IDs are generated on client in SessionCreator as temp IDs.
    // If we want to preserve IDs, we should use upsert.
    // Since SessionCreator generates IDs with crypto.randomUUID(), if we are loading existing sessions,
    // we should keep their IDs.

    // Actually, let's use upsert.
    const sessionsToUpsert = sessions.map(
      (s: LearningSession, index: number) => ({
        ...(typeof s.id === "string" && UUID_PATTERN.test(s.id)
          ? { id: s.id }
          : {}),
        source_video_id,
        title: s.title,
        description: s.description,
        start_time: s.start_time,
        end_time: s.end_time,
        sentence_ids: s.sentence_ids,
        thumbnail_url: s.thumbnail_url,
        difficulty: s.difficulty,
        order_index: index,
        created_by: null,
        // duration is generated column
      }),
    );

    // We also need to delete sessions that were removed in UI.
    // 1. Get all current DB session IDs for this video
    const { data: currentDbSessions } = await supabase
      .from("learning_sessions")
      .select("id")
      .eq("source_video_id", source_video_id);

    const currentIds = new Set(currentDbSessions?.map((s) => s.id) || []);
    const validIdsInRequest = new Set(sessionsToUpsert.map((s: any) => s.id));

    const idsToDelete = Array.from(currentIds).filter(
      (id) => !validIdsInRequest.has(id),
    );

    // 2. Delete removed sessions
    if (idsToDelete.length > 0) {
      await supabase.from("learning_sessions").delete().in("id", idsToDelete);
    }

    // 3. Upsert new/updated sessions
    if (sessionsToUpsert.length > 0) {
      const { error } = await supabase
        .from("learning_sessions")
        .upsert(sessionsToUpsert);

      if (error) {
        console.error("❌ [API] Upsert error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          sessionsToUpsert,
        });
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [API] Session creation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
