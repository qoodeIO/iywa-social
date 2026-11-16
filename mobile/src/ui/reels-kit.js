// Reels: shared pieces for the Reels feed and the reel camera.
// Port of reelClips / ReelPlayer and the dark sheets from the web app (src/App.jsx).
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedStyle, useFrameCallback, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { router } from "expo-router";
import { WORKS } from "../data";
import { T } from "./kit";

// ---------------------------------------------------------------------------
// Constants copied from the web app
// ---------------------------------------------------------------------------
export const REEL_SPEEDS = [0.5, 1, 1.5, 2];
export const REEL_LENGTHS = [15, 30, 60, 90];
export const REEL_RECORD_SPEEDS = [0.5, 1, 2, 3];
export const REEL_EMOJI = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

export const STORY_MUSIC = [
  { title: "Forno lento", artist: "Giulia Neri" },
  { title: "Rosso di Prato", artist: "Adele Romano" },
  { title: "Impasto", artist: "Marta Colle" },
  { title: "Secondo fuoco", artist: "Leo Bassi" },
];

// The web uses CSS filter() strings. Native views have no CSS filters, so each look is
// rebuilt from colour layers blended over the picture (mixBlendMode), close to the web.
export const STORY_FILTERS = [
  { id: "normal", label: "Normale", layers: [] },
  { id: "alba", label: "Alba", layers: [{ color: "rgba(255,190,140,0.22)", mode: "soft-light" }, { color: "rgba(255,255,255,0.06)", mode: "screen" }] },
  { id: "nord", label: "Nord", layers: [{ color: "rgba(128,128,128,0.28)", mode: "saturation" }, { color: "rgba(110,160,255,0.2)", mode: "soft-light" }] },
  { id: "terra", label: "Terracotta", layers: [{ color: "rgba(200,105,55,0.32)", mode: "soft-light" }, { color: "rgba(150,90,40,0.12)", mode: "color" }] },
  { id: "pastello", label: "Pastello", layers: [{ color: "rgba(255,255,255,0.16)", mode: "screen" }, { color: "rgba(128,128,128,0.18)", mode: "saturation" }] },
  { id: "vivido", label: "Vivido", layers: [{ color: "rgba(128,128,128,0.32)", mode: "overlay" }, { color: "rgba(255,60,80,0.08)", mode: "soft-light" }] },
  { id: "miele", label: "Miele", layers: [{ color: "rgba(230,165,60,0.34)", mode: "soft-light" }, { color: "rgba(160,110,40,0.12)", mode: "color" }] },
  { id: "cinema", label: "Cinema", layers: [{ color: "rgba(128,128,128,0.35)", mode: "saturation" }, { color: "rgba(20,40,60,0.3)", mode: "soft-light" }, { color: "rgba(0,0,0,0.08)", mode: "normal" }] },
  { id: "noir", label: "Noir", layers: [{ color: "rgb(128,128,128)", mode: "saturation" }, { color: "rgba(128,128,128,0.35)", mode: "overlay" }] },
  { id: "polvere", label: "Polvere", layers: [{ color: "rgba(170,130,90,0.45)", mode: "color" }, { color: "rgba(255,255,255,0.08)", mode: "screen" }] },
];

// ---------------------------------------------------------------------------
// Helpers (same as the web)
// ---------------------------------------------------------------------------
export function parseLength(label, fallback = 12) {
  const [m, s] = String(label || "").split(":").map(Number);
  const total = (m || 0) * 60 + (s || 0);
  return total > 0 ? total : fallback;
}

export function clockLabel(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function reelClips(reel) {
  if (Array.isArray(reel.clips) && reel.clips.length) return reel.clips;
  if (reel.video) return [{ type: "video", src: reel.video, duration: parseLength(reel.length) }];
  return [{ type: "image", src: reel.image || reel.src, duration: parseLength(reel.length) }];
}

function parseCount(label) {
  const text = String(label ?? "").trim().toLowerCase().replace(",", ".");
  if (/k$/.test(text)) {
    const n = Number(text.slice(0, -1));
    return Number.isFinite(n) ? Math.round(n * 1000) : 0;
  }
  const n = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function tally(label, on) {
  if (!on) return label;
  return String(parseCount(label) + 1);
}

export function reelHidden(prefs, reel) {
  const name = reel?.name;
  if (name && ((prefs?.blocked || []).includes(name) || (prefs?.muted || []).includes(name))) return true;
  const blob = String(reel?.text || reel?.caption || "").toLowerCase();
  return (prefs?.hiddenWords || []).some((word) => {
    const needle = String(word || "").trim().toLowerCase();
    return needle && blob.includes(needle);
  });
}

// Reels I made (newest first), for the profile grid. They live in store.library with kind "reel",
// exactly like the web's space.library.
export function myReels(store) {
  return (store.library || []).filter((item) => item.kind === "reel");
}

// The still picture that stands for a reel (grid tiles, share messages).
export function reelPoster(reel) {
  return reel.src || reel.image || reelClips(reel).find((clip) => clip.type === "image")?.src || WORKS[0].src;
}

// Open the Reels tab on a given reel (profile grid, shared links).
export function openReel(id) {
  if (router.canDismiss()) router.dismissAll();
  router.replace({ pathname: "/reels", params: id ? { id } : {} });
}

export function openReelCamera() {
  router.push("/reel-camera");
}

// ---------------------------------------------------------------------------
// Filter look: colour layers blended over the picture.
// ---------------------------------------------------------------------------
export const FilterLayer = memo(function FilterLayer({ id, style }) {
  const look = STORY_FILTERS.find((item) => item.id === id);
  if (!look || !look.layers.length) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {look.layers.map((layer, index) => (
        <View key={index} style={[StyleSheet.absoluteFill, { backgroundColor: layer.color, mixBlendMode: layer.mode }]} />
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// ReelPlayer: plays a list of clips (video, or photo with Ken Burns motion) as one reel.
// One clock on the UI thread drives progress and the photo motion.
// ---------------------------------------------------------------------------
const KB = [
  [1.04, 1.22, 0, -0.03, 0, -0.02],
  [1.2, 1.04, 0.03, -0.01, 0.02, 0],
  [1.08, 1.2, -0.03, 0.03, 0.02, -0.03],
];

export function ReelPlayer({ clips, active, paused, rate = 1, muted, filter, loop = true, seekRef, progress, poster }) {
  const [index, setIndex] = useState(0);
  const [nonce, setNonce] = useState(0);
  const indexRef = useRef(0);
  const startRef = useRef(0);
  const safe = Math.min(index, clips.length - 1);
  const clip = clips[safe];
  const lengths = useMemo(() => clips.map((item) => Math.max(0.5, (item.duration || 3) / (item.rate || 1))), [clips]);
  const total = lengths.reduce((sum, value) => sum + value, 0);
  const befores = useMemo(() => lengths.map((_, i) => lengths.slice(0, i).reduce((sum, value) => sum + value, 0)), [lengths]);

  const offset = useSharedValue(0);
  const idx = useSharedValue(0);
  const ended = useSharedValue(false);
  const running = useSharedValue(false);
  const speed = useSharedValue(rate);
  const dims = useSharedValue({ w: 0, h: 0 });
  const meta = useSharedValue({ lengths, befores, total, video: clips.map((item) => item.type === "video") });

  useEffect(() => {
    meta.value = { lengths, befores, total, video: clips.map((item) => item.type === "video") };
  }, [lengths, befores, total, clips, meta]);
  useEffect(() => {
    speed.value = rate;
  }, [rate, speed]);
  useEffect(() => {
    running.value = Boolean(active && !paused);
  }, [active, paused, running]);

  const goTo = useCallback((at, from = 0) => {
    indexRef.current = at;
    idx.value = at;
    offset.value = from;
    ended.value = false;
    startRef.current = from * (clips[at]?.rate || 1);
    setIndex(at);
    setNonce((value) => value + 1);
  }, [clips, idx, offset, ended]);

  const advance = useCallback(() => {
    const at = indexRef.current;
    if (at + 1 < clips.length) goTo(at + 1);
    else if (loop) goTo(0);
  }, [clips.length, loop, goTo]);

  useEffect(() => {
    if (active) goTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (seekRef) {
    seekRef.current = (fraction) => {
      let target = Math.max(0, Math.min(0.999, fraction)) * total;
      let at = 0;
      while (at < lengths.length - 1 && target > lengths[at]) {
        target -= lengths[at];
        at += 1;
      }
      if (progress) progress.value = (befores[at] + target) / total;
      goTo(at, target);
    };
  }

  useFrameCallback((frame) => {
    "worklet";
    if (!running.value) return;
    const dt = Math.min(64, frame.timeSincePreviousFrame ?? 16) / 1000;
    const m = meta.value;
    const i = idx.value;
    const len = m.lengths[i] ?? 1;
    let next = offset.value + dt * speed.value;
    if (next >= len) {
      next = len;
      // Video clips end on the player's own event; photos end on this clock.
      if (!m.video[i] && !ended.value) {
        ended.value = true;
        scheduleOnRN(advance);
      }
    }
    offset.value = next;
    if (progress) progress.value = Math.min(1, (m.befores[i] + next) / m.total);
  });

  const playing = Boolean(active && !paused);
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        dims.value = { w: width, h: height };
      }}
    >
      {clip.type === "video" ? (
        <VideoClip
          key={`${safe}-${clip.src}`}
          clip={clip}
          playing={playing}
          rate={rate}
          muted={muted}
          loop={loop && clips.length === 1}
          nonce={nonce}
          startRef={startRef}
          offset={offset}
          onEnd={advance}
          poster={poster}
          filtered={filter && filter !== "normal"}
        />
      ) : (
        <ImageClip key={`${safe}-${clip.src}`} clip={clip} kb={safe % 3} len={lengths[safe]} offset={offset} dims={dims} />
      )}
      <FilterLayer id={filter} />
    </View>
  );
}

const ImageClip = memo(function ImageClip({ clip, kb, len, offset, dims }) {
  const look = KB[kb];
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, offset.value / len));
    const [s0, s1, x0, x1, y0, y1] = look;
    return {
      transform: [
        { scale: s0 + (s1 - s0) * t },
        { translateX: (x0 + (x1 - x0) * t) * dims.value.w },
        { translateY: (y0 + (y1 - y0) * t) * dims.value.h },
      ],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={{ uri: clip.src }} style={[StyleSheet.absoluteFill, clip.mirror ? styles.mirror : null]} contentFit="cover" transition={0} recyclingKey={clip.src} cachePolicy="memory-disk" />
    </Animated.View>
  );
});

function VideoClip({ clip, playing, rate, muted, loop, nonce, startRef, offset, onEnd, poster, filtered }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(clip.src, (p) => {
    p.loop = loop;
    p.muted = Boolean(muted);
    p.timeUpdateEventInterval = 0.1;
    p.playbackRate = rate * (clip.rate || 1);
  });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    player.loop = loop;
  }, [player, loop]);
  useEffect(() => {
    player.muted = Boolean(muted);
  }, [player, muted]);
  useEffect(() => {
    player.playbackRate = rate * (clip.rate || 1);
  }, [player, rate, clip.rate]);
  useEffect(() => {
    try {
      player.currentTime = startRef.current || 0;
    } catch {}
  }, [player, nonce, startRef]);
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing, nonce]);
  useEffect(() => {
    const time = player.addListener("timeUpdate", ({ currentTime }) => {
      if (player.playing) offset.value = currentTime / (clip.rate || 1);
    });
    const end = player.addListener("playToEnd", () => {
      if (!player.loop) onEndRef.current?.();
    });
    return () => {
      time.remove();
      end.remove();
    };
  }, [player, offset, clip.rate]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, clip.mirror ? styles.mirror : null]}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        surfaceType={filtered && Platform.OS === "android" ? "textureView" : undefined}
        onFirstFrameRender={() => setReady(true)}
      />
      {!ready && poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Toast (sv-toast) and the dark bottom sheet (rs-sheet / sc-tray)
// ---------------------------------------------------------------------------
export function Toast({ text, bottom = 110 }) {
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { bottom }]}>
      <Animated.View key={text} entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)} style={styles.toast}>
        <T size={13.5} weight="600" color="#fff" lines={1}>{text}</T>
      </Animated.View>
    </View>
  );
}

export function useToast(ms = 1400) {
  const [text, setText] = useState("");
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const note = useCallback((value) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), ms);
  }, [ms]);
  return [text, note];
}

const RISE = SlideInDown.duration(400).easing(Easing.bezier(0.32, 0.72, 0, 1));
const DROP = SlideOutDown.duration(240);

export function DarkSheet({ open, onClose, title, children, height, clear, bottomPad = 16, keyboard = false, tray = false }) {
  const drag = useSharedValue(0);
  useEffect(() => {
    if (open) drag.value = 0;
  }, [open, drag]);
  const pan = usePanGesture({
    onUpdate: (event) => {
      "worklet";
      drag.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      "worklet";
      if (drag.value > 90 || event.velocityY > 900) scheduleOnRN(onClose);
      else drag.value = withSpring(0, { damping: 22, stiffness: 260 });
    },
  });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  if (!open) return null;
  const panel = (
    <Animated.View entering={RISE} exiting={DROP} style={[tray ? styles.tray : styles.sheet, height ? { height } : null, { paddingBottom: bottomPad }, dragStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.grabZone}>
          <View style={styles.grab} />
          {title ? <T size={tray ? 16 : 15} weight="700" color="#fff" style={[styles.title, tray ? styles.trayTitle : null]}>{title}</T> : null}
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: clear ? "transparent" : "rgba(0,0,0,0.35)" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Chiudi" />
      </Animated.View>
      {keyboard ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.kav} pointerEvents="box-none">
          {panel}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.kav} pointerEvents="box-none">{panel}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mirror: { transform: [{ scaleX: -1 }] },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 30 },
  toast: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.92)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: { width: "100%", maxHeight: "72%", paddingTop: 8, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: "#1c1c1e" },
  tray: { width: "100%", height: "70%", paddingTop: 8, paddingHorizontal: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: "rgba(28,28,30,0.97)" },
  grabZone: { paddingBottom: 2 },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", marginBottom: 10 },
  title: { textAlign: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.12)" },
  trayTitle: { borderBottomWidth: 0, paddingBottom: 8 },
});
