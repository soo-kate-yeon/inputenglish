import { useState } from "react";
import {
  parseTranscriptToSentences,
  parseRawTextToSentences,
} from "@inputenglish/shared";
import type { TranscriptItem, Sentence } from "@inputenglish/shared";

export interface UseTranscriptFetchReturn {
  loading: boolean;
  error: string | null;
  fetchTranscript: (videoId: string) => Promise<string>;
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

  /**
   * Fetch transcript from YouTube and return raw text
   */
  const fetchTranscript = async (videoId: string): Promise<string> => {
    if (!videoId) {
      throw new Error("Please enter a valid YouTube URL first");
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ videoId });
      const res = await fetch(`/api/admin/transcript?${params.toString()}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch transcript");
      }

      const { transcript } = await res.json();

      // Convert transcript to raw text format
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
   * Parse raw script into sentences using transcript-parser logic
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
      // Fetch transcript data from API if available (for timestamps)
      let transcriptItems: TranscriptItem[] = [];

      console.log("🔍 [parseScript] Starting parse:", {
        videoId,
        rawScriptLength: rawScript.length,
        rawScriptPreview: rawScript.substring(0, 100),
      });

      if (videoId) {
        try {
          const params = new URLSearchParams({ videoId });
          const res = await fetch(`/api/admin/transcript?${params.toString()}`);
          if (res.ok) {
            const { transcript } = await res.json();
            // Map 'offset' to 'start' if API returns offset instead of start
            transcriptItems = transcript.map((item: any) => ({
              ...item,
              start: item.start ?? item.offset ?? 0,
            }));
            console.log(
              "✅ [parseScript] Fetched transcript items:",
              transcriptItems.length,
            );
          }
        } catch (err) {
          // If API fails, continue with manual parsing
          console.warn("Could not fetch transcript data, using manual parsing");
        }
      }

      // Parse using transcript-parser logic
      console.log(
        "📝 [parseScript] Using:",
        transcriptItems.length > 0
          ? "parseTranscriptToSentences"
          : "parseRawTextToSentences",
      );

      const parsedSentences =
        transcriptItems.length > 0
          ? parseTranscriptToSentences(transcriptItems)
          : parseRawTextToSentences(rawScript);

      console.log(
        "✅ [parseScript] Result:",
        parsedSentences.length,
        "sentences",
      );

      return parsedSentences;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Auto-translate all sentences using translation API
   */
  const autoTranslate = async (sentences: Sentence[]): Promise<Sentence[]> => {
    if (sentences.length === 0) {
      throw new Error("No sentences to translate");
    }

    if (
      !confirm(
        "Auto translate all sentences? This will overwrite existing translations.",
      )
    ) {
      throw new Error("Translation cancelled");
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
