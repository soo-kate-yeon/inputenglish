// @MX:NOTE: [AUTO] Custom YouTube WebView player with direct imperative control.
// Uses same baseUrl/userAgent as react-native-youtube-iframe to avoid embed errors.
// Mirrors web's direct player.playVideo()/pauseVideo()/setPlaybackRate() pattern.
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { palette } from "../../theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PLAYER_HEIGHT = Math.floor(SCREEN_WIDTH * (9 / 16));

// Same values as react-native-youtube-iframe to pass YouTube embed validation
const BASE_URL =
  "https://lonelycpp.github.io/react-native-youtube-iframe/iframe_v2.html";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36";

export interface StudyPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setSpeed: (rate: number) => void;
}

interface StudyPlayerProps {
  videoId: string;
  startSeconds?: number;
  onReady?: (duration: number) => void;
  onStateChange?: (state: "playing" | "paused" | "ended" | "buffering") => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const YT_STATE_MAP: Record<
  number,
  "paused" | "ended" | "playing" | "paused" | "buffering"
> = {
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
};

function buildHtml(videoId: string, startSeconds: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{margin:0;padding:0}html,body{width:100%;height:100%;background:#000;overflow:hidden}#player{width:100%;height:100%}</style>
</head><body>
<div id="player"></div>
<script>
var tag=document.createElement('script');
tag.src='https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

var player,timerId;

function onYouTubeIframeAPIReady(){
  player=new YT.Player('player',{
    videoId:'${videoId}',
    width:'100%',
    height:'100%',
    playerVars:{
      controls:0,
      modestbranding:1,
      rel:0,
      playsinline:1,
      start:${startSeconds},
      disablekb:1,
      fs:0,
      iv_load_policy:3,
      origin:'${BASE_URL}'
    },
    events:{
      onReady:function(){
        post({type:'ready',duration:player.getDuration()});
      },
      onStateChange:function(e){
        post({type:'state',data:e.data});
        if(e.data===1){startTimer();}else{stopTimer();}
      },
      onError:function(e){
        post({type:'error',code:e.data});
      }
    }
  });
}

function startTimer(){
  stopTimer();
  timerId=setInterval(function(){
    if(player&&player.getCurrentTime){
      post({type:'time',ct:player.getCurrentTime(),dur:player.getDuration()});
    }
  },100);
}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null;}}

function post(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}

document.addEventListener('message',handleMsg);
window.addEventListener('message',handleMsg);
function handleMsg(e){
  try{
    var c=JSON.parse(e.data);
    if(!player)return;
    if(c.t==='play')player.playVideo();
    if(c.t==='pause')player.pauseVideo();
    if(c.t==='seek')player.seekTo(c.s,true);
    if(c.t==='speed')player.setPlaybackRate(c.r);
  }catch(ex){}
}
</script>
</body></html>`;
}

const StudyPlayer = forwardRef<StudyPlayerHandle, StudyPlayerProps>(
  (
    { videoId, startSeconds = 0, onReady, onStateChange, onTimeUpdate },
    ref,
  ) => {
    const webViewRef = useRef<WebView>(null);

    const send = useCallback((msg: object) => {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    }, []);

    useImperativeHandle(ref, () => ({
      play: () => send({ t: "play" }),
      pause: () => send({ t: "pause" }),
      seekTo: (s: number) => send({ t: "seek", s }),
      setSpeed: (r: number) => send({ t: "speed", r }),
    }));

    const handleMessage = useCallback(
      (e: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === "ready") onReady?.(msg.duration ?? 0);
          else if (msg.type === "state") {
            const s = YT_STATE_MAP[msg.data as number];
            if (s) onStateChange?.(s);
          } else if (msg.type === "time")
            onTimeUpdate?.(msg.ct ?? 0, msg.dur ?? 0);
          else if (msg.type === "error")
            console.warn("[StudyPlayer] YT error:", msg.code);
        } catch {}
      },
      [onReady, onStateChange, onTimeUpdate],
    );

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: buildHtml(videoId, startSeconds), baseUrl: BASE_URL }}
          style={styles.webview}
          originWhitelist={["*"]}
          userAgent={USER_AGENT}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          allowsFullscreenVideo={false}
        />
      </View>
    );
  },
);

StudyPlayer.displayName = "StudyPlayer";
export default StudyPlayer;

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: PLAYER_HEIGHT,
    backgroundColor: palette.black,
  },
  webview: { flex: 1, opacity: 0.99 },
});
