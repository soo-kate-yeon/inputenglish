// @MX:NOTE: [AUTO] Lightweight English lemmatizer for coverage matching.
// @MX:SPEC: SPEC-INPUT-002 / SPEC-INPUT-003 — fixes coverage gate over-rejection.
// @MX:REASON: The frequency list is lemma-based, but tokenizers emit surface forms.
//   Without lemmatization, inflections ("investing", "costs") miss the lemma set and
//   inflate unknownRatio, pushing every generated reading to "too-hard" → rejected.

/**
 * Returns candidate base forms for an English token (lowercased), always including
 * the token itself, for matching against a lemma-based word set.
 *
 * Conservative regular-inflection stripping: plural / 3rd-person (-s, -es, -ies),
 * past (-ed, -ied), and gerund (-ing) — including doubled-consonant ("running"→"run")
 * and silent-e ("making"→"make") forms.
 *
 * This is NOT a full morphological lemmatizer. It deliberately over-generates
 * candidates because matching is gated by an actual word set, so spurious candidates
 * rarely collide with real words. Short tokens are left untouched to avoid false hits.
 */
export function lemmaCandidates(token: string): string[] {
  const w = token.toLowerCase();
  const out = new Set<string>([w]);
  const add = (candidate: string): void => {
    if (candidate.length >= 2) out.add(candidate);
  };

  // ── plural / 3rd-person singular ────────────────────────────────────────────
  if (w.endsWith("ies") && w.length >= 5) add(w.slice(0, -3) + "y"); // studies → study
  if (w.endsWith("es") && w.length >= 4) {
    add(w.slice(0, -2)); // boxes → box
    add(w.slice(0, -1)); // outlines → outline
  }
  if (w.endsWith("s") && !w.endsWith("ss") && w.length >= 3) {
    add(w.slice(0, -1)); // costs → cost
  }

  // ── past tense / participle ──────────────────────────────────────────────────
  if (w.endsWith("ied") && w.length >= 5) add(w.slice(0, -3) + "y"); // studied → study
  if (w.endsWith("ed") && w.length >= 4) {
    add(w.slice(0, -2)); // worked → work
    add(w.slice(0, -1)); // used → use
    add(w.slice(0, -3)); // stopped → stop (doubled consonant)
  }

  // ── gerund / present participle ──────────────────────────────────────────────
  if (w.endsWith("ing") && w.length >= 5) {
    add(w.slice(0, -3)); // investing → invest
    add(w.slice(0, -3) + "e"); // making → make
    add(w.slice(0, -4)); // running → run (doubled consonant)
  }

  return [...out];
}

/**
 * True if `token` or any of its lemma candidates is present in `known`.
 * Use instead of `known.has(token)` when matching surface-form tokens against a
 * lemma-based set.
 */
export function hasKnownWord(known: Set<string>, token: string): boolean {
  for (const candidate of lemmaCandidates(token)) {
    if (known.has(candidate)) return true;
  }
  return false;
}
