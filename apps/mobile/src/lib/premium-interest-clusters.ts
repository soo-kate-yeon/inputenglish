import type {
  Genre,
  SessionSourceType,
  SpeakingSituation,
} from "@inputenglish/shared";

const SOURCE_TYPES_BY_SITUATION: Partial<
  Record<SpeakingSituation, SessionSourceType[]>
> = {
  "presentation-meeting": ["public-speech", "keynote", "demo"],
  "school-work": ["public-speech", "interview", "podcast"],
  interview: ["interview", "panel"],
  "self-intro-smalltalk": ["interview", "podcast", "talk-show"],
  "daily-chat": ["podcast", "talk-show", "vlog"],
  "friendship-romance": ["podcast", "talk-show", "scripted-drama"],
  "service-industry": ["interview", "podcast"],
};

const SOURCE_TYPES_BY_GENRE: Partial<Record<Genre, SessionSourceType[]>> = {
  business: ["public-speech", "keynote", "interview"],
  tech: ["keynote", "demo", "interview"],
  economy: ["podcast", "panel", "earnings-call"],
  "current-affairs": ["public-speech", "panel", "podcast"],
  news: ["panel", "podcast", "interview"],
  politics: ["public-speech", "interview", "panel"],
  entertainment: ["interview", "talk-show", "podcast"],
  lifestyle: ["podcast", "vlog", "talk-show"],
};

export function inferPremiumPreferredSourceTypes(input: {
  situations: SpeakingSituation[];
  genres: Genre[];
}): SessionSourceType[] {
  const ordered = [
    ...input.situations.flatMap(
      (situation) => SOURCE_TYPES_BY_SITUATION[situation] ?? [],
    ),
    ...input.genres.flatMap((genre) => SOURCE_TYPES_BY_GENRE[genre] ?? []),
  ];

  return [...new Set(ordered)];
}
