import { jonnyKimPremiumSessionFixture } from "../fixtures/premium-session";
import { findPremiumCopySlop } from "@inputenglish/shared";

function collectFixtureCopy(): string[] {
  const fixture = jonnyKimPremiumSessionFixture;

  return [
    fixture.title,
    fixture.subtitle ?? "",
    fixture.description ?? "",
    fixture.article.title,
    fixture.article.subtitle ?? "",
    fixture.article.body,
    ...fixture.article.summary_bullets,
    ...fixture.transcript.flatMap((line) => [
      line.text,
      line.translation ?? "",
      line.delivery_note ?? "",
      line.analysis_note ?? "",
    ]),
    ...fixture.delivery_analysis.flatMap((item) => [
      item.intonation_note,
      item.style_note,
      item.coaching_note,
    ]),
    ...fixture.expression_cards.flatMap((card) => [
      card.expression,
      card.natural_meaning_ko,
      card.story,
      card.pronunciation.stress,
      card.pronunciation.linking,
      card.pronunciation.trap_ko,
      card.pronunciation.ipa,
      card.pronunciation.say_it_ko,
      card.pronunciation.drill,
      ...card.variations.flatMap((variation) => [
        variation.en,
        variation.when_ko,
      ]),
      card.saved_atoms.headword,
      card.saved_atoms.one_line_nuance_ko,
      card.saved_atoms.register_ko,
      ...card.saved_atoms.examples,
    ]),
    fixture.roleplay.title,
    fixture.roleplay.situation,
    fixture.roleplay.user_role,
    fixture.roleplay.partner_role,
    fixture.roleplay.analysis_reference_text ?? "",
    ...fixture.roleplay.turns.flatMap((turn) => [
      turn.line ?? "",
      turn.translation ?? "",
      turn.reference_text ?? "",
    ]),
  ].filter(Boolean);
}

describe("premium golden fixture", () => {
  it("contains the complete reviewed Phase 0 payload", () => {
    const fixture = jonnyKimPremiumSessionFixture;

    expect(fixture.article.reviewed).toBe(true);
    expect(fixture.delivery_analysis.length).toBeGreaterThanOrEqual(1);
    expect(fixture.delivery_analysis.every((item) => item.reviewed)).toBe(true);
    expect(
      fixture.expression_cards.some((card) => card.depth === "anchor"),
    ).toBe(true);
    expect(
      fixture.expression_cards.some((card) => card.depth === "support"),
    ).toBe(true);
    expect(fixture.expression_cards.every((card) => card.reviewed)).toBe(true);
    expect(fixture.roleplay.reviewed).toBe(true);
    expect(fixture.roleplay.turns.length).toBeGreaterThan(0);
    expect(fixture.reviewed).toBe(true);
  });

  it("uses a deterministic publish date for reproducible curation tests", () => {
    expect(jonnyKimPremiumSessionFixture.published_on).toBe("2026-06-14");
  });

  it("keeps support cards compressed with no variations", () => {
    const supportCards = jonnyKimPremiumSessionFixture.expression_cards.filter(
      (card) => card.depth === "support",
    );

    expect(supportCards.length).toBeGreaterThan(0);
    expect(supportCards.every((card) => card.variations.length === 0)).toBe(
      true,
    );
    expect(
      supportCards.every((card) => card.story.split("\n\n").length <= 2),
    ).toBe(true);
  });

  it("keeps every expression card field mapped and populated", () => {
    for (const card of jonnyKimPremiumSessionFixture.expression_cards) {
      expect(card.expression).toBeTruthy();
      expect(card.source_line).toBeTruthy();
      expect(card.timestamp).toBeTruthy();
      expect(card.natural_meaning_ko).toBeTruthy();
      expect(card.story).toBeTruthy();
      expect(card.pronunciation.stress).toBeTruthy();
      expect(card.pronunciation.linking).toBeTruthy();
      expect(card.pronunciation.trap_ko).toBeTruthy();
      expect(card.pronunciation.ipa).toBeTruthy();
      expect(card.pronunciation.say_it_ko).toBeTruthy();
      expect(card.pronunciation.drill).toBeTruthy();
      expect(card.saved_atoms.headword).toBeTruthy();
      expect(card.saved_atoms.one_line_nuance_ko).toBeTruthy();
      expect(card.saved_atoms.register_ko).toBeTruthy();
      expect(card.saved_atoms.examples.length).toBeGreaterThan(0);
    }
  });

  it("keeps reviewed golden copy free of premium anti-slop violations", () => {
    const issues = collectFixtureCopy().flatMap((copy) =>
      findPremiumCopySlop(copy).map((issue) => `${issue}: ${copy}`),
    );

    expect(issues).toEqual([]);
  });
});
