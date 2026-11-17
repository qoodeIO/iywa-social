// One chat message with Instagram gestures: double-tap to like, swipe right to reply,
// hold for the menu. Ported from the web's DmBubble / BubbleMeta / call log bubble.
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { callStamp, onlyEmoji, reactionGroups } from "../live/format";
import { MINE, VoiceBubble, useChatTheme } from "./chat";
import { Check, CheckCheck, Clock, Forward, Phone, Reply, Video } from "./chatIcons";
import { T, tap } from "./kit";
import { t } from "../lib/i18n";
import { postCard, usePost } from "../lib/social";

// Figure spaces reserve room for the time + ticks at the end of the last line (Telegram style).
const SPACE = " ";

// A shared post travels as a text message with its link (the hub has no post kind).
const POST_LINK = /https:\/\/iywa\.app\/p\/([A-Za-z0-9_-]+)/;
export function postIdIn(text) {
  return POST_LINK.exec(String(text || ""))?.[1] || null;
}

function SharedPost({ id, mine }) {
  const theme = useChatTheme();
  const { data, loading } = usePost(id);
  const post = postCard(data?.post);
  const fg = mine ? "#fff" : theme.text;
  const sub = mine ? "rgba(255,255,255,0.78)" : theme.text2;
  return (
    <View style={[styles.shared, { backgroundColor: mine ? "rgba(255,255,255,0.14)" : theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
      {post?.image ? <Image source={{ uri: post.image }} recyclingKey={post.image} style={styles.sharedImage} contentFit="cover" transition={120} /> : null}
      <View style={{ paddingVertical: 7, paddingHorizontal: 10 }}>
        <T size={13.5} weight="600" color={fg} lines={1}>{post ? post.name || post.handle : loading ? t("Caricamento…") : t("Post non disponibile")}</T>
        {post?.text ? <T size={13} color={sub} lines={2}>{post.text}</T> : null}
      </View>
    </View>
  );
}

export function Highlight({ text, query, color }) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const out = [];
  let at = 0;
  let found = lower.indexOf(query, at);
  while (found >= 0) {
    if (found > at) out.push(text.slice(at, found));
    out.push(<T key={found} size={15} color="#111" style={{ backgroundColor: "#ffd54f" }}>{text.slice(found, found + query.length)}</T>);
    at = found + query.length;
    found = lower.indexOf(query, at);
  }
  out.push(text.slice(at));
  return out;
}

function Meta({ message, mine, tick, overlay }) {
  const color = overlay ? "#fff" : mine ? "rgba(255,255,255,0.78)" : undefined;
  const theme = useChatTheme();
  const fg = color || theme.text3;
  return (
    <View pointerEvents="none" style={[styles.meta, overlay && styles.metaOverlay]}>
      {message.edited ? <T size={11} color={fg} style={{ fontStyle: "italic" }}>{t("modificato")}</T> : null}
      <T size={11} color={fg}>{message.time || ""}</T>
      {mine ? (
        tick === "pending" ? <Clock size={14} weight="bold" color={fg} />
          : tick === "read" ? <CheckCheck size={14} weight="bold" color={mine ? "#fff" : theme.blue} />
            : tick === "failed" ? null : <Check size={14} weight="bold" color={fg} />
      ) : null}
    </View>
  );
}

export function CallBubble({ message, mine, onCall }) {
  const theme = useChatTheme();
  const video = message.call === "video";
  const missed = !message.duration;
  const label = video ? t("Videochiamata") : t("Chiamata vocale");
  const detail = missed
    ? (mine
      ? (message.reason === "declined" ? t("Rifiutata") : message.reason === "busy" ? t("Occupato") : message.reason === "cancelled" ? t("Annullata") : t("Nessuna risposta"))
      : t("Persa · Tocca per richiamare"))
    : callStamp(message.duration);
  const Icon = video ? Video : Phone;
  return (
    <Pressable onPress={() => { tap(); onCall?.(video ? "video" : "voice"); }} style={({ pressed }) => [styles.call, { backgroundColor: theme.them, transform: [{ scale: pressed ? 0.97 : 1 }] }, !theme.dark && styles.lift]}>
      <View style={[styles.callIcon, { backgroundColor: missed ? "rgba(255,48,64,0.18)" : theme.dark ? "rgba(245,245,245,0.12)" : "rgba(0,0,0,0.08)" }]}>
        <Icon size={18} weight="fill" color={missed ? theme.red : theme.text} />
      </View>
      <View>
        <T size={14.5} weight="600">{label}</T>
        <T size={12.5} color={theme.text2}>{detail}</T>
      </View>
    </Pressable>
  );
}

export const DmBubble = memo(function DmBubble({ message, mine, first, last, showName, quoteLabel, myKey, tick, query, flash, pop, onZoom, onCall, onRetry, onDiscard, onReact, onReply, onMenu }) {
  const theme = useChatTheme();
  const kind = message.kind || "text";
  const swipe = useRef(null);
  const taps = useRef({ last: 0, timer: 0 });
  const [ratio, setRatio] = useState(0.8);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (flash) scale.value = withSequence(withTiming(1.04, { duration: 220 }), withTiming(1, { duration: 220 }), withTiming(1.04, { duration: 220 }), withTiming(1, { duration: 300 }));
  }, [flash, scale]);
  useEffect(() => {
    if (pop) scale.value = withSequence(withSpring(1.08, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
  }, [pop, scale]);
  useEffect(() => () => clearTimeout(taps.current.timer), []);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (message.from === "system") return null;
  if (kind === "call") return <CallBubble message={message} mine={mine} onCall={onCall} />;

  const jumbo = kind === "text" && onlyEmoji(message.text);
  const failed = message.status === "failed";
  const pending = !message.id && message.status === "pending";
  const groups = reactionGroups(message.reactions);
  const mineReacted = message.reactions?.[myKey];
  const quote = message.reply;
  const hasText = kind !== "audio" && Boolean(message.text);
  const sharedId = kind === "text" ? postIdIn(message.text) : null;
  const fg = mine ? "#fff" : theme.text;

  const radius = {
    borderRadius: kind === "image" ? 18 : 22,
    ...(mine
      ? { borderTopRightRadius: first ? (kind === "image" ? 18 : 22) : 6, borderBottomRightRadius: last ? (kind === "image" ? 18 : 22) : 6 }
      : { borderTopLeftRadius: first ? (kind === "image" ? 18 : 22) : 6, borderBottomLeftRadius: last ? (kind === "image" ? 18 : 22) : 6 }),
  };

  function press() {
    const now = Date.now();
    const tp = taps.current;
    if (now - tp.last < 300) {
      tp.last = 0;
      clearTimeout(tp.timer);
      tap();
      onReact(mineReacted === "❤️" ? null : "❤️");
      return;
    }
    tp.last = now;
    if (kind === "image") {
      clearTimeout(tp.timer);
      tp.timer = setTimeout(() => onZoom(message.image), 300);
    } else if (sharedId) {
      clearTimeout(tp.timer);
      tp.timer = setTimeout(() => router.push(`/post/${sharedId}`), 300);
    }
  }

  const spacer = message.edited ? 15 : mine ? 9 : 7;
  const textBody = hasText ? (
    <T size={15} color={fg} style={{ lineHeight: 19.8 }}>
      {query ? <Highlight text={message.text} query={query} /> : message.text}
      {jumbo ? null : <T size={15} color="transparent">{SPACE.repeat(spacer)}</T>}
    </T>
  ) : null;

  const [fwdBefore, fwdAfter = ""] = t("Inoltrato da {name}").split("{name}");
  const fwd = message.fwd ? (
    <View style={[styles.fwd, kind === "image" && { paddingTop: 8, paddingHorizontal: 12 }]}>
      <Forward size={13} weight="fill" color={mine ? "#fff" : theme.blue} />
      <T size={12.5} color={mine ? "#fff" : theme.blue} style={{ opacity: 0.85 }}>{fwdBefore}<T size={12.5} weight="700" color={mine ? "#fff" : theme.blue}>{message.fwd.name}</T>{fwdAfter}</T>
    </View>
  ) : null;

  let inner;
  if (jumbo) {
    inner = <T style={{ fontSize: 42, lineHeight: 46 }}>{message.text}</T>;
  } else if (kind === "image") {
    inner = (
      <View style={[{ overflow: "hidden" }, radius]}>
        {fwd ? <View style={{ backgroundColor: mine ? "#3f6cf6" : theme.them }}>{fwd}</View> : null}
        <Image
          source={{ uri: message.image }}
          recyclingKey={String(message.image).slice(-48)}
          style={{ width: 220, height: Math.min(300, 220 / ratio), backgroundColor: theme.fill }}
          contentFit="cover"
          transition={150}
          onLoad={(event) => {
            const { width, height } = event.source || {};
            if (width && height) setRatio(width / height);
          }}
        />
        {hasText ? (
          <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: mine ? "#3f6cf6" : theme.them }}>
            {textBody}
            <Meta message={message} mine={mine} tick={tick} />
          </View>
        ) : <Meta message={message} mine={mine} tick={tick} overlay />}
      </View>
    );
  } else {
    const content = (
      <>
        {fwd}
        {kind === "audio" ? <VoiceBubble message={message} color={fg} knob={mine ? "rgba(255,255,255,0.22)" : theme.dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.08)"} /> : null}
        {sharedId ? <SharedPost id={sharedId} mine={mine} /> : null}
        {textBody}
        <Meta message={message} mine={mine} tick={tick} />
      </>
    );
    const pad = kind === "audio" ? styles.padAudio : styles.padText;
    inner = mine ? (
      <LinearGradient colors={MINE} locations={[0, 0.45, 1]} style={[pad, radius]}>{content}</LinearGradient>
    ) : (
      <View style={[pad, radius, { backgroundColor: theme.them }, !theme.dark && styles.lift]}>{content}</View>
    );
  }

  const renderLeft = (progress, translation) => <ReplyHint translation={translation} />;

  return (
    <View style={[styles.msg, mine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }, groups.length ? { marginBottom: 16 } : null]}>
      {showName && !mine && first ? <T size={12} color={theme.text2} style={{ marginLeft: 12, marginBottom: 2 }}>{message.senderName}</T> : null}
      {quote ? (
        <View style={[styles.quote, mine && { alignItems: "flex-end" }]}>
          <View style={styles.quoteLabel}>
            <Reply size={12} weight="bold" color={theme.text2} />
            <T size={12} color={theme.text2}>{quoteLabel?.(quote, mine)}</T>
          </View>
          <View style={[styles.quoteBox, { borderColor: theme.line }]}>
            <T size={13.5} color={theme.text2} lines={1}>{quote.text || (quote.kind === "image" ? t("Foto") : quote.kind === "audio" ? t("Messaggio vocale") : "…")}</T>
          </View>
        </View>
      ) : null}
      <Swipeable
        ref={swipe}
        friction={1.6}
        leftThreshold={56}
        overshootLeft={false}
        dragOffsetFromLeft={12}
        renderLeftActions={renderLeft}
        onSwipeableWillOpen={() => {
          tap();
          onReply();
          swipe.current?.close();
        }}
        containerStyle={{ overflow: "visible" }}
      >
        <Pressable
          onPress={press}
          onLongPress={() => { tap("medium"); onMenu(); }}
          delayLongPress={420}
          style={({ pressed }) => ({ opacity: pending ? 0.7 : failed ? 0.55 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}
        >
          <Animated.View style={scaleStyle}>{inner}</Animated.View>
        </Pressable>
      </Swipeable>
      {groups.length ? (
        <Pressable onPress={() => { tap(); mineReacted ? onReact(null) : onMenu(); }} style={[styles.reacts, { backgroundColor: theme.dark ? "#2c2c2e" : "#efefef", borderColor: theme.bg }, mine ? { right: 8 } : { left: 8 }]}>
          {groups.slice(0, 3).map(([emoji]) => <T key={emoji} size={13}>{emoji}</T>)}
          {Object.keys(message.reactions).length > 1 ? <T size={12} weight="600" color={theme.text2} style={{ marginLeft: 2 }}>{Object.keys(message.reactions).length}</T> : null}
        </Pressable>
      ) : null}
      {failed ? (
        <View style={styles.failed}>
          <T size={12} color={theme.red}>{t("Non inviato")}</T>
          <Pressable onPress={onRetry} hitSlop={6}><T size={12} weight="600" color={theme.blue}>{t("Riprova")}</T></Pressable>
          <Pressable onPress={onDiscard} hitSlop={6}><T size={12} weight="600" color={theme.blue}>{t("Elimina")}</T></Pressable>
        </View>
      ) : null}
    </View>
  );
});

function ReplyHint({ translation }) {
  const theme = useChatTheme();
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, translation.value / 56));
    return { opacity: p, transform: [{ scale: interpolate(p, [0, 1], [0.6, 1]) }] };
  });
  return (
    <View style={{ width: 40, justifyContent: "center", alignItems: "center" }}>
      <Animated.View style={[{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }, style]}>
        <Reply size={15} weight="bold" color={theme.text} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  msg: { maxWidth: "74%", minWidth: 0 },
  shared: { width: 220, marginBottom: 6, borderRadius: 14, overflow: "hidden" },
  sharedImage: { width: 220, height: 220 },
  padText: { paddingVertical: 8, paddingHorizontal: 13 },
  padAudio: { paddingTop: 6, paddingHorizontal: 10, paddingBottom: 18 },
  lift: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  meta: { position: "absolute", right: 10, bottom: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  metaOverlay: { right: 8, bottom: 8, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.45)" },
  fwd: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  quote: { maxWidth: "100%", marginBottom: -10, paddingBottom: 0 },
  quoteLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginHorizontal: 8, marginBottom: 4 },
  quoteBox: { maxWidth: "100%", paddingTop: 7, paddingHorizontal: 12, paddingBottom: 16, borderRadius: 18, borderWidth: 1, opacity: 0.9 },
  reacts: { position: "absolute", bottom: -17, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 1, height: 24, paddingHorizontal: 6, borderRadius: 12, borderWidth: 2 },
  failed: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  call: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, borderRadius: 20 },
  callIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
