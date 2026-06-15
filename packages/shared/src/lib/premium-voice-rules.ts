export const PREMIUM_COPY_BANNED_TERMS = [
  "효과적인",
  "효과적으로",
  "전략적으로",
] as const;

export const PREMIUM_COPY_ABSTRACT_NOUNS = [
  "가능성",
  "감정",
  "공기",
  "관계",
  "마음",
  "분위기",
  "생각",
  "세계",
  "의미",
  "이야기",
] as const;

export const PREMIUM_COPY_ABSTRACT_VERBS = [
  "켜지",
  "피어나",
  "물들",
  "물드",
  "스며들",
  "스며드",
] as const;

export function buildPremiumAntiSlopVoiceRules(): string {
  return [
    `금지어: ${PREMIUM_COPY_BANNED_TERMS.join(", ")}.`,
    "켜지다 / 피어나다 / 물들다 / 스며들다 + 추상명사 조합 절대 금지.",
    "어원이 불확실하거나 민간어원에 가까우면 생략.",
    "자연스럽지 않은 variations/examples/IPA는 채우지 말고 생략.",
  ].join("\n");
}

export function findPremiumCopySlop(text: string): string[] {
  const issues = new Set<string>();

  for (const term of PREMIUM_COPY_BANNED_TERMS) {
    if (text.includes(term)) {
      issues.add(`banned term "${term}"`);
    }
  }

  const nounPattern = PREMIUM_COPY_ABSTRACT_NOUNS.join("|");
  const verbPattern = PREMIUM_COPY_ABSTRACT_VERBS.join("|");
  const abstractPhrase = new RegExp(
    `(${nounPattern})(?:이|가|을|를|에|으로|처럼|도|만|은|는)?[^.!?\\n]{0,12}(${verbPattern})`,
    "g",
  );

  if (abstractPhrase.test(text)) {
    issues.add("abstract noun + decorative verb");
  }

  return [...issues];
}
