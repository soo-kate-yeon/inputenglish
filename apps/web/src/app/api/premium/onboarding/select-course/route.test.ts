/**
 * TDD tests for POST /api/premium/onboarding/select-course (Task 3.3, SPEC-WEB-001 Phase 3)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Minimal course-selection step: the `courses` table is empty (Phase 5 seeds real
 * rows), so this writes a FIXED string identifier ('news') onto users.selected_course,
 * not a foreign key. Phase 5 reconciles this fixed string with real courses.id later.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireApiUser } = vi.hoisted(() => ({
  mockRequireApiUser: vi.fn(),
}));

const { mockWriteSelectedCourse } = vi.hoisted(() => ({
  mockWriteSelectedCourse: vi.fn(),
}));

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: mockRequireApiUser,
}));

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/premium/il-onboarding-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/premium/il-onboarding-repository")
  >("@/lib/premium/il-onboarding-repository");
  return {
    ...actual,
    writeSelectedCourse: mockWriteSelectedCourse,
  };
});

import { POST } from "@/app/api/premium/onboarding/select-course/route";
import { NextRequest, NextResponse } from "next/server";

const MOCK_USER = { id: "user-select-course-0000-000000000001" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/premium/onboarding/select-course",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/premium/onboarding/select-course", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue(MOCK_USER);
    mockWriteSelectedCourse.mockResolvedValue(undefined);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockRequireApiUser.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

    const response = await POST(makeRequest({ course: "news" }));

    expect(response.status).toBe(401);
    expect(mockWriteSelectedCourse).not.toHaveBeenCalled();
  });

  it("writes the fixed 'news' course identifier (D6 — single course at launch)", async () => {
    const response = await POST(makeRequest({ course: "news" }));

    expect(response.status).toBe(200);
    expect(mockWriteSelectedCourse).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      "news",
    );
  });

  it("rejects any course value other than 'news' with 400 (only one course exists at launch)", async () => {
    const response = await POST(makeRequest({ course: "business" }));

    expect(response.status).toBe(400);
    expect(mockWriteSelectedCourse).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed request body", async () => {
    const response = await POST(makeRequest({ foo: "bar" }));
    expect(response.status).toBe(400);
    expect(mockWriteSelectedCourse).not.toHaveBeenCalled();
  });
});
