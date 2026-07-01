import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const typesFile = readFileSync(path.resolve(__dirname, "../index.ts"), "utf8");

describe("SPEC-WEB-001 Phase 0 shared types", () => {
  it("adds Subscription, Course, WeeklyPrep types", () => {
    expect(typesFile).toContain("export interface Subscription");
    expect(typesFile).toContain("export interface Course");
    expect(typesFile).toContain("export interface WeeklyPrep");
  });

  it("extends Channel with legalStatus without removing existing fields", () => {
    expect(typesFile).toContain("export interface Channel");
    expect(typesFile).toContain("legalStatus");
    // Existing fields must survive (regression guard).
    expect(typesFile).toContain("levelBand: VocabBand");
    expect(typesFile).toContain("visualAccentTags: string[]");
  });

  it("extends VideoSegment with scriptClean/subtitleDependencyStage/il without removing existing fields", () => {
    expect(typesFile).toContain("export interface VideoSegment");
    expect(typesFile).toContain("scriptClean");
    expect(typesFile).toContain("subtitleDependencyStage");
    // Existing bandCoverage (4-band) field must survive untouched (regression guard).
    expect(typesFile).toContain("bandCoverage: Record<VocabBand, number>");
  });

  it("extends LearningProfile with ilIndex/vocabEstimate/selectedCourse while keeping level_band", () => {
    expect(typesFile).toContain("export interface LearningProfile");
    expect(typesFile).toContain("ilIndex");
    expect(typesFile).toContain("vocabEstimate");
    expect(typesFile).toContain("selectedCourse");
    // level_band (4-band) must coexist, not be removed (spec.md grounding note).
    expect(typesFile).toContain("level_band: LearningLevelBand | null");
  });

  it("keeps VocabBand as the existing 4-value enum (must coexist with IL float)", () => {
    expect(typesFile).toContain(
      'export type VocabBand = "beginner" | "basic" | "conversation" | "professional";',
    );
  });
});
