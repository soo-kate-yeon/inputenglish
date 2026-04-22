import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";
import type { LearningSession } from "@inputenglish/shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildLearningSessionSaveError(error: unknown): string {
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
      code === "42703" ||
      code === "42P01" ||
      error.message.includes("longform_pack_id") ||
      error.message.includes("does not exist")
    ) {
      return "learning_sessions.longform_pack_id 컬럼이 아직 DB에 없습니다. 롱폼 계층 마이그레이션을 적용해주세요.";
    }

    return [error.message, hint].filter(Boolean).join(" | ");
  }

  return "Failed to save learning sessions";
}

function slugifySpeakerName(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "speaker"
  );
}

async function resolvePrimarySpeaker(
  supabase: ReturnType<typeof createAdminClient>,
  primarySpeakerId?: string | null,
  primarySpeakerName?: string | null,
  primarySpeakerDescription?: string | null,
  primarySpeakerAvatarUrl?: string | null,
) {
  const normalizedAvatarUrl = primarySpeakerAvatarUrl?.trim() || null;

  if (primarySpeakerId && UUID_PATTERN.test(primarySpeakerId)) {
    const { data: speakerById, error: speakerByIdError } = await supabase
      .from("speakers")
      .select("id, slug, name, description_long, avatar_url")
      .eq("id", primarySpeakerId)
      .maybeSingle();

    if (speakerByIdError) throw speakerByIdError;
    if (speakerById) {
      const trimmedDescription = primarySpeakerDescription?.trim();
      if (
        trimmedDescription &&
        trimmedDescription !== speakerById.description_long
      ) {
        const updates: Record<string, unknown> = {
          description_long: trimmedDescription,
        };

        if (normalizedAvatarUrl !== speakerById.avatar_url) {
          updates.avatar_url = normalizedAvatarUrl;
        }

        const { error: speakerDescriptionError } = await supabase
          .from("speakers")
          .update(updates)
          .eq("id", speakerById.id);

        if (speakerDescriptionError) throw speakerDescriptionError;
      } else if (normalizedAvatarUrl !== speakerById.avatar_url) {
        const { error: speakerAvatarError } = await supabase
          .from("speakers")
          .update({ avatar_url: normalizedAvatarUrl })
          .eq("id", speakerById.id);

        if (speakerAvatarError) throw speakerAvatarError;
      }

      return {
        id: speakerById.id,
        slug: speakerById.slug,
        name: speakerById.name,
      };
    }
  }

  const trimmedName = primarySpeakerName?.trim();
  if (!trimmedName) return null;

  const { data: existingSpeaker, error: existingSpeakerError } = await supabase
    .from("speakers")
    .select("id, slug, name, is_featured, description_long, avatar_url")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (existingSpeakerError) throw existingSpeakerError;
  if (existingSpeaker) {
    const trimmedDescription = primarySpeakerDescription?.trim();
    const updates: Record<string, unknown> = {};

    if (!existingSpeaker.is_featured) {
      updates.is_featured = true;
    }

    if (
      trimmedDescription &&
      trimmedDescription !== existingSpeaker.description_long
    ) {
      updates.description_long = trimmedDescription;
    }

    if (normalizedAvatarUrl !== existingSpeaker.avatar_url) {
      updates.avatar_url = normalizedAvatarUrl;
    }

    if (Object.keys(updates).length > 0) {
      const { error: promoteSpeakerError } = await supabase
        .from("speakers")
        .update(updates)
        .eq("id", existingSpeaker.id);

      if (promoteSpeakerError) throw promoteSpeakerError;
    }

    return {
      id: existingSpeaker.id,
      slug: existingSpeaker.slug,
      name: existingSpeaker.name,
    };
  }

  const baseSlug = slugifySpeakerName(trimmedName);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data: slugCollision, error: slugError } = await supabase
      .from("speakers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (slugError) throw slugError;
    if (!slugCollision) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: insertedSpeaker, error: insertSpeakerError } = await supabase
    .from("speakers")
    .insert({
      slug,
      name: trimmedName,
      is_featured: true,
      description_long: primarySpeakerDescription?.trim() || null,
      avatar_url: normalizedAvatarUrl,
    })
    .select("id, slug, name")
    .single();

  if (insertSpeakerError) throw insertSpeakerError;
  return insertedSpeaker;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      source_video_id,
      sessions,
      primarySpeakerId,
      primarySpeakerName,
      primarySpeakerDescription,
      primarySpeakerAvatarUrl,
    } = body;

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
        longform_pack_id: s.longform_pack_id ?? null,
        title: s.title,
        subtitle: s.subtitle || null,
        description: s.description,
        start_time: s.start_time,
        end_time: s.end_time,
        sentence_ids: s.sentence_ids,
        thumbnail_url: s.thumbnail_url,
        difficulty: s.difficulty,
        order_index: index,
        source_type: s.source_type,
        genre: s.genre ?? null,
        role_relevance: s.role_relevance ?? [],
        premium_required: s.premium_required ?? false,
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
        .upsert(sessionsToUpsert)
        .select("id");

      if (error) {
        console.error("[API] Upsert error:", {
          message: error.message,
          code: error.code,
          sessionsToUpsert,
        });
        throw error;
      }

      const contextsToUpsert = sessions
        .filter(
          (session: LearningSession) =>
            session.context &&
            typeof session.id === "string" &&
            UUID_PATTERN.test(session.id),
        )
        .map((session: LearningSession) => ({
          session_id: session.id,
          strategic_intent: session.context?.strategic_intent ?? "",
          reusable_scenarios: session.context?.reusable_scenarios ?? [],
          key_vocabulary: session.context?.key_vocabulary ?? [],
          grammar_rhetoric_note: session.context?.grammar_rhetoric_note ?? "",
          expected_takeaway: session.context?.expected_takeaway ?? "",
          generated_by: session.context?.generated_by ?? "manual",
          updated_by: null,
        }));

      const sessionIdsWithoutContext = sessions
        .filter(
          (session: LearningSession) =>
            typeof session.id === "string" &&
            UUID_PATTERN.test(session.id) &&
            !session.context,
        )
        .map((session: LearningSession) => session.id);

      if (sessionIdsWithoutContext.length > 0) {
        const { error: deleteContextError } = await supabase
          .from("session_contexts")
          .delete()
          .in("session_id", sessionIdsWithoutContext);

        if (deleteContextError) {
          console.error("❌ [API] Session context delete error:", {
            message: deleteContextError.message,
            details: deleteContextError.details,
            hint: deleteContextError.hint,
            code: deleteContextError.code,
            sessionIdsWithoutContext,
          });
          throw deleteContextError;
        }
      }

      if (contextsToUpsert.length > 0) {
        const { error: contextError } = await supabase
          .from("session_contexts")
          .upsert(contextsToUpsert);

        if (contextError) {
          console.error("❌ [API] Session context upsert error:", {
            message: contextError.message,
            details: contextError.details,
            hint: contextError.hint,
            code: contextError.code,
            contextsToUpsert,
          });
          throw contextError;
        }
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "primarySpeakerId") ||
      Object.prototype.hasOwnProperty.call(body, "primarySpeakerName")
    ) {
      const resolvedSpeaker = await resolvePrimarySpeaker(
        supabase,
        primarySpeakerId,
        primarySpeakerName,
        primarySpeakerDescription,
        primarySpeakerAvatarUrl,
      );

      const { error: demoteError } = await supabase
        .from("video_speakers")
        .update({ is_primary: false })
        .eq("video_id", source_video_id);

      if (demoteError) {
        throw demoteError;
      }

      if (resolvedSpeaker) {
        const { error: speakerLinkError } = await supabase
          .from("video_speakers")
          .upsert(
            {
              video_id: source_video_id,
              speaker_id: resolvedSpeaker.id,
              is_primary: true,
              admin_verified: true,
            },
            { onConflict: "video_id,speaker_id" },
          );

        if (speakerLinkError) {
          throw speakerLinkError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[API] Session creation error:", error);
    return NextResponse.json(
      { error: buildLearningSessionSaveError(error) },
      { status: 500 },
    );
  }
}
