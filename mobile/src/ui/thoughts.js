// Pensieri (thoughts): cards, polls, photos and lists, on the server's posts of kind "thought".
import { Fragment, memo, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { compact } from "../data";
import { fullStamp } from "../lib/profile-data";
import { ago, deletePost, like as likePost, toggleLike, toggleRepost, useUserPosts, vote } from "../lib/social";
import { myHandle, useMe } from "../lib/session";
import { errorText } from "../lib/api";
import { Check, Feather, Heart, ImageIcon, LinkIcon, MessageCircle, MoreHorizontal, Poll, Repost, Send, Trash, Verified } from "./icons-profile";
import { showToast } from "./feedEcho";
import { Btn, T, tap } from "./kit";
import { ActionSheet, IgEmpty } from "./profile-kit";
import { t } from "../lib/i18n";
import { openTab } from "../lib/tabs";

const W = Dimensions.get("window").width;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------
// One shape for whatever arrives: a server post, or a postCard() of one.
// ---------------------------------------------------------------------------
export function thoughtShape(item) {
  if (!item) return null;
  const author = item.author || {
    handle: String(item.owner || item.handle || "").replace(/^@/, ""),
    name: item.name || "",
    avatar: item.avatar || item.src || "",
    verified: Boolean(item.verified),
  };
  const images = Array.isArray(item.media)
    ? item.media.map((m) => (m.type === "video" ? m.poster || m.url : m.url)).filter(Boolean)
    : (item.images || []).filter(Boolean);
  return {
    id: item.id,
    author,
    text: item.text || "",
    images,
    poll: item.poll && Array.isArray(item.poll.counts) ? item.poll : null,
    likes: Number(item.likes) || 0,
    comments: Number(item.comments) || 0,
    reposts: Number(item.reposts) || 0,
    liked: Boolean(item.liked),
    reposted: Boolean(item.reposted),
    hideLikes: Boolean(item.hideLikes),
    createdAt: item.createdAt || item.created || 0,
    replyTo: item.replyTo || null,
    parent: item.parent || null,
    mine: Boolean(author.handle) && author.handle === myHandle(),
  };
}

// Muted / blocked people (by name or handle) and hidden words from the privacy settings.
export function thoughtHidden(prefs, item) {
  if (!item) return true;
  const a = item.author || {};
  const people = new Set([...(prefs?.blocked || []), ...(prefs?.muted || [])].map((x) => String(x).replace(/^@/, "")));
  if (people.has(a.handle) || people.has(a.name)) return true;
  const words = (prefs?.hiddenWords || []).map((word) => String(word).toLowerCase()).filter(Boolean);
  const lower = String(item.text || "").toLowerCase();
  return words.some((word) => lower.includes(word));
}

// Kept for older callers: thoughts now live on the server (useThoughtsFeed, usePost, useUserPosts).
const NOTHING = Object.freeze({ all: [], byId: new Map(), repliesOf: () => [], me: {} });
export function buildThoughts() {
  return NOTHING;
}
export function useThoughts() {
  return NOTHING;
}
export function thoughtRows() {
  return [];
}

// ---------------------------------------------------------------------------
// Avatar: the photo, or the initial on a grey circle.
// ---------------------------------------------------------------------------
export function Face({ person, size = 38, style }) {
  const theme = useTheme();
  const src = person?.avatar || person?.src || "";
  const box = { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill };
  if (src) return <Image source={{ uri: src }} recyclingKey={src} style={[box, style]} contentFit="cover" transition={120} />;
  const initial = String(person?.name || person?.handle || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={[box, { alignItems: "center", justifyContent: "center" }, style]}>
      <T size={Math.round(size * 0.42)} weight="600" color={theme.text2}>{initial}</T>
    </View>
  );
}

export function openPerson(handle) {
  const clean = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!clean) return;
  if (clean === myHandle()) openTab("profile");
  else router.push(`/person/${encodeURIComponent(clean)}`);
}

// ---------------------------------------------------------------------------
// Text with tappable @mentions, #hashtags and links.
// ---------------------------------------------------------------------------
export function RichText({ text, size = 15, color, lines, style, onTag }) {
  const theme = useTheme();
  const parts = String(text || "").split(/(\s+)/);
  return (
    <T size={size} color={color} lines={lines} style={[{ lineHeight: Math.round(size * 1.42) }, style]}>
      {parts.map((part, i) => {
        const match = part.match(/^([“"(«']*)([@#][\p{L}\d_.]*[\p{L}\d_])(.*)$/u);
        if (match && (match[2][0] === "#" ? /^#[\p{L}\d_]+$/u.test(match[2]) : /^@[\w.]+$/.test(match[2]))) {
          const tag = match[2];
          return (
            <Fragment key={i}>
              {match[1]}
              <T size={size} color={theme.blue} onPress={() => (onTag ? onTag(tag) : openTag(tag))}>{tag}</T>
              {match[3]}
            </Fragment>
          );
        }
        if (/^(https?:\/\/|www\.)\S+/.test(part)) {
          return <T key={i} size={size} color={theme.blue} onPress={() => Linking.openURL(part.startsWith("http") ? part : `https://${part}`).catch(() => {})}>{part.replace(/^https?:\/\//, "")}</T>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </T>
  );
}

export function openTag(tag) {
  if (tag.startsWith("#")) router.push(`/hashtag/${encodeURIComponent(tag.slice(1).toLowerCase())}`);
  else openPerson(tag.slice(1));
}

// ---------------------------------------------------------------------------
// Poll and photos.
// ---------------------------------------------------------------------------
function timeLeft(ms) {
  if (ms <= 0) return t("Concluso");
  if (ms > DAY) return t("{n} giorni rimasti", { n: Math.ceil(ms / DAY) });
  if (ms > HOUR) return t("{n} ore rimaste", { n: Math.ceil(ms / HOUR) });
  return t("{n} min rimasti", { n: Math.max(1, Math.ceil(ms / MIN)) });
}

export function ThoughtPoll({ thought }) {
  const theme = useTheme();
  const poll = thought.poll;
  const counts = poll.counts || [];
  const total = counts.reduce((sum, n) => sum + n, 0);
  const left = Math.max(0, (poll.endsAt || 0) - Date.now());
  const ended = left === 0;
  const voted = poll.voted;
  const showResults = voted != null || ended || thought.mine;
  const lead = Math.max(0, ...counts);
  async function choose(index) {
    tap();
    try {
      await vote(thought, index);
    } catch (error) {
      showToast({ text: errorText(error, t) });
    }
  }
  return (
    <View style={{ gap: 7, marginTop: 10 }}>
      {poll.options.map((text, index) => (
        <PollOption
          key={index}
          text={text}
          share={showResults && total ? Math.round(((counts[index] || 0) / total) * 100) : 0}
          showResults={showResults}
          mine={voted === index}
          lead={showResults && total > 0 && counts[index] === lead}
          onPress={() => choose(index)}
          theme={theme}
        />
      ))}
      <T size={13} color={theme.text3}>
        {total === 1 ? t("1 voto") : t("{n} voti", { n: compact(total) })} · {timeLeft(left)}
      </T>
    </View>
  );
}

function PollOption({ text, share, showResults, mine, lead, onPress, theme }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(width, { toValue: share, useNativeDriver: false, damping: 22, stiffness: 120 }).start();
  }, [share, width]);
  const fill = mine ? "rgba(0,149,246,0.22)" : lead ? (theme.scheme === "dark" ? "rgba(245,245,245,0.16)" : "rgba(0,0,0,0.12)") : theme.fill;
  return (
    <Pressable disabled={showResults} onPress={onPress} style={({ pressed }) => [styles.option, { borderColor: showResults ? "transparent" : theme.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: fill, borderRadius: 12, width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
        <T size={14.5} weight="600" lines={2} style={{ flexShrink: 1 }}>{text}</T>
        {mine ? <Check size={14} weight="bold" color={theme.blue} /> : null}
      </View>
      {showResults ? <T size={14.5} weight="600">{share}%</T> : null}
    </Pressable>
  );
}

export function ThoughtMedia({ images, onZoom }) {
  const theme = useTheme();
  if (!images?.length) return null;
  if (images.length === 1) {
    return (
      <Pressable onPress={() => onZoom(images[0])} style={({ pressed }) => [styles.mediaOne, { borderColor: theme.line, backgroundColor: theme.fill, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <Image source={{ uri: images[0] }} recyclingKey={images[0]} style={{ width: "100%", height: 300 }} contentFit="cover" transition={150} />
      </Pressable>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={206} style={{ marginTop: 10, marginRight: -INSET }} contentContainerStyle={{ gap: 6, paddingRight: INSET }}>
      {images.map((src, index) => (
        <Pressable key={`${index}-${String(src).slice(-20)}`} onPress={() => onZoom(src)} style={[styles.mediaRail, { borderColor: theme.line, backgroundColor: theme.fill }]}>
          <Image source={{ uri: src }} recyclingKey={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

// A small preview of another thought (the one you are replying to, in the composer).
export function QuotedThought({ thought, onOpen }) {
  const theme = useTheme();
  const item = thoughtShape(thought);
  if (!item) {
    return <View style={[styles.quote, { borderColor: theme.line }]}><T size={13.5} color={theme.text2}>{t("Questo pensiero non è più disponibile.")}</T></View>;
  }
  return (
    <Pressable onPress={() => onOpen?.(item)} style={({ pressed }) => [styles.quote, { borderColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Face person={item.author} size={20} />
        <T size={13.5} weight="700">{item.author.handle}</T>
        {item.author.verified ? <Verified size={13} weight="fill" color={theme.blue} /> : null}
        <T size={13} color={theme.text3}>{ago(item.createdAt)}</T>
      </View>
      {item.text ? <T size={14} lines={4} style={{ marginTop: 4, lineHeight: 20 }}>{item.text}</T> : null}
      {item.images[0] ? <Image source={{ uri: item.images[0] }} style={{ width: "100%", height: 160, marginTop: 8, borderRadius: 8 }} contentFit="cover" /> : null}
    </Pressable>
  );
}

export function openThought(thought) {
  if (thought?.id) router.push(`/thought/${thought.id}`);
}

// reply: the id of the thought you answer.
export function composeThought(params = {}) {
  router.push({ pathname: "/compose", params: { kind: "thought", ...params } });
}

// ---------------------------------------------------------------------------
// One thought.
// ---------------------------------------------------------------------------
export const ThoughtCard = memo(function ThoughtCard({ thought: raw, line = false, lineUp = false, big = false, repostedBy, onOpen, onDeleted }) {
  const theme = useTheme();
  const store = useStore();
  const thought = thoughtShape(raw);
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(null);
  const burst = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(1)).current;
  const taps = useRef({ at: 0, timer: 0 });
  useEffect(() => () => clearTimeout(taps.current.timer), []);
  const showCounts = store.prefs.likeCounts !== false && !thought.hideLikes;
  const { author } = thought;
  const link = `https://iywa.app/t/${thought.id}`;
  const open = () => (onOpen ? onOpen(thought) : router.push(`/thought/${thought.id}`));

  function pop() {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 260 }),
      Animated.timing(burst, { toValue: 2, duration: 260, delay: 220, useNativeDriver: true }),
    ]).start();
  }

  function onLike() {
    if (!thought.liked) {
      tap();
      heart.setValue(0.6);
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, damping: 7, stiffness: 300 }).start();
    }
    toggleLike(thought).catch((error) => showToast({ text: errorText(error, t) }));
  }

  function onRepost() {
    tap();
    const was = thought.reposted;
    toggleRepost(thought)
      .then(() => showToast({ text: was ? t("Ripubblicazione rimossa") : t("Ripubblicato") }))
      .catch((error) => showToast({ text: errorText(error, t) }));
  }

  function onCardPress() {
    const now = Date.now();
    if (now - taps.current.at < 280) {
      clearTimeout(taps.current.timer);
      taps.current.at = 0;
      if (!thought.liked) {
        tap();
        likePost(thought).catch(() => {});
      }
      pop();
      return;
    }
    taps.current.at = now;
    if (big) return;
    taps.current.timer = setTimeout(() => { taps.current.at = 0; open(); }, 260);
  }

  function remove() {
    setMenu(false);
    deletePost(thought.id)
      .then(() => { showToast({ text: t("Eliminato") }); onDeleted?.(thought.id); })
      .catch((error) => showToast({ text: errorText(error, t) }));
  }

  const goPerson = () => openPerson(author.handle);
  const share = () => Share.share({ message: `${thought.text ? `${thought.text}\n` : ""}${link}` }).catch(() => {});

  return (
    <Pressable onPress={onCardPress} style={[styles.card, { paddingTop: lineUp ? 4 : 12, paddingBottom: line ? 0 : 6, borderBottomWidth: line ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
      {repostedBy ? (
        <View style={styles.reposted}>
          <Repost size={14} weight="bold" color={theme.text2} />
          <T size={12.5} weight="600" color={theme.text2}>{repostedBy}</T>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={styles.side}>
          <Pressable onPress={goPerson} accessibilityLabel={author.name || author.handle}>
            <Face person={author} size={38} />
          </Pressable>
          {line ? <View style={[styles.line, { backgroundColor: theme.line }]} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
          <View style={styles.head}>
            <Pressable onPress={goPerson} style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
              <T size={14.5} weight="700" lines={1} style={{ flexShrink: 1 }}>{author.handle}</T>
              {author.verified ? <Verified size={14} weight="fill" color={theme.blue} /> : null}
            </Pressable>
            {!big ? <T size={14} color={theme.text3}>{ago(thought.createdAt)}</T> : null}
            <Pressable accessibilityLabel={t("Altro")} hitSlop={8} onPress={() => setMenu(true)} style={styles.more}><MoreHorizontal size={18} weight="bold" color={theme.text2} /></Pressable>
          </View>
          {big && author.name && author.name !== author.handle ? <T size={13} color={theme.text2}>{author.name}</T> : null}
          {thought.replyTo && !lineUp ? (
            <T size={13} color={theme.text2} style={{ marginTop: 1 }}>{t("In risposta a")}{" "}<T size={13} color={theme.blue} onPress={() => openPerson(thought.replyTo)}>@{thought.replyTo}</T></T>
          ) : null}
          {thought.text ? <RichText text={thought.text} size={big ? 17 : 15} style={{ marginTop: big ? 6 : 2 }} /> : null}
          <ThoughtMedia images={thought.images} onZoom={setZoom} />
          {thought.poll ? <ThoughtPoll thought={thought} /> : null}
          {big ? <T size={13} color={theme.text3} style={{ marginTop: 12 }}>{fullStamp(thought.createdAt)}</T> : null}
          <View style={styles.actions}>
            <Pressable accessibilityLabel={t("Mi piace")} onPress={onLike} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <Animated.View style={{ transform: [{ scale: heart }] }}><Heart size={20} weight={thought.liked ? "fill" : "regular"} color={thought.liked ? theme.red : theme.text} /></Animated.View>
              {showCounts && thought.likes ? <T size={13.5} weight="500" color={thought.liked ? theme.red : theme.text2}>{compact(thought.likes)}</T> : null}
            </Pressable>
            <Pressable accessibilityLabel={t("Rispondi")} onPress={() => composeThought({ reply: thought.id })} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <MessageCircle size={20} color={theme.text} />
              {thought.comments ? <T size={13.5} weight="500" color={theme.text2}>{compact(thought.comments)}</T> : null}
            </Pressable>
            <Pressable accessibilityLabel={thought.reposted ? t("Rimuovi ripubblicazione") : t("Ripubblica")} onPress={onRepost} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <Repost size={20} color={thought.reposted ? "#00ba7c" : theme.text} weight={thought.reposted ? "bold" : "regular"} />
              {thought.reposts ? <T size={13.5} weight="500" color={thought.reposted ? "#00ba7c" : theme.text2}>{compact(thought.reposts)}</T> : null}
            </Pressable>
            <Pressable accessibilityLabel={t("Condividi")} onPress={share} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <Send size={20} color={theme.text} />
            </Pressable>
          </View>
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.burst, { opacity: burst.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.15] }) }] }]}>
        <Heart size={84} weight="fill" color={theme.red} />
      </Animated.View>
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        items={[
          { icon: LinkIcon, label: t("Copia link"), onPress: () => { Clipboard.setStringAsync(link).catch(() => {}); setMenu(false); showToast({ text: t("Link copiato") }); } },
          { icon: Send, label: t("Condividi"), onPress: () => { setMenu(false); share(); } },
          thought.mine ? { icon: Trash, label: t("Elimina"), danger: true, onPress: remove } : null,
        ].filter(Boolean)}
      />
      <Modal visible={Boolean(zoom)} transparent animationType="fade" onRequestClose={() => setZoom(null)} statusBarTranslucent>
        <Pressable style={styles.zoom} onPress={() => setZoom(null)}>
          {zoom ? <Image source={{ uri: zoom }} style={{ width: W, height: "80%" }} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </Pressable>
  );
});

// A thought in a list. `repostedBy` adds the "Hai ripubblicato" line on top.
export const ThoughtEntry = memo(function ThoughtEntry({ thought, repostedBy }) {
  const store = useStore();
  if (!thought || thoughtHidden(store.prefs, thoughtShape(thought))) return null;
  return <ThoughtCard thought={thought} repostedBy={repostedBy} />;
});

// The thoughts written by one person (not virtualized: meant to sit inside a profile tab).
export function ThoughtList({ handle, mine, emptyAction }) {
  const theme = useTheme();
  const { items, loading, moreLoading, done, error, refresh, more } = useUserPosts(handle, "thoughts");
  if (loading && !items.length) return <ActivityIndicator style={{ marginVertical: 30 }} color={theme.text2} />;
  if (error && !items.length) {
    return (
      <IgEmpty icon={Feather} title={t("Impossibile caricare i pensieri")} text={errorText(error, t)}>
        <Btn title={t("Riprova")} onPress={refresh} height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} />
      </IgEmpty>
    );
  }
  if (!items.length) {
    return (
      <IgEmpty icon={Feather} title={mine ? t("Condividi il tuo primo pensiero") : t("Ancora nessun pensiero")} text={mine ? t("Una frase, una domanda, un sondaggio.") : null}>
        {emptyAction}
      </IgEmpty>
    );
  }
  return (
    <View>
      {items.map((item) => <ThoughtEntry key={item.id} thought={item} />)}
      {!done ? (
        <Pressable onPress={more} style={{ paddingVertical: 16, alignItems: "center" }}>
          {moreLoading ? <ActivityIndicator color={theme.text2} /> : <T size={14} weight="600" color={theme.blue}>{t("Mostra altri")}</T>}
        </Pressable>
      ) : null}
    </View>
  );
}

export function ComposePrompt({ onCompose }) {
  const theme = useTheme();
  const me = useMe();
  return (
    <Pressable onPress={() => { tap(); (onCompose || (() => composeThought()))(); }} style={({ pressed }) => [styles.prompt, { borderBottomColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <Face person={me} size={36} />
      <T size={15} color={theme.text2} style={{ flex: 1 }}>{t("Cosa c'è di nuovo?")}</T>
      <ImageIcon size={21} color={theme.text3} />
      <Poll size={21} color={theme.text3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: INSET },
  reposted: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -2, marginBottom: 6, marginLeft: 16 },
  side: { width: 40, alignItems: "center" },
  line: { flex: 1, width: 2, minHeight: 18, marginTop: 6, marginBottom: -2, borderRadius: 99 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 },
  more: { marginLeft: "auto", width: 28, height: 24, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 6, marginLeft: -8 },
  act: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: 8, borderRadius: 99 },
  option: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, overflow: "hidden" },
  mediaOne: { marginTop: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  mediaRail: { width: 200, height: 250, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  quote: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  burst: { position: "absolute", left: 0, right: 0, top: "30%", alignItems: "center" },
  zoom: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  prompt: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
});
