import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildExpressionCardPrompt,
  buildPremiumAntiSlopVoiceRules,
  PREMIUM_EXPRESSION_PROMPT_VERSION,
} from "@inputenglish/shared";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(__dirname, "../../..");
const repoRoot = path.resolve(webRoot, "../..");

describe("premium web surface guards", () => {
  it("keeps prompt.md aligned with the typed expression-card prompt builder", () => {
    const promptSource = readFileSync(path.join(repoRoot, "prompt.md"), "utf8");
    const builtPrompt = buildExpressionCardPrompt({
      expression: "I had the privilege of",
      sourceLine: "I had the privilege of working with this team.",
      timestamp: "00:05",
      speaker: "Source speaker",
      videoContext: "The speaker gives credit to the people around him.",
      transcriptExcerpt: "I had the privilege of working with this team.",
      userProfile: "회의와 이메일에서 격 있게 공을 돌리고 싶은 직장인",
      depth: "support",
    });
    const requiredFragments = [
      "storytelling-v2",
      "TARGET_EXPRESSION",
      "SOURCE_LINE",
      "TRANSCRIPT_EXCERPT",
      "USER_PROFILE",
      "natural_meaning_ko",
      "pronunciation",
      "say_it_ko",
      "drill",
      "variations",
      "saved_atoms",
      "one_line_nuance_ko",
      "depth가 support일 경우",
      "variations",
      "[]",
    ];
    const runtimeFragments = [
      "I had the privilege of",
      "Source speaker",
      "depth:              support",
      "natural_meaning_ko",
      "say_it_ko",
      "saved_atoms",
      "depth가 support일 경우",
      "variations: []",
    ];

    expect(PREMIUM_EXPRESSION_PROMPT_VERSION).toBe("storytelling-v2");
    requiredFragments.forEach((fragment) => {
      expect(promptSource).toContain(fragment);
    });
    runtimeFragments.forEach((fragment) => {
      expect(builtPrompt).toContain(fragment);
    });
    buildPremiumAntiSlopVoiceRules()
      .split("\n")
      .forEach((rule) => {
        expect(promptSource).toContain(rule);
        expect(builtPrompt).toContain(rule);
      });
  });

  it("keeps public subscription terms aligned to the single premium plan", () => {
    const termsSource = readFileSync(
      path.join(webRoot, "src", "app", "terms", "page.tsx"),
      "utf8",
    );

    expect(termsSource).toContain("single auto-renewable subscription plan");
    expect(termsSource).toContain("KRW 25,900/month");
    expect(termsSource).toContain("7-day free trial");
    expect(termsSource).not.toContain("KRW 9,900");
    expect(termsSource).not.toContain("KRW 24,900");
    expect(termsSource).not.toContain("KRW 89,000");
    expect(termsSource).not.toContain("3-Month");
    expect(termsSource).not.toContain("Annual");
  });

  it("keeps the legacy admin landing page pointed at the premium console", () => {
    const adminSource = readFileSync(
      path.join(webRoot, "src", "app", "admin", "page.tsx"),
      "utf8",
    );

    expect(adminSource).toContain('redirect("/admin/premium")');
    expect(adminSource).not.toContain("SessionCreator");
  });

  it("keeps the premium admin transcript workspace connected to load, translate, sync, and draft attach controls", () => {
    const premiumAdminSource = readFileSync(
      path.join(webRoot, "src", "app", "admin", "premium", "page.tsx"),
      "utf8",
    );

    expect(premiumAdminSource).toContain(
      'fetch("/api/admin/premium/transcript"',
    );
    expect(premiumAdminSource).not.toContain("/api/admin/transcript");
    expect(premiumAdminSource).toContain('fetch("/api/admin/translate"');
    expect(premiumAdminSource).toContain("translateTranscriptLines");
    expect(premiumAdminSource).toContain("shiftPremiumTranscriptTiming");
    expect(premiumAdminSource).toContain("attachPremiumTranscriptToDraft");
    expect(premiumAdminSource).toContain("YouTubePlayer");
    expect(premiumAdminSource).toContain("onTimeUpdate={setCurrentVideoTime}");
    expect(premiumAdminSource).toContain("value={line.startTime}");
    expect(premiumAdminSource).toContain("value={line.endTime}");
    expect(premiumAdminSource).toContain('value={line.translation ?? ""}');
    expect(premiumAdminSource).not.toContain("SessionCreator");
    expect(
      existsSync(
        path.join(
          webRoot,
          "src",
          "app",
          "admin",
          "hooks",
          "useTranscriptFetch.ts",
        ),
      ),
    ).toBe(false);
  });

  it("keeps premium Supabase tables behind server entitlement instead of public RLS reads", () => {
    const migrationSource = readFileSync(
      path.join(
        repoRoot,
        "supabase",
        "migrations",
        "20260614000100_add_premium_sessions.sql",
      ),
      "utf8",
    );
    const lockMigrationSource = readFileSync(
      path.join(
        repoRoot,
        "supabase",
        "migrations",
        "20260614000300_lock_premium_rls.sql",
      ),
      "utf8",
    );

    expect(migrationSource).toContain(
      "ALTER TABLE public.premium_sessions ENABLE ROW LEVEL SECURITY;",
    );
    expect(migrationSource).toContain(
      "ALTER TABLE public.premium_expression_cards ENABLE ROW LEVEL SECURITY;",
    );
    expect(migrationSource).toContain(
      "ALTER TABLE public.premium_articles ENABLE ROW LEVEL SECURITY;",
    );
    expect(migrationSource).toContain(
      "Premium content is read through the server web API only",
    );
    expect(migrationSource).not.toContain(
      "Published premium sessions are readable",
    );
    expect(migrationSource).not.toContain(
      "Published premium expression cards are readable",
    );
    expect(migrationSource).not.toContain(
      "Published premium articles are readable",
    );
    expect(migrationSource).not.toMatch(
      /CREATE\s+POLICY[\s\S]+ON\s+public\.premium_(sessions|expression_cards|articles)[\s\S]+FOR\s+SELECT/i,
    );
    expect(lockMigrationSource).toContain(
      'DROP POLICY IF EXISTS "Published premium sessions are readable."',
    );
    expect(lockMigrationSource).toContain(
      'DROP POLICY IF EXISTS "Published premium expression cards are readable."',
    );
    expect(lockMigrationSource).toContain(
      'DROP POLICY IF EXISTS "Published premium articles are readable."',
    );
  });
});
