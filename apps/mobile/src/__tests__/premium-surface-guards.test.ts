import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { premiumDarkTokens } from "@inputenglish/design-tokens";
import { colors, font, premiumTheme, radius, shadow, spacing } from "@/theme";

const mobileRoot = path.resolve(__dirname, "../..");
const appRoot = path.join(mobileRoot, "app");
const srcRoot = path.join(mobileRoot, "src");

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = path.join(root, entry);
    const relativePath = path.relative(mobileRoot, absolutePath);

    if (
      relativePath.includes(`${path.sep}__tests__${path.sep}`) ||
      relativePath.includes(`${path.sep}__mocks__${path.sep}`)
    ) {
      return [];
    }

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) return collectSourceFiles(absolutePath);
    if (!absolutePath.endsWith(".ts") && !absolutePath.endsWith(".tsx")) {
      return [];
    }
    return [absolutePath];
  });
}

describe("premium surface migration guards", () => {
  it("keeps the home tab on the CI session surface, not the shorts feed", () => {
    const homeSource = readFileSync(
      path.join(appRoot, "(tabs)", "index.tsx"),
      "utf8",
    );

    // v1.3: the CI session card is the primary home surface (supersedes the
    // PREMIUM-001 curation card). fetchTodayPremiumSession may remain for the
    // server-side entitlement gate, but the rendered surface is the CI card.
    expect(homeSource).toContain("fetchTodayCiSession");
    expect(homeSource).toContain("ci-session-card");
    expect(homeSource).not.toContain("premium-session-card");
    expect(homeSource).not.toContain("FlatList");
    expect(homeSource).not.toContain("pagingEnabled");
    expect(existsSync(path.join(appRoot, "(tabs)", "explore.tsx"))).toBe(false);
    expect(existsSync(path.join(srcRoot, "components", "shorts"))).toBe(false);
    expect(
      existsSync(path.join(srcRoot, "contexts", "ShortsUIContext.tsx")),
    ).toBe(false);
  });

  it("does not reintroduce shorts quota or free-usage gating into mobile code", () => {
    // NOTE: FramingUI runtime (@framingui/react-native) is now the intended
    // design-system layer for the mobile app (SPEC-INPUT-001 UI rebuild), so it
    // is deliberately no longer banned here. The shorts/free-usage guards stay.
    const bannedTokens = [
      "SHORTS_FREE_DAILY_LIMIT",
      "canViewShort",
      "@/lib/free-usage",
    ];
    const violations = collectSourceFiles(appRoot)
      .concat(collectSourceFiles(srcRoot))
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return bannedTokens
          .filter((token) => source.includes(token))
          .map((token) => `${path.relative(mobileRoot, filePath)}: ${token}`);
      });

    expect(violations).toEqual([]);
  });

  it("keeps premium session reads behind the web premium API, not direct Supabase tables", () => {
    const bannedTokens = [
      "premium_sessions",
      "premium_expression_cards",
      "premium_articles",
      '.from("premium_',
      ".from('premium_",
    ];
    const violations = collectSourceFiles(appRoot)
      .concat(collectSourceFiles(srcRoot))
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return bannedTokens
          .filter((token) => source.includes(token))
          .map((token) => `${path.relative(mobileRoot, filePath)}: ${token}`);
      });
    const premiumApiSource = readFileSync(
      path.join(srcRoot, "lib", "premium-api.ts"),
      "utf8",
    );

    expect(violations).toEqual([]);
    expect(premiumApiSource).toContain("/api/premium/today");
    expect(premiumApiSource).toContain("/api/premium/sessions/");
    expect(premiumApiSource).toContain("getAuthHeaders");
    expect(premiumApiSource).toContain("process.env.EXPO_PUBLIC_WEB_API_URL");
    expect(premiumApiSource).toContain(
      "process.env.EXPO_PUBLIC_PREMIUM_FIXTURE_MODE",
    );
  });

  it("keeps premium entitlement writes behind the server sync API", () => {
    const violations = collectSourceFiles(appRoot)
      .concat(collectSourceFiles(srcRoot))
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return source.includes(".update({ plan")
          ? [`${path.relative(mobileRoot, filePath)}: direct users.plan update`]
          : [];
      });
    const revenueCatSource = readFileSync(
      path.join(srcRoot, "lib", "revenue-cat.ts"),
      "utf8",
    );

    expect(violations).toEqual([]);
    expect(revenueCatSource).toContain("/api/premium/entitlement/sync");
    expect(revenueCatSource).toContain("process.env.EXPO_PUBLIC_WEB_API_URL");
  });

  it("connects the mobile premium theme to shared design tokens", () => {
    expect(premiumTheme.colors).toBe(premiumDarkTokens.color);
    expect(premiumTheme.typography).toBe(premiumDarkTokens.typography);
    expect(premiumTheme.spacing).toBe(premiumDarkTokens.spacing);
    expect(premiumTheme.radius).toBe(premiumDarkTokens.radius);
    expect(premiumTheme.elevation).toBe(premiumDarkTokens.elevation);

    expect(colors.bgPremiumCard).toBe(premiumDarkTokens.color.card);
    expect(colors.textPremium).toBe(premiumDarkTokens.color.text);
    expect(spacing.lg).toBe(premiumDarkTokens.spacing.cardPadding);
    expect(radius["2xl"]).toBe(premiumDarkTokens.radius.card);
    expect(font.size["4xl"]).toBe(premiumDarkTokens.typography.heroSize);
    expect(shadow.lg.shadowRadius).toBe(
      premiumDarkTokens.elevation.premiumCard.shadowRadius,
    );
  });

  it("keeps the paywall on one premium monthly plan", () => {
    const paywallSource = readFileSync(
      path.join(mobileRoot, "app", "paywall.tsx"),
      "utf8",
    );

    expect(paywallSource).toContain("₩25,900 / 월");
    expect(paywallSource).toContain("7일 무료 체험");
    expect(paywallSource).not.toContain("quarterly");
    expect(paywallSource).not.toContain("month_3");
    expect(paywallSource).not.toContain("three_month");
    expect(paywallSource).not.toContain("annual");
    expect(paywallSource).not.toContain("yearly");
    expect(paywallSource).not.toContain("year_1");
  });
});
