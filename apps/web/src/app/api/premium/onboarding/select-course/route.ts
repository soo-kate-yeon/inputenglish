// @MX:ANCHOR: [AUTO] POST /api/premium/onboarding/select-course — Task 3.3 minimal
//   course selection (seed-only, REQ-WEB-005).
// @MX:REASON: [AUTO] The `courses` table (Phase 0) is currently EMPTY — Phase 5 seeds
//   real course rows. Per spec.md D6, only one course type is planned at launch
//   ("뉴스 코스"). This route writes a FIXED string identifier onto
//   users.selected_course rather than a foreign key, since there is nothing to pick
//   from yet. Only "news" is accepted; any other value is rejected until Phase 5
//   seeds real courses.id values that this route (or its successor) must reconcile with.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-005 (Task 3.3)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { writeSelectedCourse } from "@/lib/premium/il-onboarding-repository";

// Phase 3 scope: only the "news" course exists (D6). Phase 5 will seed real
// courses.id rows and this list must be reconciled with the courses table then.
const selectCourseRequestSchema = z.object({
  course: z.literal("news"),
});

/**
 * POST /api/premium/onboarding/select-course
 *
 * Request body:
 *   { course: "news" }
 *
 * Response (200):
 *   { selectedCourse: string }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid request body (only "news" is accepted at launch)
 *   500 — persistence failure
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Auth ─────────────────────────────────────────────────────────
  const userOrResponse = await requireApiUser(request);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // 401
  }
  const user = userOrResponse;

  // ── Step 2: Parse + validate body ────────────────────────────────────────
  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = selectCourseRequestSchema.safeParse(bodyRaw);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error:
          'Invalid request body. Only { course: "news" } is accepted at launch (D6).',
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { course } = parseResult.data;

  // ── Step 3: Persist fixed course identifier ──────────────────────────────
  const client = createAdminClient();
  try {
    await writeSelectedCourse(client, user.id, course);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to persist selected course", detail: message },
      { status: 500 },
    );
  }

  return NextResponse.json({ selectedCourse: course }, { status: 200 });
}
