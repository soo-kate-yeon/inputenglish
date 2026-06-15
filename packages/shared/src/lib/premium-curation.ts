import type {
  LearningLevelBand,
  LearningProfile,
  PremiumSession,
} from "../types";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTextArray(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => normalizeText(value)).filter(Boolean);
}

function mapLevelToPremiumDifficulty(
  levelBand: LearningLevelBand | null,
): number {
  switch (levelBand) {
    case "beginner":
      return 1;
    case "basic":
      return 2;
    case "conversation":
      return 3;
    case "professional":
      return 4;
    default:
      return 3;
  }
}

function getPremiumSessionSearchText(session: PremiumSession): string {
  return [
    session.title,
    session.subtitle,
    session.description,
    session.channel_name,
    session.speaker_name,
    session.article?.title,
    session.article?.subtitle,
    session.article?.body,
    ...(session.interest_tags ?? []),
    ...session.expression_cards.map((card) => card.expression),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function scorePremiumSessionForProfile(
  session: PremiumSession,
  profile: LearningProfile,
): number {
  let score = 0;
  const searchText = getPremiumSessionSearchText(session);
  const preferredDifficulty = mapLevelToPremiumDifficulty(profile.level_band);

  if (session.difficulty_level) {
    const diff = Math.abs(session.difficulty_level - preferredDifficulty);
    score += diff === 0 ? 4 : diff === 1 ? 2 : 0;
  }

  if (
    session.speaker_name &&
    profile.preferred_speakers.some(
      (speaker) =>
        normalizeText(speaker) === normalizeText(session.speaker_name),
    )
  ) {
    score += 10;
  }

  if (
    session.source_type &&
    profile.preferred_source_types.includes(session.source_type)
  ) {
    score += 8;
  }

  if (session.genre && profile.preferred_genres.includes(session.genre)) {
    score += 8;
  }

  const sessionSituations = normalizeTextArray(session.speaking_situations);
  for (const situation of profile.preferred_situations) {
    if (sessionSituations.includes(normalizeText(situation))) {
      score += 12;
    }
  }

  const interestTags = normalizeTextArray(session.interest_tags);
  for (const tag of profile.focus_tags) {
    const normalizedTag = normalizeText(tag);
    if (!normalizedTag) continue;
    if (interestTags.includes(normalizedTag)) {
      score += 8;
    } else if (searchText.includes(normalizedTag)) {
      score += 3;
    }
  }

  if (session.status === "published") score += 2;
  return score;
}

export function selectDailyPremiumSession(
  sessions: PremiumSession[],
  profile: LearningProfile,
): PremiumSession | null {
  const candidates = sessions.filter(
    (session) => session.status === "published",
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((left, right) => {
    const scoreDiff =
      scorePremiumSessionForProfile(right, profile) -
      scorePremiumSessionForProfile(left, profile);
    if (scoreDiff !== 0) return scoreDiff;

    const leftPublished = left.published_on ?? "";
    const rightPublished = right.published_on ?? "";
    return rightPublished.localeCompare(leftPublished);
  })[0];
}
