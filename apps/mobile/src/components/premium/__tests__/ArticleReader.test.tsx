import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ArticleReader from "../ArticleReader";
import type { ReadingPiece } from "@inputenglish/shared";

const fixtureReadingPiece: ReadingPiece = {
  id: "reading-test-1",
  level: "B1",
  format: "nonfiction",
  topic: "Climate Change",
  body: "Climate change is a global challenge. Scientists report rising temperatures.",
  coveragePct: 96,
  validationStatus: "approved",
  sourceFacts: {},
  userId: "user-1",
  createdAt: "2026-06-15T00:00:00.000Z",
};

describe("ArticleReader", () => {
  it("renders article body and topic", () => {
    const { getByTestId, getByText } = render(
      <ArticleReader piece={fixtureReadingPiece} />,
    );

    expect(getByTestId("premium-article-reader")).toBeTruthy();
    expect(getByText("Climate Change")).toBeTruthy();
  });

  it("shows coverage percentage when available", () => {
    const { getByText } = render(<ArticleReader piece={fixtureReadingPiece} />);
    expect(getByText("Coverage: 96%")).toBeTruthy();
  });

  it("does not show coverage when coveragePct is null", () => {
    const piece: ReadingPiece = { ...fixtureReadingPiece, coveragePct: null };
    const { queryByText } = render(<ArticleReader piece={piece} />);
    expect(queryByText(/Coverage:/)).toBeNull();
  });

  it("calls onWordTap with lemma and the surrounding sentence context", () => {
    const onWordTap = jest.fn();
    const piece: ReadingPiece = {
      ...fixtureReadingPiece,
      body: "Scientists study climate data carefully",
    };
    const { getByTestId } = render(
      <ArticleReader piece={piece} onWordTap={onWordTap} />,
    );

    fireEvent.press(getByTestId("word-token-scientists"));
    expect(onWordTap).toHaveBeenCalledWith(
      "scientists",
      "Scientists study climate data carefully",
    );
  });

  it("resolves context to the exact tapped sentence for repeated words", () => {
    const onWordTap = jest.fn();
    const piece: ReadingPiece = {
      ...fixtureReadingPiece,
      body: "We study data. Researchers study harder. Students study too.",
    };
    const { getAllByTestId } = render(
      <ArticleReader piece={piece} onWordTap={onWordTap} />,
    );

    // Tap the third occurrence of "study" (last sentence). Position-based extraction
    // centers the ±1 window there, excluding the first sentence — a first-occurrence
    // search would have wrongly returned the opening sentence instead.
    fireEvent.press(getAllByTestId("word-token-study")[2]);
    const [, context] = onWordTap.mock.calls[0] as [string, string];
    expect(context).toContain("Students study too.");
    expect(context).not.toContain("We study data.");
  });

  it("does not render tappable words without onWordTap prop", () => {
    const { queryByTestId } = render(
      <ArticleReader piece={fixtureReadingPiece} />,
    );
    // No word-token testIDs without the callback
    expect(queryByTestId("word-token-climate")).toBeNull();
  });

  it("ignores single-letter tokens (not tappable)", () => {
    const onWordTap = jest.fn();
    const piece: ReadingPiece = {
      ...fixtureReadingPiece,
      body: "A big cat",
    };
    const { queryByTestId } = render(
      <ArticleReader piece={piece} onWordTap={onWordTap} />,
    );
    // 'a' is single char — should not be tappable
    expect(queryByTestId("word-token-a")).toBeNull();
    // 'big' and 'cat' are 3+ chars — should be tappable
    expect(queryByTestId("word-token-big")).toBeTruthy();
    expect(queryByTestId("word-token-cat")).toBeTruthy();
  });
});
