import { useState } from "react";
import { parseRawTextToSentences } from "@inputenglish/shared";
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
      // Fetch transcript data from API if available (for timestamps only)
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
              "✅ [parseScript] Fetched transcript items for timestamps:",
              transcriptItems.length,
            );
          }
        } catch (err) {
          // If API fails, continue with manual parsing
          console.warn("Could not fetch transcript data, using manual parsing");
        }
      }

      // Always parse from the refined rawScript text
      // Use transcript items only to align timestamps if available
      console.log("📝 [parseScript] Parsing refined rawScript text");

      const parsedSentences = parseRawTextToSentences(rawScript);

      // If transcript items are available, try to align timestamps
      if (transcriptItems.length > 0 && parsedSentences.length > 0) {
        console.log(
          "⏱️ [parseScript] Aligning timestamps from transcript items",
        );
        const fullTranscriptText = transcriptItems
          .map((item) => item.text)
          .join(" ")
          .toLowerCase();

        let searchFrom = 0;
        for (const sentence of parsedSentences) {
          const sentenceWords = sentence.text.toLowerCase().split(/\s+/);
          const firstWord = sentenceWords[0];
          if (!firstWord) continue;

          // Find matching transcript item for sentence start
          for (let i = searchFrom; i < transcriptItems.length; i++) {
            const itemText = transcriptItems[i].text.toLowerCase();
            if (itemText.includes(firstWord)) {
              sentence.startTime = transcriptItems[i].start;
              // Find end time from last word
              const lastWord = sentenceWords[sentenceWords.length - 1];
              for (
                let j = i;
                j <
                Math.min(i + sentenceWords.length + 5, transcriptItems.length);
                j++
              ) {
                if (transcriptItems[j].text.toLowerCase().includes(lastWord)) {
                  sentence.endTime =
                    transcriptItems[j].start + transcriptItems[j].duration;
                  searchFrom = j + 1;
                  break;
                }
              }
              break;
            }
          }
        }
      }

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
