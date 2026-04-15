// @MX:NOTE: [AUTO] Wraps react-native-youtube-iframe with ref-based seekTo control.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-U-001, REQ-E-006, REQ-N-001, REQ-N-003, REQ-C-002
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import YoutubeIframe, { YoutubeIframeRef } from "react-native-youtube-iframe";
import { palette } from "../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PLAYER_HEIGHT = Math.floor(SCREEN_WIDTH * (9 / 16));

export interface YouTubePlayerHandle {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
}

interface YouTubePlayerProps {
  videoId: string;
  playing: boolean;
  playbackRate?: number;
  onReady?: () => void;
  onChangeState?: (state: string) => void;
  startSeconds?: number;
}

// @MX:ANCHOR: YouTubePlayer - sole YouTube playback component; seekTo called by loop and sentence tap
// @MX:REASON: [AUTO] fan_in >= 3: called by ListeningScreen loop handler, sentence tap, and background pause
const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  (
    {
      videoId,
      playing,
      playbackRate = 1,
      onReady,
      onChangeState,
      startSeconds,
    },
    ref,
  ) => {
    const playerRef = useRef<YoutubeIframeRef>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number, allowSeekAhead = true) => {
        playerRef.current?.seekTo(seconds, allowSeekAhead);
      },
      getCurrentTime: (): Promise<number> => {
        return playerRef.current?.getCurrentTime() ?? Promise.resolve(0);
      },
      getDuration: (): Promise<number> => {
        return playerRef.current?.getDuration() ?? Promise.resolve(0);
      },
    }));

    return (
      <View style={styles.container}>
        <YoutubeIframe
          ref={playerRef}
          height={PLAYER_HEIGHT}
          width={SCREEN_WIDTH}
          videoId={videoId}
          play={playing}
          playbackRate={playbackRate}
          onReady={onReady}
          onChangeState={onChangeState}
          initialPlayerParams={{
            start: startSeconds,
            controls: false,
            rel: false,
            iv_load_policy: 3,
            preventFullScreen: true,
            showClosedCaptions: false,
          }}
          webViewStyle={styles.webview}
        />
      </View>
    );
  },
);

YouTubePlayer.displayName = "YouTubePlayer";

export default YouTubePlayer;

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: palette.black,
  },
  webview: {
    opacity: 0.99,
  },
});
