import { SessionListItem } from "./api";

export interface FeedCategory {
  key: string;
  title: string;
  filter: (s: SessionListItem) => boolean;
}

export const FEED_CATEGORIES: FeedCategory[] = [
  {
    key: "podcast",
    title: "팟캐스트",
    filter: (s) => s.source_type === "podcast",
  },
  {
    key: "interview",
    title: "인터뷰",
    filter: (s) => s.source_type === "interview",
  },
  {
    key: "persuade",
    title: "설득하는 말하기",
    filter: (s) => s.speaking_function === "persuade",
  },
];
