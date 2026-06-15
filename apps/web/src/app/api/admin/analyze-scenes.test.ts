import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

describe("POST /api/admin/analyze-scenes", () => {
  it("retires legacy multi-scene analysis in favor of premium pipeline drafts", async () => {
    const { POST } = await import("./analyze-scenes/route");
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.error).toContain("retired");
    expect(payload.replacement).toBe("/api/admin/premium/pipeline/draft");
  });
});
