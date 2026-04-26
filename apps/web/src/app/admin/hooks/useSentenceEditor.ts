import { useState } from "react";
import type { Sentence } from "@inputenglish/shared";

export interface UseSentenceEditorReturn {
  sentences: Sentence[];
  setSentences: React.Dispatch<React.SetStateAction<Sentence[]>>;
  updateSentenceTime: (
    id: string,
    field: "startTime" | "endTime",
    value: number,
  ) => void;
  updateSentenceText: (
    id: string,
    field: "text" | "translation",
    value: string,
  ) => void;
  deleteSentence: (index: number) => void;
  splitSentence: (index: number, cursorPosition: number) => void;
  mergeWithPrevious: (index: number) => void;
}

const MANUAL_SYNC_GAP_SECONDS = 0.02;

/**
 * Custom hook for managing sentence list CRUD operations
 */
export function useSentenceEditor(
  initialSentences: Sentence[] = [],
): UseSentenceEditorReturn {
  const [sentences, setSentences] = useState<Sentence[]>(initialSentences);

  const updateSentenceTime = (
    id: string,
    field: "startTime" | "endTime",
    value: number,
  ) => {
    setSentences((prev) => {
      if (!Number.isFinite(value)) return prev;

      const index = prev.findIndex((s) => s.id === id);
      if (index < 0) return prev;

      const next = [...prev];
      const current = next[index];
      next[index] = { ...current, [field]: value };

      // When manually syncing the current sentence start, keep the previous
      // sentence end immediately before it for continuous playback.
      if (field === "startTime" && index > 0) {
        const previous = next[index - 1];
        const autoEnd = Math.max(
          previous.startTime,
          Number((value - MANUAL_SYNC_GAP_SECONDS).toFixed(2)),
        );
        next[index - 1] = { ...previous, endTime: autoEnd };
      }

      return next;
    });
  };

  const updateSentenceText = (
    id: string,
    field: "text" | "translation",
    value: string,
  ) => {
    setSentences((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const deleteSentence = (index: number) => {
    setSentences((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const splitSentence = (index: number, cursorPosition: number) => {
    setSentences((prev) => {
      const sentence = prev[index];
      if (!sentence) return prev;

      const text = sentence.text;
      const beforeText = text.substring(0, cursorPosition).trim();
      const afterText = text.substring(cursorPosition).trim();

      // Don't split if either part would be empty
      if (!beforeText || !afterText) return prev;

      const totalDuration = sentence.endTime - sentence.startTime;
      const splitRatio = cursorPosition / text.length;
      const splitTime = sentence.startTime + totalDuration * splitRatio;

      const firstSentence: Sentence = {
        ...sentence,
        text: beforeText,
        endTime: splitTime,
      };

      const secondSentence: Sentence = {
        id: crypto.randomUUID(),
        text: afterText,
        startTime: splitTime,
        endTime: sentence.endTime,
        translation: "",
        highlights: [],
      };

      const next = [...prev];
      next.splice(index, 1, firstSentence, secondSentence);
      return next;
    });
  };

  const mergeWithPrevious = (index: number) => {
    if (index <= 0) return; // Can't merge first sentence

    setSentences((prev) => {
      const current = prev[index];
      const previous = prev[index - 1];
      if (!current || !previous) return prev;

      const mergedSentence: Sentence = {
        ...previous,
        text: previous.text + " " + current.text,
        endTime: current.endTime,
        // Keep previous translation, append current if exists
        translation: previous.translation
          ? current.translation
            ? previous.translation + " " + current.translation
            : previous.translation
          : current.translation || "",
      };

      const next = [...prev];
      next.splice(index - 1, 2, mergedSentence);
      return next;
    });
  };

  return {
    sentences,
    setSentences,
    updateSentenceTime,
    updateSentenceText,
    deleteSentence,
    splitSentence,
    mergeWithPrevious,
  };
}
