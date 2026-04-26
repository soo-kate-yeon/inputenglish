import type {
  Genre,
  PlaybookMasteryStatus,
  PracticeMode,
  SessionSourceType,
} from "@inputenglish/shared";

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "고급",
};

export const SOURCE_TYPE_LABELS: Record<SessionSourceType, string> = {
  keynote: "키노트",
  demo: "데모",
  "earnings-call": "실적 발표",
  podcast: "팟캐스트",
  interview: "인터뷰",
  panel: "패널 토크",
  "public-speech": "공적 말하기",
  "talk-show": "토크쇼",
  vlog: "브이로그",
  "scripted-drama": "드라마/영화",
};

export const GENRE_LABELS: Record<Genre, string> = {
  politics: "정치",
  tech: "테크",
  economy: "경제",
  "current-affairs": "시사",
  news: "뉴스",
  business: "업무",
  entertainment: "엔터테인먼트",
  lifestyle: "라이프스타일",
};

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  "slot-in": "패턴 끼워 넣기",
  "role-play": "상황 응답",
  "my-briefing": "내 브리핑 만들기",
  bookmark: "북마크",
};

export const PLAYBOOK_MASTERY_LABELS: Record<PlaybookMasteryStatus, string> = {
  new: "새로 저장",
  practicing: "연습 중",
  mastered: "익숙함",
};

export const PRACTICE_MODE_BADGE_LABELS: Record<PracticeMode, string> = {
  "slot-in": "패턴",
  "role-play": "응답",
  "my-briefing": "브리핑",
  bookmark: "북마크",
};
