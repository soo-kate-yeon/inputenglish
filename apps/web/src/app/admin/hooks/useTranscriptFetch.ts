import { useRef, useState } from "react";
import {
  parseRawTextToSentences,
  parseTranscriptToSentences,
} from "@inputenglish/shared";
import type { TranscriptItem, Sentence } from "@inputenglish/shared";

export interface TimeRange {
  startTime?: number; // seconds
  endTime?: number; // seconds
}

export interface UseTranscriptFetchReturn {
  loading: boolean;
  error: string | null;
  fetchTranscript: (videoId: string, timeRange?: TimeRange) => Promise<string>;
  parseScript: (
    rawScript: string,
    videoId: string | null,
  ) => Promise<Sentence[]>;
  autoTranslate: (sentences: Sentence[]) => Promise<Sentence[]>;
}

/**
 * Custom hook for managing YouTube transcript operations
 */
export function useTranscriptFetch(): UseTranscriptFetchReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cachedTranscriptItems = useRef<TranscriptItem[]>([]);

  /**
   * Fetch transcript from YouTube and return raw text.
   * Transcript items (with timestamps) are cached for parseScript.
   */
  const fetchTranscript = async (
    videoId: string,
    timeRange?: TimeRange,
  ): Promise<string> => {
    if (!videoId) {
      throw new Error("Please enter a valid YouTube URL first");
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ videoId });
      if (timeRange?.startTime !== undefined) {
        params.set("startTime", String(timeRange.startTime));
      }
      if (timeRange?.endTime !== undefined) {
        params.set("endTime", String(timeRange.endTime));
      }
      const res = await fetch(`/api/admin/transcript?${params.toString()}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch transcript");
      }

      const { transcript } = await res.json();

      // Cache transcript items with timestamps for later use in parseScript
      cachedTranscriptItems.current = transcript.map((item: any) => ({
        ...item,
        start: item.start ?? item.offset ?? 0,
      }));

      // Convert transcript to raw text format for editing
      const rawText = transcript.map((item: any) => item.text).join(" ");

      return rawText;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Parse raw script into sentences.
   * Uses cached transcript items from fetchTranscript for timestamps.
   */
  const parseScript = async (
    rawScript: string,
    videoId: string | null,
  ): Promise<Sentence[]> => {
    if (!rawScript.trim()) {
      throw new Error(
        "No script to parse. Please fetch transcript or paste script first.",
      );
    }

    setLoading(true);
    setError(null);

    try {
      const transcriptItems = cachedTranscriptItems.current;

      console.log("🔍 [parseScript] Starting parse:", {
        cachedItems: transcriptItems.length,
        rawScriptLength: rawScript.length,
      });

      let parsedSentences: Sentence[];

      if (transcriptItems.length > 0) {
        // Use cached transcript items directly — perfect timestamps
        // Apply refine logic (remove >>) to items before parsing
        const refinedItems = transcriptItems
          .map((item) => ({
            ...item,
            text: item.text.replace(/>>/g, "").trim(),
          }))
          .filter((item) => item.text.length > 0);

        parsedSentences = parseTranscriptToSentences(refinedItems);
        console.log(
          "✅ [parseScript] Used transcript items directly:",
          parsedSentences.length,
          "sentences",
        );
      } else {
        // Fallback: manual paste without timestamps
        parsedSentences = parseRawTextToSentences(rawScript);
        console.log(
          "✅ [parseScript] Parsed raw text (no timestamps):",
          parsedSentences.length,
          "sentences",
        );
      }

      return parsedSentences;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Translate selected sentences using translation API
   */
  const autoTranslate = async (sentences: Sentence[]): Promise<Sentence[]> => {
    if (sentences.length === 0) {
      throw new Error("No sentences to translate");
    }

    setLoading(true);
    setError(null);

    try {
      const texts = sentences.map((s) => s.text);
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentences: texts }),
      });

      if (!res.ok) throw new Error("Translation failed");

      const { translations } = await res.json();

      return sentences.map((s, idx) => ({
        ...s,
        translation: translations[idx] || "",
      }));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchTranscript,
    parseScript,
    autoTranslate,
  };
}
