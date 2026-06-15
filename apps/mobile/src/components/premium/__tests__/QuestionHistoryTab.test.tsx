import React from "react";
import { render } from "@testing-library/react-native";
import type { AskedItem } from "@inputenglish/shared";
import QuestionHistoryTab from "../QuestionHistoryTab";

// Mock supabase client
const mockOrder = jest.fn();
const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock AuthContext
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: { id: "user-test-1" } })),
}));

const fixtureDbRows = [
  {
    id: "item-1",
    user_id: "user-test-1",
    source_type: "reading",
    source_ref: { type: "reading", pieceId: "piece-001" },
    highlight_text: "run the gamut",
    question: "What does this mean?",
    answer: "To cover the full range of something.",
    created_at: "2026-06-15T10:00:00.000Z",
  },
  {
    id: "item-2",
    user_id: "user-test-1",
    source_type: "segment",
    source_ref: { type: "segment", pieceId: "seg-002" },
    highlight_text: "put it bluntly",
    question: "How is this used?",
    answer: "Used to introduce a direct or frank statement.",
    created_at: "2026-06-14T10:00:00.000Z",
  },
];

describe("QuestionHistoryTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });
  });

  it("renders empty state when no asked items exist", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const { findByText } = render(<QuestionHistoryTab />);

    const emptyText = await findByText(
      /질문 기록이 없습니다|아직 질문이 없어요/,
    );
    expect(emptyText).toBeTruthy();
  });

  it("renders a list of asked items with highlight text and answer", async () => {
    mockOrder.mockResolvedValue({ data: fixtureDbRows, error: null });

    const { findByText } = render(<QuestionHistoryTab />);

    expect(await findByText("run the gamut")).toBeTruthy();
    expect(
      await findByText("To cover the full range of something."),
    ).toBeTruthy();
  });

  it("renders multiple items from history", async () => {
    mockOrder.mockResolvedValue({ data: fixtureDbRows, error: null });

    const { findByText } = render(<QuestionHistoryTab />);

    expect(await findByText("run the gamut")).toBeTruthy();
    expect(await findByText("put it bluntly")).toBeTruthy();
  });

  it("displays question text alongside answer", async () => {
    mockOrder.mockResolvedValue({ data: fixtureDbRows, error: null });

    const { findByText } = render(<QuestionHistoryTab />);

    expect(await findByText("What does this mean?")).toBeTruthy();
  });
});
