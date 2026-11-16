// Small pieces shared by Search, profiles, Pensieri and the shop tools: the web app's
// ps-sheet action sheet, the toast, the empty state, sliding tab bars and the explore mosaic.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { Avatar, Sheet, T, tap } from "./kit";
import { Carousel, Heart, MessageCircle, Play, Send, SquarePlay } from "./icons-profile";
import { t } from "../lib/i18n";

const W = Dimensions.get("window").width;

// Bottom action sheet: icon rows, a red row for destructive actions, "Annulla" at the end.
export function ActionSheet({ open, onClose, items = [], hint, cancel }) {
  const theme = useTheme();
  return (
    <Sheet open={open} onClose={onClose}>
      {hint ? <T size={14} color={theme.text2} style={{ textAlign: "center", paddingHorizontal: 12, paddingBottom: 8 }}>{hint}</T> : null}
      {items.filter(Boolean).map((item) => (
        <Pressable
          key={item.label}
          disabled={item.disabled}
          onPress={() => { tap(); item.onPress?.(); }}
          style={({ pressed }) => [styles.sheetRow, { backgroundColor: pressed ? theme.fill : "transparent", opacity: item.disabled ? 0.4 : 1 }]}
        >
          {item.icon ? <item.icon size={22} color={item.danger ? theme.red : theme.text} /> : null}
          <T size={15} color={item.danger ? theme.red : theme.text}>{item.label}</T>
        </Pressable>
      ))}
      <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetRow, { justifyContent: "center", backgroundColor: pressed ? theme.fill : "transparent" }]}>
        <T size={15} color={theme.text2}>{cancel ?? t("Annulla")}</T>
      </Pressable>
    </Sheet>
  );
}

// A short message that floats up from the bottom and fades away.
export function useToast() {
  const [text, setText] = useState("");
  const timer = useRef(0);
  const show = useCallback((value) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 1600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [text ? <Toast key={text} text={text} /> : null, show];
}

function Toast({ text }) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(fade, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 260 }).start();
  }, [fade]);
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 72, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      <T size={14} weight="600" color="#fff">{text}</T>
    </Animated.View>
  );
}

export function IgEmpty({ icon: Icon, title, text, children }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 6, paddingVertical: 44, paddingHorizontal: 24 }}>
      {Icon ? (
        <View style={[styles.emptyRing, { borderColor: theme.text }]}>
          <Icon size={30} color={theme.text} weight="light" />
        </View>
      ) : null}
      <T size={20} weight="700" style={{ textAlign: "center", letterSpacing: -0.4 }}>{title}</T>
      {text ? <T size={14} color={theme.text2} style={{ textAlign: "center" }}>{text}</T> : null}
      {children}
    </View>
  );
}

// Tabs with a bar that slides under the active one (native driver).
export function SlideTabs({ tabs, active, onChange, height = 44, size = 14, iconSize = 24, dim = "text2", style }) {
  const theme = useTheme();
  const [width, setWidth] = useState(W);
  const x = useRef(new Animated.Value(active)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: active, useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 }).start();
  }, [active, x]);
  const cell = width / Math.max(1, tabs.length);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[{ flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line, backgroundColor: theme.bg }, style]}>
      {tabs.map((tab, index) => {
        const on = index === active;
        const color = on ? theme.text : theme[dim];
        return (
          <Pressable key={tab.key || tab.label} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }} onPress={() => { if (!on) tap(); onChange(index); }} style={{ flex: 1, height, alignItems: "center", justifyContent: "center" }}>
            {tab.icon ? <tab.icon size={iconSize} color={color} weight={on ? "fill" : "regular"} /> : <T size={size} weight="600" color={color}>{tab.label}</T>}
          </Pressable>
        );
      })}
      <Animated.View style={{ position: "absolute", left: 0, bottom: -StyleSheet.hairlineWidth, width: cell, height: 1.5, backgroundColor: theme.text, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, cell] }) }] }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Explore mosaic: blocks of five, one tall tile alternating right and left.
// ---------------------------------------------------------------------------
export const GAP = 2;
export const CELL = (W - GAP * 2) / 3;
export const CELL_H = Math.round(CELL * (4 / 3));
export const BLOCK_H = CELL_H * 2 + GAP;

export function toBlocks(posts, limit) {
  const shown = limit ? posts.slice(0, limit) : posts;
  const mosaic = posts.length >= 5;
  const blocks = [];
  if (!mosaic) {
    for (let i = 0; i < shown.length; i += 3) blocks.push({ key: `r${i}`, row: true, items: shown.slice(i, i + 3) });
    return blocks;
  }
  for (let i = 0; i < shown.length; i += 5) {
    const index = i / 5;
    blocks.push({ key: `b${index}-${shown[i].id}`, side: index % 2 ? "left" : "right", items: shown.slice(i, i + 5) });
  }
  return blocks;
}

export const ExploreTile = memo(function ExploreTile({ post, width, height, onOpen, onPeek }) {
  const theme = useTheme();
  const multi = Array.isArray(post.images) && post.images.length > 1;
  const reel = post.kind === "reel";
  return (
    <Pressable
      accessibilityLabel={reel ? t("Reel, {name}", { name: post.name }) : t("Post, {name}", { name: post.name })}
      onPress={() => onOpen(post)}
      onLongPress={() => { tap("medium"); onPeek?.(post); }}
      onPressOut={() => onPeek?.(null)}
      delayLongPress={380}
      style={({ pressed }) => ({ width, height, backgroundColor: theme.fill, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <Image source={{ uri: post.image }} recyclingKey={post.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
      {reel ? <View style={styles.badge}><SquarePlay size={18} weight="fill" color="#fff" /></View> : multi ? <View style={styles.badge}><Carousel size={18} weight="fill" color="#fff" /></View> : null}
      {reel && post.views ? (
        <View style={styles.views}>
          <Play size={13} weight="fill" color="#fff" />
          <T size={13} weight="600" color="#fff" style={styles.shadow}>{post.views}</T>
        </View>
      ) : null}
    </Pressable>
  );
});

export const ExploreBlock = memo(function ExploreBlock({ block, onOpen, onPeek }) {
  if (block.row) {
    return (
      <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
        {block.items.map((post, index) => <ExploreTile key={`${post.id}-${index}`} post={post} width={CELL} height={CELL_H} onOpen={onOpen} onPeek={onPeek} />)}
      </View>
    );
  }
  const [first, ...rest] = block.items;
  const tall = <ExploreTile key={`t-${first.id}`} post={first} width={CELL} height={BLOCK_H} onOpen={onOpen} onPeek={onPeek} />;
  const small = (
    <View key="small" style={{ width: CELL * 2 + GAP, flexDirection: "row", flexWrap: "wrap", gap: GAP, alignContent: "flex-start" }}>
      {rest.map((post, index) => <ExploreTile key={`${post.id}-${index}`} post={post} width={CELL} height={CELL_H} onOpen={onOpen} onPeek={onPeek} />)}
    </View>
  );
  return (
    <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP, height: rest.length > 2 || block.items.length === 5 ? BLOCK_H : BLOCK_H }}>
      {block.side === "left" ? [tall, small] : [small, tall]}
    </View>
  );
});

// A plain (non-virtualized) mosaic for short lists inside a ScrollView.
export function ExploreGrid({ posts, onOpen, onPeek, limit }) {
  const blocks = toBlocks(posts, limit);
  return <View>{blocks.map((block) => <ExploreBlock key={block.key} block={block} onOpen={onOpen} onPeek={onPeek} />)}</View>;
}

// Long-press preview, Instagram's peek.
export function PeekCard({ post }) {
  const theme = useTheme();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (post) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 240 }).start();
    }
  }, [post, pop]);
  if (!post) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.peekBack]}>
      <Animated.View style={[styles.peekCard, { backgroundColor: theme.bg, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <View style={styles.peekHead}>
          <Avatar src={post.avatar || post.src} size={30} />
          <T size={14} weight="600">{String(post.handle || post.name).replace(/^@/, "")}</T>
        </View>
        <Image source={{ uri: post.image || post.src }} style={{ width: "100%", aspectRatio: 4 / 5 }} contentFit="cover" />
        <View style={styles.peekFoot}>
          <Heart size={24} color={theme.text} />
          <MessageCircle size={24} color={theme.text} />
          <Send size={24} color={theme.text} />
          <T size={13} weight="600" style={{ marginLeft: "auto" }}>{post.likes ? t("{n} Mi piace", { n: post.likes }) : ""}</T>
        </View>
      </Animated.View>
    </View>
  );
}

export const styles = StyleSheet.create({
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10 },
  toast: { position: "absolute", alignSelf: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, backgroundColor: "rgba(30,30,30,0.94)" },
  emptyRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  badge: { position: "absolute", top: 7, right: 7, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  views: { position: "absolute", left: 7, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  shadow: { textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  peekBack: { zIndex: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: "rgba(0,0,0,0.45)" },
  peekCard: { width: "100%", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  peekHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  peekFoot: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12, paddingHorizontal: 14 },
});

export { INSET };

// Grouped-settings colors (web .st): gray page, white cards in light; black page, dark cards in dark.
export function settingsColors(theme) {
  return theme.scheme === "dark" ? { bg: "#000", card: "#1c1c1e" } : { bg: "#f2f2f7", card: "#fff" };
}
