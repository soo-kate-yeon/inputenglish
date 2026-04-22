import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";
import type { LongformPack } from "@inputenglish/shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildLongformSaveError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const code =
      "code" in error && typeof error.code === "string" ? error.code : "";
    const hint =
      "hint" in error && typeof error.hint === "string" ? error.hint : "";

    if (
      code === "PGRST205" ||
      code === "42P01" ||
      code === "42703" ||
      error.message.includes("schema cache") ||
      error.message.includes("does not exist")
    ) {
      return "롱폼 저장용 DB 스키마가 아직 반영되지 않았습니다. `supabase/migrations/20260423093000_add_longform_pack_hierarchy.sql`와 후속 보강 migration을 적용해주세요.";
    }

    return [error.message, hint].filter(Boolean).join(" | ");
  }

  return "Failed to save longform pack";
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { source_video_id, longformPack } = body as {
      source_video_id?: string;
      longformPack?: LongformPack;
    };

    if (!source_video_id || !longformPack) {
      return NextResponse.json(
        { error: "source_video_id and longformPack are required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const row = {
      ...(typeof longformPack.id === "string" &&
      UUID_PATTERN.test(longformPack.id)
        ? { id: longformPack.id }
        : {}),
      source_video_id,
      title: longformPack.title,
      subtitle: longformPack.subtitle || null,
      description: longformPack.description || null,
      start_time: longformPack.start_time,
      end_time: longformPack.end_time,
      sentence_ids: longformPack.sentence_ids,
      primary_speaker_id: longformPack.primary_speaker_id ?? null,
      speaker_summary: longformPack.speaker_summary ?? null,
      talk_summary: longformPack.talk_summary ?? null,
      topic_tags: longformPack.topic_tags ?? [],
      content_tags: longformPack.content_tags ?? [],
      created_by: null,
    };

    const { data: savedPack, error: packError } = await supabase
      .from("longform_packs")
      .upsert(row)
      .select("id")
      .single();

    if (packError) {
      throw packError;
    }

    if (longformPack.context) {
      const { error: contextError } = await supabase
        .from("longform_contexts")
        .upsert({
          longform_pack_id: savedPack.id,
          speaker_snapshot: longformPack.context.speaker_snapshot,
          conversation_type: longformPack.context.conversation_type,
          core_topics: longformPack.context.core_topics,
          why_this_segment: longformPack.context.why_this_segment,
          listening_takeaway: longformPack.context.listening_takeaway,
          generated_by: longformPack.context.generated_by ?? "manual",
          updated_by: null,
        });

      if (contextError) {
        throw contextError;
      }
    }

    return NextResponse.json({
      success: true,
      longform_pack_id: savedPack.id,
    });
  } catch (error) {
    console.error("[API] longform-packs error:", error);
    return NextResponse.json(
      { error: buildLongformSaveError(error) },
      { status: 500 },
    );
  }
}
