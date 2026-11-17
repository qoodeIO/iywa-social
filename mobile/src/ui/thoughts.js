// Pensieri (thoughts): cards, polls, photos, quotes, threads and lists, ported from the web app.
import { Fragment, memo, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR, THOUGHTS, compact, personByHandle } from "../data";
import { TIME, agoLabel, fullStamp, openPersonByName } from "../lib/profile-data";
import { Check, Feather, Heart, ImageIcon, LinkIcon, MessageCircle, MoreHorizontal, Plus, Poll, Quote, Repost, Send, Trash, UserMinus, UserPlus, Verified } from "./icons-profile";
import { showToast } from "./feedEcho";
import { T, tap } from "./kit";
import { ActionSheet, IgEmpty } from "./profile-kit";
import { localeTag, t } from "../lib/i18n";
import { openTab } from "../lib/tabs";

const W = Dimensions.get("window").width;

// ---------------------------------------------------------------------------
// Everything the UI needs about thoughts, merged from the seed and the store.
// ---------------------------------------------------------------------------
let memo1 = { key: null, value: null };

function hiddenText(prefs, text) {
  const words = (prefs?.hiddenWords || []).map((word) => String(word).toLowerCase()).filter(Boolean);
  const lower = String(text || "").toLowerCase();
  return words.some((word) => lower.includes(word));
}

export function buildThoughts(store) {
  const { myThoughts, thoughtReplies, profile, prefs } = store;
  const key = [myThoughts, thoughtReplies, profile, prefs];
  if (memo1.key && memo1.key.every((item, index) => item === key[index])) return memo1.value;
  const me = profile;
  const myHandle = String(me.handle || "").replace(/^@/, "");
  const shape = (item) => (item.mine ? { ...item, name: me.name, handle: myHandle, src: me.src || AVATAR } : item);
  const hidden = new Set([...(prefs?.blocked || []), ...(prefs?.muted || [])]);
  const mine = (myThoughts || []).map(shape);
  const seeded = THOUGHTS.map((item) => ({
    ...item,
    // A thread written by the author is stored as replies of their own.
    replies: [
      ...(item.chain || []).map((text, index) => ({ id: `${item.id}-c${index}`, name: item.name, handle: item.handle, src: item.src, verified: item.verified, created: item.created + (index + 1) * 1000, likes: Math.round(item.likes / (4 + index)), text, chained: true })),
      ...(item.replies || []),
    ],
  }));
  const all = [...mine, ...seeded].filter((item) => !hidden.has(item.name) && !hiddenText(prefs, item.text));
  const byId = new Map();
  for (const item of all) {
    byId.set(item.id, item);
    for (const reply of item.replies || []) byId.set(reply.id, { ...reply, parentId: item.id });
  }
  const extras = {};
  for (const [parentId, list] of Object.entries(thoughtReplies || {})) {
    extras[parentId] = (list || []).map(shape).filter((item) => !hiddenText(prefs, item.text));
    for (const reply of extras[parentId]) if (!byId.has(reply.id)) byId.set(reply.id, { ...reply, parentId });
  }
  function repliesOf(id) {
    const node = byId.get(id);
    return [...(node && !node.parentId ? node.replies || [] : []), ...(extras[id] || [])];
  }
  const value = { all, byId, repliesOf, me: { ...me, handle: myHandle } };
  memo1 = { key, value };
  return value;
}

export function useThoughts() {
  return buildThoughts(useStore());
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
  if (tag.startsWith("#")) {
    router.push(`/hashtag/${encodeURIComponent(tag.slice(1).toLowerCase())}`);
    return;
  }
  const handle = tag.slice(1);
  const person = personByHandle(handle);
  if (person) router.push(`/person/${person.handle}`);
  else if (handle === "forno.neri") openTab("profile");
}

// ---------------------------------------------------------------------------
// Poll, photos and quotes.
// ---------------------------------------------------------------------------
export function ThoughtPoll({ thought }) {
  const theme = useTheme();
  const store = useStore();
  const voted = store.votes[thought.id];
  const options = thought.poll.options.map((option, index) => ({ ...option, votes: option.votes + (voted === index ? 1 : 0) }));
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const left = Math.max(0, thought.poll.endsAt - Date.now());
  const ended = left === 0;
  const showResults = voted != null || ended || thought.mine;
  const lead = Math.max(...options.map((option) => option.votes));
  return (
    <View style={{ gap: 7, marginTop: 10 }}>
      {options.map((option, index) => {
        const share = total ? Math.round((option.votes / total) * 100) : 0;
        const mine = voted === index;
        return (
          <PollOption
            key={index}
            text={option.text}
            share={showResults ? share : 0}
            showResults={showResults}
            mine={mine}
            lead={showResults && option.votes === lead}
            onPress={() => { tap(); store.vote(thought.id, index); }}
            theme={theme}
          />
        );
      })}
      <T size={13} color={theme.text3}>
        {t("{n} voti", { n: total.toLocaleString(localeTag()) })} · {ended ? t("Concluso") : left > TIME.DAY ? t("{n} giorni rimasti", { n: Math.ceil(left / TIME.DAY) }) : t("{n} ore rimaste", { n: Math.ceil(left / TIME.HOUR) })}
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

export function QuotedThought({ thought, onOpen }) {
  const theme = useTheme();
  if (!thought) {
    return <View style={[styles.quote, { borderColor: theme.line }]}><T size={13.5} color={theme.text2}>{t("Questo pensiero non è più disponibile.")}</T></View>;
  }
  return (
    <Pressable onPress={() => onOpen?.(thought)} style={({ pressed }) => [styles.quote, { borderColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Image source={{ uri: thought.src || AVATAR }} style={{ width: 20, height: 20, borderRadius: 10 }} />
        <T size={13.5} weight="700">{thought.handle}</T>
        {thought.verified ? <Verified size={13} weight="fill" color={theme.blue} /> : null}
        <T size={13} color={theme.text3}>{agoLabel(thought.created)}</T>
      </View>
      <T size={14} lines={4} style={{ marginTop: 4, lineHeight: 20 }}>{thought.text}</T>
      {thought.images?.length ? <Image source={{ uri: thought.images[0] }} style={{ width: "100%", height: 160, marginTop: 8, borderRadius: 8 }} contentFit="cover" /> : null}
    </Pressable>
  );
}

export function openThought(thought) {
  if (!thought) return;
  router.push(`/thought/${thought.parentId && !thought.chained ? thought.id : thought.id}`);
}

export function composeThought(params = {}) {
  router.push({ pathname: "/compose", params: { kind: "thought", ...params } });
}

// ---------------------------------------------------------------------------
// One thought.
// ---------------------------------------------------------------------------
export const ThoughtCard = memo(function ThoughtCard({ thought, line = false, lineUp = false, big = false, repostedBy, replyCount, onOpen, onDeleted }) {
  const theme = useTheme();
  const store = useStore();
  const { byId } = buildThoughts(store);
  const [menu, setMenu] = useState(null);
  const [zoom, setZoom] = useState(null);
  const burst = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(1)).current;
  const taps = useRef({ at: 0, timer: 0 });
  const liked = store.thoughtLikes.includes(thought.id);
  const reposted = store.reposts.includes(thought.id);
  const likes = (thought.likes || 0) + (liked ? 1 : 0);
  const reposts = (thought.reposts || 0) + (reposted ? 1 : 0);
  const replies = replyCount ?? 0;
  const follows = store.follows.includes(thought.name);
  const showCounts = store.prefs.likeCounts !== false;
  const open = () => (onOpen ? onOpen(thought) : router.push(`/thought/${thought.id}`));
  useEffect(() => () => clearTimeout(taps.current.timer), []);

  function pop() {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 260 }),
      Animated.timing(burst, { toValue: 2, duration: 260, delay: 220, useNativeDriver: true }),
    ]).start();
  }

  function like() {
    if (!liked) {
      tap();
      heart.setValue(0.6);
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, damping: 7, stiffness: 300 }).start();
    }
    store.toggleThoughtLike(thought.id);
  }

  function onCardPress() {
    const now = Date.now();
    if (now - taps.current.at < 280) {
      clearTimeout(taps.current.timer);
      taps.current.at = 0;
      if (!liked) like();
      pop();
      return;
    }
    taps.current.at = now;
    if (big) return;
    taps.current.timer = setTimeout(() => { taps.current.at = 0; open(); }, 260);
  }

  const goPerson = () => (thought.mine ? openTab("profile") : openPersonByName(thought.name, store.profile.name));

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
          <Pressable onPress={goPerson} accessibilityLabel={thought.name}>
            <Image source={{ uri: thought.src || AVATAR }} recyclingKey={thought.src} style={[styles.face, { backgroundColor: theme.fill }]} contentFit="cover" transition={120} />
            {!thought.mine && !follows && !lineUp ? (
              <Pressable accessibilityLabel={t("Segui")} hitSlop={6} onPress={() => { tap(); store.toggleFollow(thought.name); }} style={[styles.follow, { backgroundColor: theme.text, borderColor: theme.bg }]}>
                <Plus size={10} weight="bold" color={theme.bg} />
              </Pressable>
            ) : null}
          </Pressable>
          {line ? <View style={[styles.line, { backgroundColor: theme.line }]} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
          <View style={styles.head}>
            <Pressable onPress={goPerson} style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
              <T size={14.5} weight="700" lines={1} style={{ flexShrink: 1 }}>{thought.handle}</T>
              {thought.verified ? <Verified size={14} weight="fill" color={theme.blue} /> : null}
            </Pressable>
            {!big ? <T size={14} color={theme.text3}>{agoLabel(thought.created)}</T> : null}
            <Pressable accessibilityLabel={t("Altro")} hitSlop={8} onPress={() => setMenu("more")} style={styles.more}><MoreHorizontal size={18} weight="bold" color={theme.text2} /></Pressable>
          </View>
          {thought.replyTo ? <T size={13} color={theme.text2} style={{ marginTop: 1 }}>{t("In risposta a")}{" "}<T size={13} color={theme.blue}>@{thought.replyTo}</T></T> : null}
          {thought.text ? <RichText text={thought.text} size={big ? 17 : 15} style={{ marginTop: big ? 6 : 2 }} /> : null}
          <ThoughtMedia images={thought.images} onZoom={setZoom} />
          {thought.poll ? <ThoughtPoll thought={thought} /> : null}
          {thought.quote ? <QuotedThought thought={byId.get(thought.quote)} onOpen={(item) => router.push(`/thought/${item.id}`)} /> : null}
          {big ? <T size={13} color={theme.text3} style={{ marginTop: 12 }}>{fullStamp(thought.created)}</T> : null}
          <View style={styles.actions}>
            <Pressable accessibilityLabel={t("Mi piace")} onPress={like} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <Animated.View style={{ transform: [{ scale: heart }] }}><Heart size={20} weight={liked ? "fill" : "regular"} color={liked ? theme.red : theme.text} /></Animated.View>
              {showCounts && likes ? <T size={13.5} weight="500" color={liked ? theme.red : theme.text2}>{compact(likes)}</T> : null}
            </Pressable>
            <Pressable accessibilityLabel={t("Rispondi")} onPress={() => composeThought({ reply: thought.id })} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <MessageCircle size={20} color={theme.text} />
              {replies ? <T size={13.5} weight="500" color={theme.text2}>{compact(replies)}</T> : null}
            </Pressable>
            <Pressable accessibilityLabel={t("Ripubblica")} onPress={() => setMenu("repost")} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <Repost size={20} color={reposted ? "#00ba7c" : theme.text} weight={reposted ? "bold" : "regular"} />
              {reposts ? <T size={13.5} weight="500" color={reposted ? "#00ba7c" : theme.text2}>{compact(reposts)}</T> : null}
            </Pressable>
            <Pressable accessibilityLabel={t("Condividi")} onPress={() => Share.share({ message: `${thought.handle}: ${thought.text || ""}\nhttps://iywa.app/t/${thought.id}` }).catch(() => {})} style={({ pressed }) => [styles.act, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
              <Send size={20} color={theme.text} />
            </Pressable>
          </View>
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.burst, { opacity: burst.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.15] }) }] }]}>
        <Heart size={84} weight="fill" color={theme.red} />
      </Animated.View>
      <ActionSheet
        open={menu === "repost"}
        onClose={() => setMenu(null)}
        items={[
          { icon: Repost, label: reposted ? t("Rimuovi ripubblicazione") : t("Ripubblica"), danger: reposted, onPress: () => { store.toggleThoughtRepost(thought.id); setMenu(null); showToast({ text: reposted ? t("Ripubblicazione rimossa") : t("Ripubblicato") }); } },
          { icon: Quote, label: t("Cita"), onPress: () => { setMenu(null); composeThought({ quote: thought.id }); } },
        ]}
      />
      <ActionSheet
        open={menu === "more"}
        onClose={() => setMenu(null)}
        items={[
          { icon: LinkIcon, label: t("Copia link"), onPress: () => { Clipboard.setStringAsync(`https://iywa.app/t/${thought.id}`).catch(() => {}); setMenu(null); } },
          !thought.mine ? { icon: follows ? UserMinus : UserPlus, label: follows ? t("Non seguire più {handle}", { handle: thought.handle }) : t("Segui {handle}", { handle: thought.handle }), onPress: () => { store.toggleFollow(thought.name); setMenu(null); } } : null,
          thought.mine ? { icon: Trash, label: t("Elimina"), danger: true, onPress: () => { store.deleteThought(thought.id); setMenu(null); onDeleted?.(thought.id); showToast({ text: t("Eliminato") }); } } : null,
        ]}
      />
      <Modal visible={Boolean(zoom)} transparent animationType="fade" onRequestClose={() => setZoom(null)} statusBarTranslucent>
        <Pressable style={styles.zoom} onPress={() => setZoom(null)}>
          {zoom ? <Image source={{ uri: zoom }} style={{ width: W, height: "80%" }} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </Pressable>
  );
});

// A thought in a list, followed by the first part of its thread when the author wrote one.
export const ThoughtEntry = memo(function ThoughtEntry({ thought, repostedBy }) {
  const theme = useTheme();
  const { repliesOf } = useThoughts();
  const replies = repliesOf(thought.id);
  const chain = replies.filter((item) => item.chained);
  const others = replies.length - chain.length;
  return (
    <View>
      <ThoughtCard thought={thought} line={chain.length > 0} replyCount={others} repostedBy={repostedBy} />
      {chain.length ? (
        <>
          <ThoughtCard thought={chain[0]} lineUp line={chain.length > 1} replyCount={0} onOpen={() => router.push(`/thought/${thought.id}`)} />
          {chain.length > 1 ? (
            <Pressable onPress={() => router.push(`/thought/${thought.id}`)} style={[styles.moreThread, { borderBottomColor: theme.line }]}>
              <View style={styles.dots}>{[0, 1, 2].map((i) => <View key={i} style={[styles.dot, { backgroundColor: theme.text3 }]} />)}</View>
              <T size={14} weight="600" color={theme.blue}>{t("Mostra il thread ({n} in più)", { n: chain.length - 1 })}</T>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

// Rows of thoughts written by one person (and, on your own profile, your reposts).
export function thoughtRows(store, { name, mine }) {
  const { all, byId } = buildThoughts(store);
  const own = all.filter((item) => (mine ? item.mine : item.name === name));
  const reposts = mine ? store.reposts.map((id) => ({ id, at: store.repostAt?.[id] || 0, thought: byId.get(id) })).filter((row) => row.thought) : [];
  return [
    ...own.map((thought) => ({ key: thought.id, at: thought.created, thought })),
    ...reposts.map((row) => ({ key: `rp-${row.id}`, at: row.at, thought: row.thought, repost: true })),
  ].sort((a, b) => b.at - a.at);
}

export function ThoughtList({ name, mine, emptyAction }) {
  const store = useStore();
  const rows = thoughtRows(store, { name, mine });
  if (!rows.length) {
    return (
      <IgEmpty icon={Feather} title={mine ? t("Condividi il tuo primo pensiero") : t("Ancora nessun pensiero")} text={mine ? t("Una frase, una domanda, un sondaggio.") : null}>
        {emptyAction}
      </IgEmpty>
    );
  }
  return (
    <View>
      {rows.map((row) => <ThoughtEntry key={row.key} thought={row.thought} repostedBy={row.repost ? t("Hai ripubblicato") : undefined} />)}
    </View>
  );
}

export function ComposePrompt({ onCompose }) {
  const theme = useTheme();
  const store = useStore();
  return (
    <Pressable onPress={() => { tap(); (onCompose || (() => composeThought()))(); }} style={({ pressed }) => [styles.prompt, { borderBottomColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <Image source={{ uri: store.profile.src || AVATAR }} style={{ width: 36, height: 36, borderRadius: 18 }} />
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
  face: { width: 38, height: 38, borderRadius: 19 },
  follow: { position: "absolute", right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
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
  moreThread: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 6, paddingBottom: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  dots: { width: 40, alignItems: "center", gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  prompt: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
});
