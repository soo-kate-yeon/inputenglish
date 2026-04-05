// @MX:NOTE: [AUTO] expo-speech wrapper for English-only TTS (SPEC-MOBILE-011).
// Dialog lines are in English; language is always 'en-US'.
// Gracefully degrades when native ExpoSpeech module is unavailable (dev builds / Expo Go).
import { useState, useCallback } from "react";

// Lazy-load expo-speech to avoid crashing when native module is not compiled in.
let Speech: typeof import("expo-speech") | null = null;
try {
  Speech = require("expo-speech");
} catch {
  // Native module not available — TTS buttons will be disabled.
}

export interface UseTTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isAvailable: boolean;
}

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isAvailable = Speech !== null;

  const speak = useCallback((text: string) => {
    if (!Speech) return;
    Speech.speak(text, {
      language: "en-US",
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  const stop = useCallback(() => {
    if (!Speech) return;
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isAvailable };
}
