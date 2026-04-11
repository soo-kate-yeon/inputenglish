import { SessionListItem } from "./api";

// Backward-compat: used by collection/[key].tsx
export interface FeedCategory {
  key: string;
  title: string;
  filter: (s: SessionListItem) => boolean;
}

export const FEED_CATEGORIES: FeedCategory[] = [
  {
    key: "podcast",
    title: "\ud31f\uce90\uc2a4\ud2b8",
    filter: (s) => s.source_type === "podcast",
  },
  {
    key: "interview",
    title: "\uc778\ud130\ubdf0",
    filter: (s) => s.source_type === "interview",
  },
  {
    key: "public-speech",
    title: "\uacf5\uc801 \ub9d0\ud558\uae30",
    filter: (s) => s.source_type === "public-speech",
  },
  {
    key: "persuade",
    title: "\uc124\ub4dd\ud558\ub294 \ub9d0\ud558\uae30",
    filter: (s) => s.speaking_function === "persuade",
  },
];

// --- Chip Filters (new home feed) ---

export type ChipFilterType = "all" | "source_type" | "speaking_function";

export interface FeedChip {
  key: string;
  label: string;
  type: ChipFilterType;
  value?: string;
}

export const FEED_CHIPS: FeedChip[] = [
  { key: "all", label: "\uc804\uccb4", type: "all" },
  // Source types
  {
    key: "podcast",
    label: "\ud31f\uce90\uc2a4\ud2b8",
    type: "source_type",
    value: "podcast",
  },
  {
    key: "interview",
    label: "\uc778\ud130\ubdf0",
    type: "source_type",
    value: "interview",
  },
  {
    key: "public-speech",
    label: "\uacf5\uc801 \ub9d0\ud558\uae30",
    type: "source_type",
    value: "public-speech",
  },
  {
    key: "keynote",
    label: "\ud0a4\ub178\ud2b8",
    type: "source_type",
    value: "keynote",
  },
  {
    key: "panel",
    label: "\ud328\ub110 \ud1a0\ub860",
    type: "source_type",
    value: "panel",
  },
  { key: "demo", label: "\ub370\ubaa8", type: "source_type", value: "demo" },
  {
    key: "earnings-call",
    label: "\uc2e4\uc801 \ubc1c\ud45c",
    type: "source_type",
    value: "earnings-call",
  },
  // Speaking functions
  {
    key: "persuade",
    label: "\uc124\ub4dd",
    type: "speaking_function",
    value: "persuade",
  },
  {
    key: "explain-metric",
    label: "\uc9c0\ud45c \uc124\uba85",
    type: "speaking_function",
    value: "explain-metric",
  },
  {
    key: "summarize",
    label: "\uc694\uc57d",
    type: "speaking_function",
    value: "summarize",
  },
  {
    key: "propose",
    label: "\uc81c\uc548",
    type: "speaking_function",
    value: "propose",
  },
  {
    key: "disagree",
    label: "\ubc18\ubc15",
    type: "speaking_function",
    value: "disagree",
  },
  {
    key: "answer-question",
    label: "\uc9c8\ubb38 \ub2f5\ubcc0",
    type: "speaking_function",
    value: "answer-question",
  },
  {
    key: "hedge",
    label: "\uc644\uace1 \ud45c\ud604",
    type: "speaking_function",
    value: "hedge",
  },
  {
    key: "buy-time",
    label: "\uc2dc\uac04 \ubc8c\uae30",
    type: "speaking_function",
    value: "buy-time",
  },
  {
    key: "clarify",
    label: "\uba85\ud655\ud788 \ud558\uae30",
    type: "speaking_function",
    value: "clarify",
  },
  {
    key: "recover",
    label: "\uc2e4\uc218 \ud68c\ubcf5",
    type: "speaking_function",
    value: "recover",
  },
  {
    key: "build-rapport",
    label: "\uad00\uacc4 \ud615\uc131",
    type: "speaking_function",
    value: "build-rapport",
  },
  {
    key: "redirect",
    label: "\ud654\uc81c \uc804\ud658",
    type: "speaking_function",
    value: "redirect",
  },
];

// --- Difficulty Dropdown ---

export type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";

export const DIFFICULTY_OPTIONS: { key: DifficultyFilter; label: string }[] = [
  { key: "all", label: "\ub09c\uc774\ub3c4 \uc804\uccb4" },
  { key: "beginner", label: "\ucd08\uae09" },
  { key: "intermediate", label: "\uc911\uae09" },
  { key: "advanced", label: "\uace0\uae09" },
];
