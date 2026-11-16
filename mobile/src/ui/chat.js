// Building blocks for Messages, chat, chat info and calls, matching the web's dm-*, tg-* and gi-* styles.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { groupToneOf, initialsOf, toneOf, VOICE_WAVE, WALLPAPERS } from "../live/format";
import { playableUri } from "../live/media";
import { Bell, ChevronLeft, ChevronRight, ClearIcon, ImageIcon, Pause, Pin, Play, Search } from "./chatIcons";
import { T, tap } from "./kit";
import { t } from "../lib/i18n";
import { openTab } from "../lib/tabs";

export const ONLINE = "#1cd14f";
export const MINE = ["#b13cf2", "#7b3df5", "#2f74f5"];

// Theme extras the web keeps in CSS variables.
export function useChatTheme() {
  const theme = useTheme();
  const dark = theme.scheme === "dark";
  return {
    ...theme,
    dark,
    them: dark ? "#262626" : "#ffffff",
    elev: dark ? "#2c2c2e" : "#ffffff",
    mark: dark ? "#3a3a3c" : "#ffffff",
    page: dark ? "#0b0b0b" : "#f7f7f7",
    pill: dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.72)",
  };
}

// ---------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------

const usable = (src) => Boolean(src) && !String(src).startsWith("data:image/svg");

export const Face = memo(function Face({ src, name, size = 46, online = false, dot, ring }) {
  const theme = useChatTheme();
  const [a, b] = toneOf(name);
  const dotSize = dot || Math.max(10, Math.round(size * 0.26));
  return (
    <View style={{ width: size, height: size }}>
      {usable(src) ? (
        <Image source={{ uri: src }} recyclingKey={src} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill }} contentFit="cover" transition={120} />
      ) : (
        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
          <T size={size * 0.4} weight="600" color="#fff">{initialsOf(name)}</T>
        </LinearGradient>
      )}
      {online ? <View style={{ position: "absolute", right: 0, bottom: 0, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: ONLINE, borderWidth: ring ?? 2.5, borderColor: theme.bg }} /> : null}
    </View>
  );
});

export const GroupAvatar = memo(function GroupAvatar({ photo, title, size = 46 }) {
  if (photo && (String(photo).startsWith("data:image") || String(photo).startsWith("file:") || String(photo).startsWith("http"))) {
    return <Image source={{ uri: photo }} recyclingKey={String(photo).slice(-32)} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={120} />;
  }
  const [a, b] = groupToneOf(photo, title);
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0.33, y: 0 }} end={{ x: 0.67, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
      <T size={Math.round(size * 0.37)} weight="700" color="#fff" style={{ letterSpacing: 0.2 }}>{initialsOf(title)}</T>
    </LinearGradient>
  );
});

export const ThreadFace = memo(function ThreadFace({ thread, size = 46, showOnline = true }) {
  const theme = useChatTheme();
  if (thread.photo || thread.group || (thread.members && thread.members.length > 1 && thread.name)) {
    return <GroupAvatar photo={thread.photo} title={thread.name} size={size} />;
  }
  if (thread.members && thread.members.length > 1) {
    const small = size * 0.72;
    return (
      <View style={{ width: size, height: size }}>
        <View style={{ position: "absolute", left: 0, top: 0 }}><Face src={thread.members[0].src} name={thread.members[0].name} size={small} /></View>
        <View style={{ position: "absolute", right: 0, bottom: 0, borderRadius: small, borderWidth: 2, borderColor: theme.bg }}><Face src={thread.members[1].src} name={thread.members[1].name} size={small - 4} /></View>
      </View>
    );
  }
  return <Face src={thread.src} name={thread.name} size={size} online={showOnline && thread.online} />;
});

// ---------------------------------------------------------------------------
// Voice messages
// ---------------------------------------------------------------------------

let playing = null;

export function VoiceBubble({ message, color = "#fff", knob = "rgba(255,255,255,0.22)" }) {
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);
  const player = useRef(null);
  const bars = message.wave?.length ? message.wave : VOICE_WAVE;
  const seconds = Math.max(1, Math.round(message.duration || 1));

  useEffect(() => () => {
    if (playing === player.current) playing = null;
    try { player.current?.remove(); } catch { /* released */ }
    player.current = null;
  }, [message.audio]);

  const toggle = useCallback(async () => {
    tap();
    if (on && player.current) {
      player.current.pause();
      setOn(false);
      return;
    }
    if (!player.current) {
      const uri = await playableUri(message.audio);
      if (!uri) return;
      const next = createAudioPlayer({ uri }, { updateInterval: 100 });
      next.addListener("playbackStatusUpdate", (status) => {
        const length = status.duration || seconds;
        setAt(length ? status.currentTime / length : 0);
        if (status.didJustFinish) {
          setOn(false);
          setAt(0);
          next.seekTo(0).catch(() => {});
        }
      });
      player.current = next;
    }
    if (playing && playing !== player.current) {
      try { playing.pause(); } catch { /* released */ }
    }
    playing = player.current;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.current.play();
    setOn(true);
  }, [on, message.audio, seconds]);

  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={on ? t("Metti in pausa il vocale") : t("Ascolta il vocale")} style={styles.voice}>
      <View style={[styles.voiceKnob, { backgroundColor: knob }]}>
        {on ? <Pause size={14} weight="fill" color={color} /> : <Play size={14} weight="fill" color={color} />}
      </View>
      <View style={styles.voiceWave}>
        {bars.map((height, index) => (
          <View key={index} style={{ width: 2.5, borderRadius: 99, height: `${Math.max(18, height)}%`, backgroundColor: color, opacity: index / bars.length < at ? 1 : 0.35 }} />
        ))}
      </View>
      <T size={11} color={color} style={{ opacity: 0.8, fontVariant: ["tabular-nums"] }}>{`0:${String(seconds).padStart(2, "0")}`}</T>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Wallpapers (radial tints + a faint doodle pattern, like the web's .dm-wall)
// ---------------------------------------------------------------------------

export function wallColors(id, theme) {
  const dark = theme.dark;
  switch (id) {
    case "night": return { base: "#1b2233", a: "rgba(90,120,255,0.28)", b: "rgba(180,90,255,0.22)", pattern: "stars", pill: "rgba(0,0,0,0.35)", pillText: "#e8ecf5", night: true };
    case "peach": return { base: dark ? "#3a2620" : "#fbe3d4", a: "rgba(255,160,120,0.45)", b: "rgba(255,120,160,0.35)" };
    case "mint": return { base: dark ? "#1a3029" : "#d9f2e6", a: "rgba(80,210,160,0.4)", b: "rgba(80,180,220,0.3)" };
    case "lavender": return { base: dark ? "#2a2340" : "#e7e0fa", a: "rgba(160,120,255,0.4)", b: "rgba(255,140,220,0.3)" };
    case "plain": return { base: theme.bg };
    default: return { base: dark ? "#111111" : "#f8f8f8", a: "rgba(0,149,246,0.09)", b: "rgba(163,52,250,0.09)", pattern: "doodle" };
  }
}

export const Wallpaper = memo(function Wallpaper({ id = "sky", style }) {
  const theme = useChatTheme();
  const wall = wallColors(id, theme);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: wall.base }, style]}>
      {wall.a ? (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="wa" cx="18%" cy="13%" r="55%">
              <Stop offset="0" stopColor={wall.a} />
              <Stop offset="0.5" stopColor={wall.a} />
              <Stop offset="1" stopColor={wall.a} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="wb" cx="86%" cy="76%" r="55%">
              <Stop offset="0" stopColor={wall.b} />
              <Stop offset="0.48" stopColor={wall.b} />
              <Stop offset="1" stopColor={wall.b} stopOpacity="0" />
            </RadialGradient>
            {wall.pattern === "doodle" ? (
              <Pattern id="wp" width="120" height="120" patternUnits="useriywaOnUse">
                <G fill="none" stroke="#888" strokeOpacity={0.1} strokeWidth={1.6} strokeLinecap="round">
                  <Path d="M18 22c6-6 14-6 20 0" />
                  <Circle cx="86" cy="26" r="7" />
                  <Path d="M70 70l8 8m0-8l-8 8" />
                  <Path d="M20 84c4 8 14 8 18 0" />
                  <Path d="M96 96l6-10 6 10z" />
                  <Circle cx="52" cy="50" r="2.5" />
                </G>
              </Pattern>
            ) : wall.pattern === "stars" ? (
              <Pattern id="wp" width="120" height="120" patternUnits="useriywaOnUse">
                <G fill="#fff" fillOpacity={0.18}>
                  <Circle cx="12" cy="18" r="1.2" />
                  <Circle cx="70" cy="40" r="0.9" />
                  <Circle cx="96" cy="92" r="1.3" />
                  <Circle cx="34" cy="86" r="0.8" />
                  <Circle cx="58" cy="110" r="1" />
                </G>
              </Pattern>
            ) : null}
          </Defs>
          <Rect width="100%" height="100%" fill="url(#wa)" />
          <Rect width="100%" height="100%" fill="url(#wb)" />
          {wall.pattern ? <Rect width="100%" height="100%" fill="url(#wp)" /> : null}
        </Svg>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

export function TypingDots({ color }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[0, 1, 2].map((index) => <Dot key={index} delay={index * 150} color={color} />)}
    </View>
  );
}

function Dot({ delay, color }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 360, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 360 }), withTiming(0, { duration: 480 })), -1));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 + v.value * 0.55, transform: [{ translateY: -4 * v.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]} />;
}

export function Spinner({ color, size = 14 }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(360, { duration: 700, easing: Easing.linear }), -1);
  }, [r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, borderTopColor: "transparent" }, style]} />;
}

export function Switch({ on }) {
  const theme = useChatTheme();
  const x = useSharedValue(on ? 20 : 0);
  useEffect(() => {
    x.value = withSpring(on ? 20 : 0, { damping: 18, stiffness: 260 });
  }, [on, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: on ? "#34c759" : theme.line, padding: 2 }}>
      <Animated.View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }, knob]} />
    </View>
  );
}

const TONES = { blue: "#2a7bf2", green: "#34c759", red: "#ff3b30", teal: "#30b0c7" };

export function ToggleCell({ on, icon: Icon, iconWeight = "fill", tone, label, onPress, first }) {
  const theme = useChatTheme();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.cell, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }, pressed && { backgroundColor: theme.fill }]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={[styles.ico, { backgroundColor: TONES[tone] }]}><Icon size={17} weight={iconWeight} color="#fff" /></View>
      <T size={15.5} weight="500" style={{ flex: 1 }}>{label}</T>
      <Switch on={on} />
    </Pressable>
  );
}

// A toast pill at the bottom of a page (the web's .gi-toast).
export function useFlash() {
  const [text, setText] = useState("");
  const timer = useRef(0);
  const flash = useCallback((value, ms = 1600) => {
    clearTimeout(timer.current);
    setText(value);
    timer.current = setTimeout(() => setText(""), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [text, flash];
}

export function Toast({ text, bottom = 28 }) {
  const insets = useSafeAreaInsets();
  const s = useSharedValue(0.8);
  useEffect(() => {
    if (text) s.value = withSpring(1, { damping: 12, stiffness: 300 });
    else s.value = 0.8;
  }, [text, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: Math.min(1, (s.value - 0.8) * 8) }));
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: bottom + insets.bottom, alignItems: "center", zIndex: 30 }}>
      <Animated.View style={[{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "rgba(20,20,22,0.9)" }, style]}>
        <T size={13.5} color="#fff">{text}</T>
      </Animated.View>
    </View>
  );
}

// Header of the pages under Messages: back, title + meta on the left, an action on the right.
export function SubHead({ title, meta, onBack, right, backIcon: BackIcon = ChevronLeft }) {
  const theme = useChatTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: theme.bg }}>
      <View style={styles.subHead}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Indietro")} hitSlop={8} onPress={() => { tap(); (onBack || (() => (router.canGoBack() ? router.back() : openTab("messages"))))(); }} style={({ pressed }) => [styles.roundIcon, pressed && { backgroundColor: theme.fill, transform: [{ scale: 0.88 }] }]}>
          <BackIcon size={25} weight="bold" color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
          <T size={15.5} weight="700" lines={1} style={{ letterSpacing: -0.15 }}>{title}</T>
          {meta ? <T size={12.5} color={theme.text2} lines={1}>{meta}</T> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function HeadAction({ title, onPress, disabled }) {
  const theme = useChatTheme();
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress(); }} hitSlop={8} style={{ paddingHorizontal: 10, opacity: disabled ? 0.4 : 1 }}>
      <T size={15} weight="600" color={theme.blue}>{title}</T>
    </Pressable>
  );
}

export function SearchField({ value, onChangeText, placeholder = t("Cerca"), autoFocus, style, onSubmit, height = 36 }) {
  const theme = useChatTheme();
  return (
    <View style={[{ height, borderRadius: 10, backgroundColor: theme.fill, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 }, style]}>
      <Search size={17} color={theme.text2} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.text2} autoFocus={autoFocus} onSubmitEditing={onSubmit} returnKeyType="search" autoCorrect={false} style={{ flex: 1, color: theme.text, fontSize: 15.5, paddingVertical: 0 }} />
      {value ? <Pressable onPress={() => onChangeText("")} hitSlop={8}><ClearIcon size={17} weight="fill" color={theme.text3} /></Pressable> : null}
    </View>
  );
}

// One row of a bottom action sheet (the web's .ps-sheet buttons).
export function SheetRow({ icon: Icon, label, onPress, danger, center, color }) {
  const theme = useChatTheme();
  const fg = color || (danger ? theme.red : center ? theme.text2 : theme.text);
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.sheetRow, center && { justifyContent: "center" }, pressed && { backgroundColor: theme.fill }]}>
      {Icon ? <Icon size={22} color={fg} /> : null}
      <T size={15} color={fg}>{label}</T>
    </Pressable>
  );
}

export function EmptyState({ icon: Icon, title, text }) {
  const theme = useChatTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 6 }}>
      {Icon ? <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: theme.text, alignItems: "center", justifyContent: "center", marginBottom: 8 }}><Icon size={36} weight="light" color={theme.text} /></View> : null}
      <T size={19} weight="700" style={{ textAlign: "center" }}>{title}</T>
      {text ? <T size={14} color={theme.text2} style={{ textAlign: "center", lineHeight: 19 }}>{text}</T> : null}
    </View>
  );
}

export function Hint({ children, center, style }) {
  const theme = useChatTheme();
  return <T size={13} color={theme.text2} style={[{ marginVertical: 8, marginHorizontal: INSET, lineHeight: 17.5, textAlign: center ? "center" : "left" }, style]}>{children}</T>;
}

// Per-chat settings shared by chat info and group info: notifications, pin, wallpaper.
export function ChatPrefs({ id }) {
  const store = useStore();
  const theme = useChatTheme();
  const flags = store.dmFlags?.[id] || {};
  const [walls, setWalls] = useState(false);
  const wall = flags.wall || "sky";
  const chev = useSharedValue(0);
  useEffect(() => {
    chev.value = withSpring(walls ? 90 : 0, { damping: 16, stiffness: 220 });
  }, [walls, chev]);
  const chevStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chev.value}deg` }] }));
  return (
    <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
      <ToggleCell first on={!flags.muted} icon={Bell} tone="red" label={t("Notifiche")} onPress={() => store.setDmFlag(id, "muted", !flags.muted)} />
      <ToggleCell on={Boolean(flags.pinned)} icon={Pin} tone="green" label={t("Fissa la chat")} onPress={() => store.setDmFlag(id, "pinned", !flags.pinned)} />
      <Pressable onPress={() => { tap(); setWalls((value) => !value); }} style={({ pressed }) => [styles.cell, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line, minHeight: 48 }, pressed && { backgroundColor: theme.fill }]}>
        <View style={[styles.ico, { backgroundColor: TONES.blue }]}><ImageIcon size={17} weight="fill" color="#fff" /></View>
        <T size={15.5} weight="500" style={{ flex: 1 }}>{t("Sfondo della chat")}</T>
        <T size={14.5} color={theme.text2}>{t(WALLPAPERS.find((item) => item.id === wall)?.it || "")}</T>
        <Animated.View style={chevStyle}><ChevronRight size={15} weight="bold" color={theme.text3} /></Animated.View>
      </Pressable>
      {walls ? (
        <View style={styles.walls}>
          {WALLPAPERS.map((item) => {
            const on = wall === item.id;
            return (
              <Pressable key={item.id} onPress={() => { tap(); store.setDmFlag(id, "wall", item.id); }} style={{ width: "31%", alignItems: "center", gap: 5 }}>
                <View style={[styles.wallTile, { borderColor: on ? theme.blue : theme.line, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}>
                  <Wallpaper id={item.id} />
                  <View style={[styles.wallBubble, { left: 8, top: "30%", width: "50%", backgroundColor: "#fff" }]} />
                  <LinearGradient colors={[MINE[0], MINE[2]]} style={[styles.wallBubble, { right: 8, top: "55%", width: "46%" }]} />
                </View>
                <T size={12.5} weight={on ? "600" : "400"} color={on ? theme.blue : theme.text2}>{t(item.it)}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  voice: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 188 },
  voiceKnob: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  voiceWave: { flex: 1, height: 26, flexDirection: "row", alignItems: "center", gap: 2 },
  cell: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingVertical: 4, paddingHorizontal: 14 },
  ico: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  subHead: { height: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 },
  roundIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10 },
  walls: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, paddingTop: 4, paddingHorizontal: 14, paddingBottom: 14 },
  wallTile: { width: "100%", aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden" },
  wallBubble: { position: "absolute", height: 12, borderRadius: 99 },
});
