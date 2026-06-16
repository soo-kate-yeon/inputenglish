import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// @MX:NOTE: [AUTO] SPEC-INPUT-003 REQ-VOCAB-I freeze guard (REQ-AUTO-005 inherited).
// All INPUT-003 automation files (vocab assessment, refine, scorer/sampler,
// hysteresis, frequency-list) must operate ONLY on v1.3 tables and never
// reference the legacy premium surface. This static guard asserts zero
// references to legacy premium tables, deprecated types, or the legacy admin
// UI module in any INPUT-003 code path.

// __dirname = apps/web/src/lib/premium/__tests__
// webRoot   = apps/web (go up 4 levels: __tests__ → premium → lib → src → apps/web)
// File paths below use "src/..." prefix (same pattern as automation-freeze-guard.test.ts).
const webRoot = path.resolve(__dirname, "../../../..");
// sharedSrc = packages/shared/src (go up 6 from __dirname to repo root, then down)
const sharedSrc = path.resolve(
  __dirname,
  "../../../../../../packages/shared/src",
);

// INPUT-003 automation file paths (relative to their package root)
const VOCAB_FILES_WEB = [
  // Phase 2: Persist writer
  "lib/premium/vocab-assessment-repository.ts",
  // Phase 3: Refine loop
  "lib/premium/vocab-refine.ts",
  // Phase 2: Assessment API route
  "app/api/premium/vocab-assessment/route.ts",
  // Phase 3: Signal API route
  "app/api/premium/vocab-signal/route.ts",
];

// Shared file paths are relative to sharedSrc (packages/shared/src)
const VOCAB_FILES_SHARED: Array<[root: string, relPath: string]> = [
  // Phase 0: Frequency list loader
  [sharedSrc, "lib/frequency-list.ts"],
  // Phase 1: Assessment scorer
  [sharedSrc, "lib/vocab-assessment-scorer.ts"],
  // Phase 3: Hysteresis
  [sharedSrc, "lib/vocab-hysteresis.ts"],
];

// Legacy premium Supabase tables (must never be queried by INPUT-003 automation)
const FORBIDDEN_LEGACY_TABLES = [
  "premium_sessions",
  "premium_articles",
  "premium_expression_cards",
];

// Deprecated premium types (still exported for legacy admin compatibility)
const FORBIDDEN_LEGACY_TYPES = [
  "PremiumArticle",
  "PremiumExpressionCard",
  "PremiumRoleplay",
  "PREMIUM_SESSION_STEPS",
];

// Legacy admin UI module import fragments
const FORBIDDEN_LEGACY_MODULES = ["admin/premium/page", "SessionCreator"];

function readFile(root: string, relativePath: string): string {
  // root is an absolute path; relativePath is relative to that root
  const fullPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(root, relativePath);
  return readFileSync(fullPath, "utf8");
}

// ── Web files ─────────────────────────────────────────────────────────────────

describe("SPEC-INPUT-003 vocab freeze guard — web files (REQ-AUTO-005 inherited)", () => {
  it.each(VOCAB_FILES_WEB)("%s references no legacy premium tables", (file) => {
    const source = readFile(webRoot, `src/${file}`);
    for (const table of FORBIDDEN_LEGACY_TABLES) {
      expect(
        source,
        `${file} must not reference legacy table '${table}'`,
      ).not.toContain(table);
    }
  });

  it.each(VOCAB_FILES_WEB)(
    "%s references no deprecated premium types",
    (file) => {
      const source = readFile(webRoot, `src/${file}`);
      for (const type of FORBIDDEN_LEGACY_TYPES) {
        expect(
          source,
          `${file} must not reference deprecated type '${type}'`,
        ).not.toContain(type);
      }
    },
  );

  it.each(VOCAB_FILES_WEB)("%s imports no legacy admin UI module", (file) => {
    const source = readFile(webRoot, `src/${file}`);
    for (const moduleFragment of FORBIDDEN_LEGACY_MODULES) {
      expect(
        source,
        `${file} must not import legacy module '${moduleFragment}'`,
      ).not.toContain(moduleFragment);
    }
  });

  it("vocab web files never query a legacy premium table (Supabase .from() check)", () => {
    const tableRefPattern = /\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g;
    for (const file of VOCAB_FILES_WEB) {
      const source = readFile(webRoot, `src/${file}`);
      const referenced = [...source.matchAll(tableRefPattern)].map((m) => m[1]);
      for (const table of referenced) {
        expect(
          FORBIDDEN_LEGACY_TABLES,
          `${file} queries legacy table '${table}'`,
        ).not.toContain(table);
      }
    }
  });
});

// ── Shared files ──────────────────────────────────────────────────────────────

describe("SPEC-INPUT-003 vocab freeze guard — shared files (REQ-AUTO-005 inherited)", () => {
  it.each(VOCAB_FILES_SHARED)(
    "%s references no legacy premium tables",
    (root, file) => {
      let source: string;
      try {
        source = readFile(root, file);
      } catch {
        // File may not exist yet (pre-implementation); skip gracefully
        return;
      }
      for (const table of FORBIDDEN_LEGACY_TABLES) {
        expect(
          source,
          `${file} must not reference legacy table '${table}'`,
        ).not.toContain(table);
      }
    },
  );

  it.each(VOCAB_FILES_SHARED)(
    "%s references no deprecated premium types",
    (root, file) => {
      let source: string;
      try {
        source = readFile(root, file);
      } catch {
        return;
      }
      for (const type of FORBIDDEN_LEGACY_TYPES) {
        expect(
          source,
          `${file} must not reference deprecated type '${type}'`,
        ).not.toContain(type);
      }
    },
  );

  it.each(VOCAB_FILES_SHARED)(
    "%s imports no legacy admin UI module",
    (root, file) => {
      let source: string;
      try {
        source = readFile(root, file);
      } catch {
        return;
      }
      for (const moduleFragment of FORBIDDEN_LEGACY_MODULES) {
        expect(
          source,
          `${file} must not import legacy module '${moduleFragment}'`,
        ).not.toContain(moduleFragment);
      }
    },
  );

  it("Phase 4: reading/route.ts references no legacy premium tables", () => {
    // reading/route.ts was modified in Phase 4 — ensure it stays clean
    const source = readFile(webRoot, "src/app/api/premium/reading/route.ts");
    for (const table of FORBIDDEN_LEGACY_TABLES) {
      expect(
        source,
        `reading/route.ts must not reference '${table}'`,
      ).not.toContain(table);
    }
    for (const type of FORBIDDEN_LEGACY_TYPES) {
      expect(
        source,
        `reading/route.ts must not reference '${type}'`,
      ).not.toContain(type);
    }
    for (const moduleFragment of FORBIDDEN_LEGACY_MODULES) {
      expect(
        source,
        `reading/route.ts must not import '${moduleFragment}'`,
      ).not.toContain(moduleFragment);
    }
  });
});
