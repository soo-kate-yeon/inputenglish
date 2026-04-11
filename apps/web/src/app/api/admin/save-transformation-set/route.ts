// @MX:NOTE: [AUTO] Saves AI-generated (or manually edited) transformation set to Supabase (SPEC-MOBILE-011).
// Uses service role key to bypass RLS for admin writes.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import type {
  TransformationSet,
  TransformationExercise,
} from "@inputenglish/shared";

interface SaveTransformationSetRequest {
  sessionId: string;
  set: Partial<TransformationSet>;
  exercises: Partial<TransformationExercise>[];
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: sets, error: setError } = await supabase
      .from("transformation_sets")
      .select("*, transformation_exercises(*)")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    if (!sets || sets.length === 0) {
      return NextResponse.json({ set: null, exercises: [] });
    }

    const latestSet = sets[0];
    const exercises = (latestSet.transformation_exercises ?? []).sort(
      (a: { page_order: number }, b: { page_order: number }) =>
        a.page_order - b.page_order,
    );

    return NextResponse.json({
      set: {
        id: latestSet.id,
        target_pattern: latestSet.target_pattern,
        pattern_type: latestSet.pattern_type,
        pattern_rationale: latestSet.pattern_rationale,
        source_sentence_ids: latestSet.source_sentence_ids ?? [],
      },
      exercises,
    });
  } catch (error) {
    console.error("[save-transformation-set GET] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveTransformationSetRequest;
    const { sessionId, set, exercises } = body;

    if (!sessionId || !set || !Array.isArray(exercises)) {
      return NextResponse.json(
        { error: "sessionId, set, and exercises are required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Insert the transformation set
    const { data: savedSet, error: setError } = await supabase
      .from("transformation_sets")
      .insert({
        session_id: sessionId,
        target_pattern: set.target_pattern ?? "",
        pattern_type: set.pattern_type ?? "declarative",
        pattern_rationale: set.pattern_rationale ?? null,
        source_sentence_ids: set.source_sentence_ids ?? [],
        generated_by: set.generated_by ?? "ai",
      })
      .select()
      .single();

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    // Insert exercises linked to the new set
    if (exercises.length > 0) {
      const exerciseRows = exercises.map((ex) => ({
        set_id: savedSet.id,
        page_order: ex.page_order,
        exercise_type: ex.exercise_type,
        instruction_text: ex.instruction_text ?? "",
        source_korean: ex.source_korean ?? null,
        question_text: ex.question_text ?? null,
        situation_text: ex.situation_text ?? null,
        dialog_lines: ex.dialog_lines ?? null,
        reference_answer: ex.reference_answer ?? null,
      }));

      const { error: exercisesError } = await supabase
        .from("transformation_exercises")
        .insert(exerciseRows);

      if (exercisesError) {
        return NextResponse.json(
          { error: exercisesError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ setId: savedSet.id, set: savedSet });
  } catch (error) {
    console.error("[save-transformation-set] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/** PATCH: update source_sentence_id on an existing transformation set */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      setId: string;
      source_sentence_ids: string[];
    };
    const { setId, source_sentence_ids } = body;

    if (!setId || !Array.isArray(source_sentence_ids)) {
      return NextResponse.json(
        { error: "setId and source_sentence_ids are required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("transformation_sets")
      .update({ source_sentence_ids })
      .eq("id", setId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ set: data });
  } catch (error) {
    console.error("[save-transformation-set PATCH] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
