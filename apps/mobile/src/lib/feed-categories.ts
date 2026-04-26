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
];

// --- Chip Filters (new home feed) ---

export type ChipFilterType = "all" | "source_type" | "genre";

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
  // Genres
  {
    key: "politics",
    label: "\uc815\uce58",
    type: "genre",
    value: "politics",
  },
  {
    key: "tech",
    label: "\ud14c\ud06c",
    type: "genre",
    value: "tech",
  },
  {
    key: "economy",
    label: "\uacbd\uc81c",
    type: "genre",
    value: "economy",
  },
  {
    key: "current-affairs",
    label: "\uc2dc\uc0ac",
    type: "genre",
    value: "current-affairs",
  },
  {
    key: "news",
    label: "\ub274\uc2a4",
    type: "genre",
    value: "news",
  },
  {
    key: "business",
    label: "\uc5c5\ubb34",
    type: "genre",
    value: "business",
  },
  {
    key: "entertainment",
    label: "\uc5d4\ud130\ud14c\uc778\uba3c\ud2b8",
    type: "genre",
    value: "entertainment",
  },
  {
    key: "lifestyle",
    label: "\ub77c\uc774\ud504\uc2a4\ud0c0\uc77c",
    type: "genre",
    value: "lifestyle",
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
