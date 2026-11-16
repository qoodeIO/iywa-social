// One page of the Reels feed: port of the web's ReelSlide (src/App.jsx).
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { GestureDetector, useCompetingGestures, useExclusiveGestures, useLongPressGesture, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { AVATAR, personByHandle } from "../data";
import { tap } from "./kit";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Music, Pause, Play, Send, SoundOff, SoundOn } from "./reels-icons";
import { clockLabel, ReelPlayer, reelClips, tally } from "./reels-kit";

const SPRING_OUT = Easing.bezier(0.32, 0.72, 0, 1);
const POP = Easing.bezier(0.2, 0.9, 0.25, 1.3);
const SHADOW = { textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

// Caption with tappable @mentions and #hashtags (RichText on the web).
function Caption({ text, lines }) {
  const parts = String(text || "").split(/([@#][\p{L}\p{N}_.]*[\p{L}\p{N}_])/u);
  return (
    <Text numberOfLines={lines} style={[styles.caption, SHADOW]}>
      {parts.map((part, index) => {
        if (/^@[\w.]+$/.test(part)) {
          const person = personByHandle(part.slice(1));
          return <Text key={index} style={styles.tag} onPress={() => (person ? router.push(`/person/${person.handle}`) : part === "@forno.neri" ? router.push("/profile") : null)}>{part}</Text>;
        }
        if (/^#[\p{L}\p{N}_]+$/u.test(part)) return <Text key={index} style={styles.tag} onPress={() => router.push({ pathname: "/search", params: { q: part } })}>{part}</Text>;
        return part;
      })}
    </Text>
  );
}

function RailAct({ icon: Icon, label, on, liked, onPress, a11y }) {
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on) pop.value = withSequence(withTiming(1.25, { duration: 160, easing: POP }), withTiming(1, { duration: 240, easing: POP }));
  }, [on, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: Boolean(on) }} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.act, { transform: [{ scale: pressed ? 0.82 : 1 }] }]}>
      <Animated.View style={[styles.iconShadow, style]}>
        <Icon size={29} weight={on ? "fill" : "regular"} color={liked ? "#ff3040" : "#fff"} />
      </Animated.View>
      {label != null ? <Text style={[styles.actLabel, SHADOW]}>{label}</Text> : null}
    </Pressable>
  );
}

function Disc({ src, spinning, label, onPress }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(turn);
      turn.value = 0;
    }
  }, [spinning, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.disc}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={src} />
      </Animated.View>
    </Pressable>
  );
}

// Music label that scrolls like a marquee while the reel plays.
function Marquee({ text, running }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    if (running && width) x.value = withRepeat(withTiming(-(width + 28), { duration: 9000, easing: Easing.linear }), -1, false);
  }, [running, width, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.marquee}>
      <Animated.View style={[styles.marqueeRow, style]}>
        <Text numberOfLines={1} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.audioText}>{text}</Text>
        <Text numberOfLines={1} style={styles.audioText}>{text}</Text>
      </Animated.View>
    </View>
  );
}

// Double-tap heart that pops and floats away.
function Burst({ x, y, r }) {
  const scale = useSharedValue(0.3);
  const lift = useSharedValue(0);
  const alpha = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(withTiming(1.15, { duration: 180, easing: POP }), withTiming(0.95, { duration: 135 }), withTiming(1, { duration: 315 }), withTiming(0.8, { duration: 270 }));
    lift.value = withSequence(withTiming(0, { duration: 315 }), withTiming(-10, { duration: 315 }), withTiming(-86, { duration: 270, easing: Easing.in(Easing.quad) }));
    alpha.value = withSequence(withTiming(1, { duration: 180 }), withDelay(450, withTiming(0, { duration: 270 })));
  }, [scale, lift, alpha]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value, transform: [{ translateY: lift.value }, { rotate: `${r}deg` }, { scale: scale.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.burst, { left: x - 48, top: y - 48 }, style]}>
      <Heart size={96} weight="fill" color="#ff3040" />
    </Animated.View>
  );
}

// Play / pause flash in the middle (rs-flash).
function Flash({ kind }) {
  const alpha = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    alpha.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 450 }));
    scale.value = withSequence(withTiming(1, { duration: 150 }), withTiming(1.25, { duration: 450 }));
  }, [alpha, scale]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value, transform: [{ scale: scale.value }] }));
  const Icon = kind === "pause" ? Pause : Play;
  return (
    <Animated.View pointerEvents="none" style={[styles.center, style]}>
      <Icon size={32} weight="fill" color="#fff" />
    </Animated.View>
  );
}

function ReelSlide({ reel, active, near, width, height, top, muted, rate, captions, sheetOpen, commentsOpen, liked, saved, following, mine, showCounts, act }) {
  const [paused, setPaused] = useState(false);
  const [boost, setBoost] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [flash, setFlash] = useState(null);
  const [scrub, setScrub] = useState(null);
  const [barWidth, setBarWidth] = useState(width);
  const progress = useSharedValue(0);
  const seekRef = useRef(null);
  const shrink = useSharedValue(0);
  const hide = useSharedValue(0);
  const clips = reelClips(reel);
  const total = clips.reduce((sum, item) => sum + (item.duration || 3) / (item.rate || 1), 0);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setBoost(false);
      setExpanded(false);
      setScrub(null);
      progress.value = 0;
    }
  }, [active, progress]);

  useEffect(() => {
    if (active) act("boost", reel, boost);
  }, [active, boost, act, reel]);

  const opened = Boolean(commentsOpen && active);
  useEffect(() => {
    shrink.value = withTiming(opened ? 1 : 0, { duration: 420, easing: SPRING_OUT });
  }, [opened, shrink]);
  const chromeHidden = opened || boost || Boolean(scrub);
  useEffect(() => {
    hide.value = withTiming(chromeHidden ? 1 : 0, { duration: 220 });
  }, [chromeHidden, hide]);

  const mediaStyle = useAnimatedStyle(() => ({
    borderRadius: 20 * shrink.value,
    transform: [{ translateY: shrink.value * (top + 6) }, { scale: 1 - 0.6 * shrink.value }],
  }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - hide.value }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 1 - shrink.value }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, progress.value)) }] }));

  function togglePause() {
    setPaused((value) => {
      setFlash({ id: Date.now(), kind: value ? "play" : "pause" });
      return !value;
    });
  }
  function burst(x, y) {
    const id = Date.now();
    setHearts((prev) => [...prev, { id, x, y, r: Math.random() * 30 - 15 }]);
    setTimeout(() => setHearts((prev) => prev.filter((item) => item.id !== id)), 900);
    tap("medium");
    if (!liked) act("like", reel);
  }

  const single = useTapGesture({ runOnJS: true, maxDistance: 10, onActivate: () => togglePause() });
  const double = useTapGesture({ runOnJS: true, numberOfTaps: 2, maxDelay: 280, maxDistance: 20, onActivate: (event) => burst(event.x, event.y) });
  const hold = useLongPressGesture({
    runOnJS: true,
    minDuration: 320,
    maxDistance: 10,
    onActivate: () => {
      setBoost(true);
      tap();
    },
    onFinalize: () => setBoost(false),
  });
  const taps = useExclusiveGestures(double, single);
  const surface = useCompetingGestures(hold, taps);

  function scrubAt(x) {
    const fraction = Math.max(0, Math.min(1, x / Math.max(1, barWidth)));
    seekRef.current?.(fraction);
    progress.value = fraction;
    setScrub({ fraction, label: `${clockLabel(fraction * total)} / ${clockLabel(total)}` });
  }
  const scrubber = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onActivate: (event) => scrubAt(event.x),
    onUpdate: (event) => scrubAt(event.x),
    onFinalize: () => setScrub(null),
  });

  const caption = reel.caption || reel.text || "";
  const music = reel.music ? `${reel.music.title} · ${reel.music.artist}` : `${reel.audio || "Audio originale"} · ${reel.name}`;
  const poster = reel.src || reel.image;
  const handle = String(reel.handle || reel.name).replace(/^@/, "");

  return (
    <View style={{ width, height, backgroundColor: "#000", overflow: "hidden" }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.media, mediaStyle]}>
        {near ? (
          <ReelPlayer
            clips={clips}
            active={active}
            paused={paused || sheetOpen || Boolean(scrub)}
            rate={(boost ? 2 : 1) * rate}
            muted={muted || reel.muted}
            filter={reel.filter}
            seekRef={seekRef}
            progress={progress}
            poster={reel.videoOnly ? undefined : poster}
          />
        ) : (
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={poster} />
        )}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, scrimStyle]}>
        <LinearGradient colors={["rgba(0,0,0,0.3)", "transparent", "transparent", "rgba(0,0,0,0.6)"]} locations={[0, 0.16, 0.58, 1]} style={StyleSheet.absoluteFill} />
        {expanded ? (
          <Animated.View entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
            <LinearGradient colors={["rgba(0,0,0,0.3)", "transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.82)"]} locations={[0, 0.16, 0.4, 1]} style={StyleSheet.absoluteFill} />
          </Animated.View>
        ) : null}
      </Animated.View>

      <GestureDetector gesture={surface}>
        <View style={StyleSheet.absoluteFill} pointerEvents={opened ? "none" : "auto"} />
      </GestureDetector>

      {hearts.map((item) => <Burst key={item.id} x={item.x} y={item.y} r={item.r} />)}
      {flash ? <Flash key={flash.id} kind={flash.kind} /> : null}
      {paused && active && !flash ? (
        <Animated.View entering={FadeIn.delay(300).duration(260)} pointerEvents="none" style={styles.center}>
          <Play size={32} weight="fill" color="#fff" />
        </Animated.View>
      ) : null}
      {flash ? <FlashClear id={flash.id} onDone={() => setFlash(null)} /> : null}
      {boost ? (
        <Animated.View entering={FadeIn.duration(160)} pointerEvents="none" style={[styles.boost, { top: top + 60 }]}>
          <Text style={styles.boostText}>2× ▸▸</Text>
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents={chromeHidden ? "none" : "box-none"} style={[styles.rail, chromeStyle]}>
        <RailAct icon={Heart} a11y="Mi piace" on={liked} liked={liked} label={showCounts ? tally(reel.likes || "0", liked) : null} onPress={() => { tap(); act("like", reel); }} />
        <RailAct icon={MessageCircle} a11y="Commenti" label={showCounts ? reel.comments || "0" : null} onPress={() => act("comments", reel)} />
        <RailAct icon={Send} a11y="Condividi" label={showCounts ? "Invia" : null} onPress={() => act("share", reel)} />
        <RailAct icon={Bookmark} a11y="Salva" on={saved} onPress={() => { tap(); act("save", reel); }} />
        <RailAct icon={MoreHorizontal} a11y="Altro" onPress={() => act("more", reel)} />
        <Disc src={reel.avatar || AVATAR} spinning={active && !paused} label={music} onPress={() => act("audio", reel)} />
      </Animated.View>

      <Animated.View pointerEvents={chromeHidden ? "none" : "box-none"} style={[styles.meta, chromeStyle]}>
        <View style={styles.who}>
          <Pressable onPress={() => act("person", reel)} style={styles.whoTap}>
            <Image source={{ uri: reel.avatar || AVATAR }} style={styles.avatar} contentFit="cover" transition={150} recyclingKey={reel.avatar || AVATAR} />
            <Text numberOfLines={1} style={[styles.handle, SHADOW]}>{handle}</Text>
          </Pressable>
          {!mine ? (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: following }} onPress={() => { tap(); act("follow", reel); }} style={[styles.follow, following ? styles.followOn : null]}>
              <Text style={styles.followText}>{following ? "Segui già" : "Segui"}</Text>
            </Pressable>
          ) : null}
        </View>
        {caption ? (
          <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={{ maxWidth: "100%" }}>
            <Caption text={caption} lines={expanded ? 12 : 2} />
          </Pressable>
        ) : null}
        {captions && active ? <View style={styles.cc}><Text style={styles.ccText}>{caption}</Text></View> : null}
        <Pressable onPress={() => act("audio", reel)} style={styles.audio}>
          <Music size={13} color="#fff" />
          <Marquee text={music} running={active && !paused} />
        </Pressable>
      </Animated.View>

      <Animated.View pointerEvents={chromeHidden ? "none" : "box-none"} style={[styles.muteWrap, { top: top + 56 }, chromeStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Attiva audio" : "Silenzia"} hitSlop={8} onPress={() => act("mute", reel)} style={styles.mute}>
          {muted ? <SoundOff size={16} weight="fill" color="#fff" /> : <SoundOn size={16} weight="fill" color="#fff" />}
        </Pressable>
      </Animated.View>

      {!opened ? (
        <GestureDetector gesture={scrubber}>
          <View style={styles.barHit} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
            <View style={[styles.bar, scrub ? styles.barOn : null]}>
              <Animated.View style={[styles.barFill, barStyle]} />
            </View>
            {scrub ? (
              <View pointerEvents="none" style={[styles.time, { left: Math.max(8, Math.min(barWidth - 108, scrub.fraction * barWidth - 50)) }]}>
                <Text style={styles.timeText}>{scrub.label}</Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

// Clears the flash state once its animation is over.
function FlashClear({ id, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 620);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}

export default memo(ReelSlide);

const styles = StyleSheet.create({
  media: { overflow: "hidden", transformOrigin: "50% 0%" },
  caption: { color: "#fff", fontSize: 14, lineHeight: 19 },
  tag: { color: "#fff", fontWeight: "700" },
  act: { alignItems: "center", gap: 3 },
  iconShadow: { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  actLabel: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  disc: { width: 32, height: 32, marginTop: 4, borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: "#fff" },
  rail: { position: "absolute", zIndex: 3, right: 8, bottom: 26, alignItems: "center", gap: 14 },
  meta: { position: "absolute", zIndex: 3, left: 14, right: 64, bottom: 22, alignItems: "flex-start", gap: 9 },
  who: { flexDirection: "row", alignItems: "center", gap: 9, maxWidth: "100%" },
  whoTap: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#222" },
  handle: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 1 },
  follow: { height: 28, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", alignItems: "center", justifyContent: "center" },
  followOn: { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "transparent" },
  followText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cc: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.6)" },
  ccText: { color: "#fff", fontSize: 13 },
  audio: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 220, paddingLeft: 8, paddingRight: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden" },
  marquee: { flexShrink: 1, width: 182, overflow: "hidden" },
  marqueeRow: { flexDirection: "row", gap: 28, alignSelf: "flex-start" },
  audioText: { color: "#fff", fontSize: 12.5 },
  burst: { position: "absolute", zIndex: 5, width: 96, height: 96, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  center: { position: "absolute", zIndex: 4, top: "50%", left: "50%", width: 76, height: 76, marginTop: -38, marginLeft: -38, borderRadius: 38, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  boost: { position: "absolute", zIndex: 5, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.5)" },
  boostText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  muteWrap: { position: "absolute", zIndex: 3, right: 12 },
  mute: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  barHit: { position: "absolute", zIndex: 4, left: 0, right: 0, bottom: 0, height: 18, justifyContent: "flex-end" },
  bar: { width: "100%", height: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  barOn: { height: 6 },
  barFill: { ...StyleSheet.absoluteFill, backgroundColor: "#fff", transformOrigin: "0% 50%" },
  time: { position: "absolute", bottom: 24, width: 100, alignItems: "center", paddingVertical: 4, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.6)" },
  timeText: { color: "#fff", fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
