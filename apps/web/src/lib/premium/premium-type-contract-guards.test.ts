import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("premium type contract guards", () => {
  it("keeps shared learning session types free of client-only premium gates", () => {
    const sharedTypes = readRepoFile("packages/shared/src/types/index.ts");

    expect(sharedTypes).not.toContain("premium_required");
    expect(sharedTypes).toContain("export interface PremiumSession");
    expect(sharedTypes).toContain("export interface PremiumExpressionCard");
  });

  it("does not expose retired scene-split admin response contracts", () => {
    const webTypes = readRepoFile("apps/web/src/types/index.ts");
    const sharedTypes = readRepoFile("packages/shared/src/types/index.ts");
    const combinedTypes = `${webTypes}\n${sharedTypes}`;

    expect(combinedTypes).not.toContain("SceneRecommendation");
    expect(combinedTypes).not.toContain("SceneAnalysisResponse");
    expect(combinedTypes).not.toContain("LongformRecommendation");
    expect(combinedTypes).not.toContain("ShortRecommendation");
    expect(combinedTypes).toContain("PremiumSession");
  });
});
