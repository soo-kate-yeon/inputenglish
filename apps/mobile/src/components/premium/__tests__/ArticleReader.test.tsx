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

  it("calls onWordTap with lemma when a word is tapped", () => {
    const onWordTap = jest.fn();
    const piece: ReadingPiece = {
      ...fixtureReadingPiece,
      body: "Scientists study climate data carefully",
    };
    const { getByTestId } = render(
      <ArticleReader piece={piece} onWordTap={onWordTap} />,
    );

    fireEvent.press(getByTestId("word-token-scientists"));
    expect(onWordTap).toHaveBeenCalledWith("scientists");
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
