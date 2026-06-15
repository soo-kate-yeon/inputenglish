import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// @MX:NOTE: [AUTO] SPEC-INPUT-002 REQ-AUTO-005 legacy freeze guard.
// The content automation pipeline (ingest, reading batch, level-aware
// assembly, cron) must operate ONLY on v1.3 tables and never read or write
// the legacy premium surface. This static guard asserts zero references to
// legacy premium tables, the legacy admin UI module, or deprecated premium
// types in any automation code path. Removal of the deprecated types is a
// separate track (INPUT-001 Stage B(3)); this guard only enforces isolation.

const webRoot = path.resolve(__dirname, "../../../..");

// Phase 1-4 automation code paths (REQ-AUTO-001..004).
const AUTOMATION_FILES = [
  "src/app/api/admin/premium/ingest/route.ts", // Phase 1
  "src/lib/premium/translation.ts", // Phase 1
  "src/lib/premium/band-coverage.ts", // Phase 1
  "src/lib/premium/segment-scorer.ts", // Phase 1
  "src/lib/premium/reading-matrix.ts", // Phase 2
  "src/lib/premium/reading-batch.ts", // Phase 2 / 4
  "src/app/api/premium/today/route.ts", // Phase 3
  "src/app/api/cron/reading-batch/route.ts", // Phase 4
];

// Legacy premium Supabase tables (must never be queried by automation).
const FORBIDDEN_LEGACY_TABLES = [
  "premium_sessions",
  "premium_articles",
  "premium_expression_cards",
];

// Deprecated premium types (still exported for legacy admin compatibility).
const FORBIDDEN_LEGACY_TYPES = [
  "PremiumArticle",
  "PremiumExpressionCard",
  "PremiumRoleplay",
  "PREMIUM_SESSION_STEPS",
];

// Legacy admin UI module import fragments.
const FORBIDDEN_LEGACY_MODULES = ["admin/premium/page", "SessionCreator"];

function readAutomationFile(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("SPEC-INPUT-002 automation freeze guard (REQ-AUTO-005)", () => {
  it.each(AUTOMATION_FILES)(
    "%s references no legacy premium tables",
    (file) => {
      const source = readAutomationFile(file);
      for (const table of FORBIDDEN_LEGACY_TABLES) {
        expect(source).not.toContain(table);
      }
    },
  );

  it.each(AUTOMATION_FILES)(
    "%s references no deprecated premium types",
    (file) => {
      const source = readAutomationFile(file);
      for (const type of FORBIDDEN_LEGACY_TYPES) {
        expect(source).not.toContain(type);
      }
    },
  );

  it.each(AUTOMATION_FILES)("%s imports no legacy admin UI module", (file) => {
    const source = readAutomationFile(file);
    for (const moduleFragment of FORBIDDEN_LEGACY_MODULES) {
      expect(source).not.toContain(moduleFragment);
    }
  });

  it("automation persistence never queries a legacy premium table", () => {
    // Files that issue Supabase table queries must not name any legacy premium
    // table. Legitimate v1.3 / INPUT-001 tables (reading_pieces, video_segments,
    // ci_sessions, channels, user_vocab_profiles, learning profile) are allowed.
    const dataFiles = [
      "src/app/api/admin/premium/ingest/route.ts",
      "src/app/api/premium/today/route.ts",
      "src/app/api/cron/reading-batch/route.ts",
    ];
    const tableRefPattern = /\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g;
    for (const file of dataFiles) {
      const source = readAutomationFile(file);
      const referenced = [...source.matchAll(tableRefPattern)].map((m) => m[1]);
      for (const table of referenced) {
        expect(FORBIDDEN_LEGACY_TABLES).not.toContain(table);
      }
    }
  });

  it("the legacy premium admin page remains present and untouched (freeze, not delete)", () => {
    // EC-005-B: this SPEC freezes the legacy admin; it must still exist.
    const legacyAdmin = path.join(
      webRoot,
      "src",
      "app",
      "admin",
      "premium",
      "page.tsx",
    );
    expect(() => readFileSync(legacyAdmin, "utf8")).not.toThrow();
  });
});
