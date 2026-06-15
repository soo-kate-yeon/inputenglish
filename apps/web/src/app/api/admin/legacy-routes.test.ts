import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    id: "admin-user",
    email: "admin@example.com",
  })),
}));

type RetiredRouteModule = Partial<
  Record<"GET" | "POST" | "PATCH", () => Promise<Response>>
>;

const retiredRoutes: Array<
  [
    routeName: string,
    loader: () => Promise<unknown>,
    method: "GET" | "POST" | "PATCH",
    expectedReplacement?: string,
  ]
> = [
  [
    "analyze-content-structure",
    () => import("./analyze-content-structure/route"),
    "POST",
    "/api/admin/premium/pipeline/draft",
  ],
  [
    "analyze-scenes",
    () => import("./analyze-scenes/route"),
    "POST",
    "/api/admin/premium/pipeline/draft",
  ],
  [
    "transcript",
    () => import("./transcript/route"),
    "GET",
    "/api/admin/premium/transcript",
  ],
  ["autofill-longform", () => import("./autofill-longform/route"), "POST"],
  [
    "generate-longform-context",
    () => import("./generate-longform-context/route"),
    "POST",
  ],
  ["longform-packs", () => import("./longform-packs/route"), "POST"],
  ["learning-sessions", () => import("./learning-sessions/route"), "POST"],
  ["autofill-session", () => import("./autofill-session/route"), "POST"],
  [
    "generate-session-context",
    () => import("./generate-session-context/route"),
    "POST",
  ],
  [
    "generate-transformation",
    () => import("./generate-transformation/route"),
    "POST",
  ],
  ["curated-videos", () => import("./curated-videos/route"), "POST"],
  [
    "save-transformation-set",
    () => import("./save-transformation-set/route"),
    "GET",
  ],
  [
    "save-transformation-set",
    () => import("./save-transformation-set/route"),
    "POST",
  ],
  [
    "save-transformation-set",
    () => import("./save-transformation-set/route"),
    "PATCH",
  ],
];

describe("legacy admin authoring routes", () => {
  it.each(retiredRoutes)(
    "retires /api/admin/%s %s in favor of premium admin APIs",
    async (_routeName, loader, method, expectedReplacement) => {
      const route = (await loader()) as RetiredRouteModule;
      const handler = route[method];
      expect(handler).toBeTypeOf("function");
      if (!handler) throw new Error(`${method} handler was not exported`);

      const response = await handler();
      const payload = await response.json();

      expect(response.status).toBe(410);
      expect(payload.error).toContain("retired");
      if (expectedReplacement) {
        expect(payload.replacement).toBe(expectedReplacement);
      } else {
        expect(payload.replacement).toMatch(/^\/api\/admin\/premium\//);
      }
    },
  );
});
