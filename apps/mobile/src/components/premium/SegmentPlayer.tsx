// @MX:NOTE: [AUTO] Wraps YouTubePlayer to play a VideoSegment with transcript sync and word tap-gloss.
// @MX:SPEC: SPEC-INPUT-001 - Phase 3, Task 3.6
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import YouTubePlayer, { YouTubePlayerHandle } from "../player/YouTubePlayer";
import {
  findPremiumActiveTranscriptLine,
  PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS,
} from "../../lib/premium-transcript-sync";
import type { VideoSegment } from "@inputenglish/shared";

// Adapt VideoSegment.transcript (TranscriptLine[]) to the PremiumTranscriptLine shape
// expected by findPremiumActiveTranscriptLine.
function toPremiumLines(
  lines: VideoSegment["transcript"],
): Array<{ id: string; text: string; startTime: number; endTime: number }> {
  return lines.map((l, i) => ({
    id: `seg-line-${i}`,
    text: l.text,
    startTime: l.start,
    endTime: l.end,
  }));
}

interface SegmentPlayerProps {
  segment: VideoSegment;
  /** Called when user taps a word; receives the lowercased lemma */
  onWordTap: (lemma: string) => void;
  onEnd: () => void;
}

const SegmentPlayer: React.FC<SegmentPlayerProps> = ({
  segment,
  onWordTap,
  onEnd,
}) => {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [playing, setPlaying] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const premiumLines = toPremiumLines(segment.transcript);

  // Start at the segment's start offset
  const handleReady = useCallback(() => {
    playerRef.current?.seekTo(segment.startTime);
    setPlaying(true);
  }, [segment.startTime]);

  // Poll current playback time to sync active transcript line and detect segment end
  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime === undefined) return;

      // Stop playback when we reach the end of the segment
      if (currentTime >= segment.endTime) {
        setPlaying(false);
        onEnd();
        return;
      }

      const activeLine = findPremiumActiveTranscriptLine(
        premiumLines,
        currentTime,
      );
      setActiveLineId(activeLine?.id ?? null);
    }, PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playing, segment.endTime, premiumLines, onEnd]);

  const handleWordTap = useCallback(
    (word: string) => {
      onWordTap(word.toLowerCase());
    },
    [onWordTap],
  );

  return (
    <View style={styles.container}>
      <YouTubePlayer
        ref={playerRef}
        videoId={segment.parentVideoId}
        playing={playing}
        startSeconds={segment.startTime}
        onReady={handleReady}
        onChangeState={(state) => {
          if (state === "ended") {
            setPlaying(false);
            onEnd();
          }
        }}
      />

      <ScrollView
        testID="segment-transcript"
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
      >
        {premiumLines.map((line) => (
          <TranscriptLineView
            key={line.id}
            text={line.text}
            isActive={line.id === activeLineId}
            onWordTap={handleWordTap}
          />
        ))}
      </ScrollView>
    </View>
  );
};

interface TranscriptLineViewProps {
  text: string;
  isActive: boolean;
  onWordTap: (word: string) => void;
}

const TranscriptLineView: React.FC<TranscriptLineViewProps> = ({
  text,
  isActive,
  onWordTap,
}) => {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <View style={[styles.line, isActive && styles.activeLine]}>
      {words.map((word, i) => (
        <TouchableOpacity
          key={`${word}-${i}`}
          onPress={() => onWordTap(word)}
          activeOpacity={0.6}
        >
          <Text style={[styles.word, isActive && styles.activeWord]}>
            {word}{" "}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default SegmentPlayer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  transcript: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transcriptContent: {
    paddingVertical: 12,
    gap: 8,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeLine: {
    backgroundColor: "rgba(255, 200, 0, 0.15)",
  },
  word: {
    fontSize: 16,
    color: "#1a1a1a",
    lineHeight: 24,
  },
  activeWord: {
    color: "#000000",
    fontWeight: "600",
  },
});
