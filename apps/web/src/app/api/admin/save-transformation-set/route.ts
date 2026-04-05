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
