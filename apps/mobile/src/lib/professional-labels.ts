import type {
  PlaybookMasteryStatus,
  PracticeMode,
  SessionRoleRelevance,
  SessionSourceType,
  SessionSpeakingFunction,
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
};

export const SPEAKING_FUNCTION_LABELS: Record<SessionSpeakingFunction, string> =
  {
    persuade: "설득하기",
    "explain-metric": "지표 설명",
    summarize: "핵심 요약",
    hedge: "조심스럽게 말하기",
    disagree: "부드럽게 반대하기",
    propose: "제안하기",
    "answer-question": "질문 답변",
    "buy-time": "시간 벌기",
    clarify: "확인/되묻기",
    recover: "말 실수 수습",
    "build-rapport": "관계 형성",
    redirect: "주제 전환",
  };

export const ROLE_RELEVANCE_LABELS: Record<SessionRoleRelevance, string> = {
  engineer: "엔지니어",
  pm: "PM",
  designer: "디자이너",
  founder: "창업가",
  marketer: "마케터",
};

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  "slot-in": "패턴 끼워 넣기",
  "role-play": "상황 응답",
  "my-briefing": "내 브리핑 만들기",
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
};
