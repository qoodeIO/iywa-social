import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { filterOf, useStoryDecks } from "../lib/stories";
import { AVATAR, PEOPLE, REELS, personByHandle, personByName } from "../data";
import { At, Bookmark, Comment, Feather, Heart, More, Plus, Send } from "./icons";
import { ChecksGlyph, PlayGlyph, ReelGlyph, UserGlyph } from "./feedIcons";
import { Name, Sheet, T, tap } from "./kit";
import { SHARE_BASE, commentCount, shown, tally } from "./feedData";
import { t } from "../lib/i18n";
import { openTab } from "../lib/tabs";

const W = Dimensions.get("window").width;

// Where the story camera lives (owned by the stories area).
export const STORY_CAMERA = "/story/new";

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------
export function openHandle(handle) {
  const person = personByHandle(handle);
  if (person) router.push(`/person/${person.handle}`);
  else if (String(handle).replace(/^@/, "") === "forno.neri") openTab("profile");
}

export function openPerson(name) {
  const person = personByName(name);
  if (person?.handle) router.push(`/person/${person.handle}`);
}

export function openTag(tag) {
  const key = String(tag || "").replace(/^#/, "").toLowerCase();
  if (key) router.push(`/hashtag/${encodeURIComponent(key)}`);
}

export function openPost(id) {
  router.push(`/post/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Text with tappable @mentions, #hashtags and links (web RichText).
// ---------------------------------------------------------------------------
const TAG_RE = /^([“"(«']*)([@#][\p{L}\d_.]*[\p{L}\d_])(.*)$/u;

export function Rich({ text, size = 14, lines, style, prefix, color }) {
  const theme = useTheme();
  const parts = String(text || "").split(/(\s+)/);
  return (
    <T size={size} lines={lines} color={color} style={[{ lineHeight: Math.round(size * 1.36) }, style]}>
      {prefix}
      {parts.map((part, index) => {
        const match = part.match(TAG_RE);
        if (match && (match[2][0] === "#" ? /^#[\p{L}\d_]+$/u.test(match[2]) : /^@[\w.]+$/.test(match[2]))) {
          const word = match[2];
          return (
            <Fragment key={index}>
              {match[1]}
              <T size={size} color={theme.blue} onPress={() => (word[0] === "#" ? openTag(word) : openHandle(word.slice(1)))}>{word}</T>
              {match[3]}
            </Fragment>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </T>
  );
}

// A tagged person's name: their handle when they are on iywa, and it opens their profile.
export function TagName({ name, size = 13, color, weight = "600" }) {
  const person = PEOPLE.find((entry) => entry.name === name);
  return (
    <T size={size} weight={weight} color={color} onPress={person ? () => router.push(`/person/${person.handle}`) : undefined}>
      {person ? person.handle : name}
    </T>
  );
}

// "@" suggestions while typing (web MentionSuggest).
export function MentionSuggest({ value, onPick, style }) {
  const theme = useTheme();
  const match = String(value || "").match(/(^|\s)@([\w.]*)$/);
  if (!match) return null;
  const query = match[2].toLowerCase();
  const people = PEOPLE.filter((person) => !query || person.handle.includes(query) || person.name.toLowerCase().includes(query)).slice(0, 5);
  if (!people.length) return null;
  return (
    <View style={[styles.mention, { backgroundColor: theme.scheme === "dark" ? "#262626" : "#fff", borderColor: theme.line }, style]}>
      {people.map((person) => (
        <Pressable key={person.handle} onPress={() => { tap(); onPick(String(value).replace(/@[\w.]*$/, `@${person.handle} `)); }} style={({ pressed }) => [styles.mentionRow, pressed && { backgroundColor: theme.fill }]}>
          <Image source={{ uri: person.src }} style={styles.mentionFace} transition={120} />
          <View style={{ flex: 1 }}>
            <Name size={14} verified={person.verified}>{person.handle}</Name>
            <T size={13} color={theme.text2} lines={1}>{person.name}</T>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
// Segmented ring like the web StoryRing: one arc per frame, watched arcs muted, green for close friends.
export const StoryRing = memo(function StoryRing({ src, size = 66, total = 1, seen = 0, tone = "live" }) {
  const theme = useTheme();
  const count = Math.max(1, total);
  const gap = count > 1 ? 11 : 0;
  const sweep = (360 - gap * count) / count;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const dash = (sweep / 360) * circ;
  const muted = theme.scheme === "dark" ? "#3a3a3c" : "#c7c7c7";
  const inner = Math.round(size * 0.84);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ringB" x1="18" y1="88" x2="82" y2="12" gradientUnits="useriywaOnUse">
            <Stop offset="0" stopColor="#ffb800" />
            <Stop offset="0.45" stopColor="#ff2d55" />
            <Stop offset="1" stopColor="#c013d1" />
          </SvgGradient>
          <SvgGradient id="ringG" x1="18" y1="88" x2="82" y2="12" gradientUnits="useriywaOnUse">
            <Stop offset="0" stopColor="#1fd15a" />
            <Stop offset="1" stopColor="#0aa344" />
          </SvgGradient>
        </Defs>
        {Array.from({ length: count }, (_, index) => {
          const watched = tone === "empty" || tone === "seen" || index < seen;
          const stroke = watched ? muted : tone === "close" ? "url(#ringG)" : "url(#ringB)";
          return (
            <Circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={watched ? 3 : 5}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              rotation={-90 + index * (sweep + gap)}
              origin="50, 50"
            />
          );
        })}
      </Svg>
      <Image source={src ? { uri: src } : null} style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: theme.fill }} contentFit="cover" transition={150} recyclingKey={src} />
    </View>
  );
});

export function StoryRail() {
  const theme = useTheme();
  const store = useStore();
  const decks = useStoryDecks();
  const seenSet = useMemo(() => new Set(store.seenStories), [store.seenStories]);
  const watched = (deck) => deck.frames.filter((frame) => seenSet.has(frame.id)).length;
  const yours = decks[0]?.mine ? decks[0] : null;
  const yoursSeen = Boolean(yours && yours.frames.every((frame) => seenSet.has(frame.id)));
  const close = store.prefs?.closeFriends || [];
  const rest = useMemo(() => (yours ? decks.slice(1) : decks).slice().sort((a, b) => {
    const aSeen = a.frames.every((frame) => seenSet.has(frame.id)) ? 1 : 0;
    const bSeen = b.frames.every((frame) => seenSet.has(frame.id)) ? 1 : 0;
    return aSeen - bSeen;
  }), [decks, yours, seenSet]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      <View style={styles.story}>
        <Pressable accessibilityLabel={t("La tua storia")} onPress={() => { tap(); router.push(yours ? `/story/${yours.id}` : STORY_CAMERA); }}>
          <StoryRing src={store.profile.src || AVATAR} total={yours?.frames.length || 1} seen={yours ? watched(yours) : 0} tone={yours ? (yoursSeen ? "seen" : yours.frames.some((frame) => frame.close) ? "close" : "live") : "empty"} />
        </Pressable>
        <Pressable accessibilityLabel={t("Nuova storia")} hitSlop={6} onPress={() => { tap(); router.push(STORY_CAMERA); }} style={[styles.storyPlus, { backgroundColor: theme.blue, borderColor: theme.bg }]}>
          <Plus size={12} weight="bold" color="#fff" />
        </Pressable>
        <T size={12} color={theme.text2} lines={1}>{t("La tua storia")}</T>
      </View>
      {rest.map((deck) => {
        const seenCount = watched(deck);
        const seen = seenCount === deck.frames.length;
        const isClose = close.includes(deck.full);
        return (
          <Pressable key={deck.id} style={styles.story} onPress={() => { tap(); router.push(`/story/${deck.id}`); }}>
            <StoryRing src={deck.src} total={deck.frames.length} seen={seenCount} tone={seen ? "seen" : isClose ? "close" : "live"} />
            <T size={12} lines={1} color={seen ? theme.text2 : theme.text}>{deck.name}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Post actions: one stable object per screen so memoized rows never re-render for nothing.
// ---------------------------------------------------------------------------
export function usePostActions({ onMenu } = {}) {
  const store = useStore();
  const ref = useRef(store);
  ref.current = store;
  const menuRef = useRef(onMenu);
  menuRef.current = onMenu;
  return useMemo(() => ({
    like: (id) => { tap(); ref.current.toggleLike(id); },
    doubleLike: (id) => {
      tap("medium");
      if (!ref.current.likes.includes(id)) ref.current.toggleLike(id);
    },
    save: (id) => { tap(); ref.current.toggleSave(id); },
    follow: (name) => { tap(); ref.current.toggleFollow(name); },
    comment: (post) => router.push(`/comments/${encodeURIComponent(post.id)}`),
    share: (post) => router.push(`/share/${encodeURIComponent(post.id)}`),
    open: (post) => openPost(post.id),
    menu: (post, mine) => menuRef.current?.(post, mine),
  }), []);
}

// ---------------------------------------------------------------------------
// Feed post (web FeedPost)
// ---------------------------------------------------------------------------
function Burst({ trigger }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    v.value = 0;
    v.value = withSequence(withSpring(1, { damping: 9, stiffness: 260 }), withDelay(260, withTiming(2, { duration: 260, easing: Easing.out(Easing.quad) })));
  }, [trigger, v]);
  const style = useAnimatedStyle(() => {
    const t = v.value;
    const opacity = t <= 1 ? t : 2 - t;
    const scale = t <= 1 ? 0.2 + t * 0.92 : 1.12 - (t - 1) * 0.12;
    return { opacity, transform: [{ translateY: t <= 1 ? 0 : -(t - 1) * 40 }, { scale }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, style]}>
      <Heart size={92} weight="fill" color="#fff" style={styles.burstShadow} />
    </Animated.View>
  );
}

// An image with the post's filter (native approximation of the web CSS filter).
export function Filtered({ src, filter, style, recyclingKey, transition = 180 }) {
  const look = filterOf(filter);
  return (
    <View style={[style, { overflow: "hidden" }, look.css ? { filter: look.css } : null]}>
      <Image source={src ? { uri: src } : null} style={StyleSheet.absoluteFill} contentFit="cover" transition={transition} recyclingKey={recyclingKey || src} />
      {look.tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: look.tint[0], opacity: look.tint[1] }]} /> : null}
    </View>
  );
}

function ReelBar({ playing }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    if (playing) v.value = withTiming(1, { duration: 8000, easing: Easing.linear });
  }, [playing, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: v.value }] }));
  return (
    <View style={styles.reelBar}>
      <Animated.View style={[styles.reelBarFill, { transformOrigin: "left" }, style]} />
    </View>
  );
}

function PostMedia({ post, kind, images, onDouble, onSlide, burst }) {
  const theme = useTheme();
  const [showTags, setShowTags] = useState(false);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = useRef({ at: 0, timer: 0 });
  const height = post.aspect === "1:1" ? W : Math.round(W * 1.25);
  useEffect(() => () => clearTimeout(last.current.timer), []);

  const press = () => {
    const now = Date.now();
    if (now - last.current.at < 280) {
      clearTimeout(last.current.timer);
      last.current.at = 0;
      onDouble();
      return;
    }
    last.current.at = now;
    // A single tap on a photo does nothing (only a double tap likes it), like Instagram.
    if (kind !== "reel") return;
    last.current.timer = setTimeout(() => {
      last.current.at = 0;
      setPlaying((value) => !value);
    }, 260);
  };

  return (
    <View style={{ width: W, height, backgroundColor: theme.fill }}>
      {images.length > 1 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / W);
            if (next !== slide) { setSlide(next); onSlide(next); }
          }}
        >
          {images.map((src, index) => (
            <Pressable key={`${index}-${src}`} onPress={press}>
              <Filtered src={src} filter={post.filter} style={{ width: W, height }} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={press} accessibilityLabel={kind === "reel" ? (playing ? t("Pausa reel, {name}", { name: post.name }) : t("Riproduci reel, {name}", { name: post.name })) : t("Apri post di {name}", { name: post.name })}>
          <Filtered src={images[0]} filter={post.filter} style={{ width: W, height }} />
        </Pressable>
      )}
      {images.length > 1 ? (
        <View pointerEvents="none" style={styles.count}><T size={12} weight="600" color="#fff">{slide + 1}/{images.length}</T></View>
      ) : null}
      {kind === "reel" ? (
        <>
          <View pointerEvents="none" style={styles.reelMark}><ReelGlyph size={22} color="#fff" weight="bold" /></View>
          {!playing ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}><View style={styles.play}><PlayGlyph size={26} weight="fill" color="#fff" style={{ marginLeft: 3 }} /></View></View> : null}
          <ReelBar playing={playing} />
        </>
      ) : null}
      {post.tags?.length && kind !== "reel" ? (
        <>
          {showTags ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {post.tags.map((name, index) => (
                <View key={name} style={[styles.tagPillWrap, { left: `${18 + ((index * 37) % 60)}%`, top: `${30 + ((index * 23) % 45)}%` }]}>
                  <View style={styles.tagArrow} />
                  <View style={styles.tagPill}><TagName name={name} color="#fff" /></View>
                </View>
              ))}
            </View>
          ) : null}
          <Pressable accessibilityLabel={t("Persone taggate")} hitSlop={8} onPress={() => { tap(); setShowTags((value) => !value); }} style={[styles.tagBtn, showTags && { backgroundColor: "#fff" }]}>
            <UserGlyph size={15} weight="fill" color={showTags ? "#000" : "#fff"} />
          </Pressable>
        </>
      ) : null}
      <Burst trigger={burst} />
    </View>
  );
}

export const FeedPost = memo(function FeedPost({ post, liked, saved, following, extraComments, mine, canFollow, showCounts = true, actions, onOpen }) {
  const theme = useTheme();
  const [slide, setSlide] = useState(0);
  const [burst, setBurst] = useState(0);
  const kind = post.kind === "reel" || post.type === "reel" ? "reel" : post.kind === "tweet" || post.type === "tweet" || !post.image ? "tweet" : "post";
  const images = Array.isArray(post.images) && post.images.length ? post.images : [post.image];
  const comments = commentCount(post, extraComments);
  const time = post.time === "Now" ? t("Adesso") : typeof post.time === "string" ? t(post.time) : post.time;
  const sub = kind === "reel" ? (post.audio ? t(post.audio) : t("Audio originale")) : String(post.place || post.handle || "");
  const openAuthor = () => (mine ? openTab("profile") : openPerson(post.name));
  const doubleLike = useCallback(() => { actions.doubleLike(post.id); setBurst(Date.now()); }, [actions, post.id]);

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <Pressable onPress={openAuthor} style={styles.headHit}>
          <LinearGradient colors={["#ffb800", "#ff2d55", "#c013d1"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.headRing}>
            <View style={[styles.headInner, { borderColor: theme.bg }]}>
              <Image source={{ uri: post.src || post.avatar || AVATAR }} style={styles.headFace} transition={150} recyclingKey={post.src} />
            </View>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Name size={14} verified={post.verified}>{post.name}</Name>
            {sub ? <T size={12} lines={1}>{sub}</T> : null}
          </View>
        </Pressable>
        {!mine && canFollow && !following ? (
          <Pressable onPress={() => actions.follow(post.name)} style={({ pressed }) => [styles.followLink, { backgroundColor: theme.btn, opacity: pressed ? 0.7 : 1 }]}>
            <T size={13.5} weight="600">{t("Segui")}</T>
          </Pressable>
        ) : null}
        <Pressable accessibilityLabel={t("Altro")} hitSlop={8} onPress={() => { tap(); actions.menu(post, mine); }} style={styles.more}>
          <More size={22} weight="bold" color={theme.text} />
        </Pressable>
      </View>

      {kind === "tweet" ? (
        <Rich text={post.text} size={16} style={styles.tweetText} />
      ) : (
        <PostMedia post={post} kind={kind} images={images} onDouble={doubleLike} onSlide={setSlide} burst={burst} />
      )}

      <View style={styles.actions}>
        <Pressable accessibilityLabel={t("Mi piace")} accessibilityState={{ selected: liked }} onPress={() => actions.like(post.id)} style={styles.act}>
          <Heart size={25} weight={liked ? "fill" : "regular"} color={liked ? theme.red : theme.text} />
        </Pressable>
        <Pressable accessibilityLabel={t("Commenta")} onPress={() => actions.comment(post)} style={styles.act}>
          <Comment size={25} color={theme.text} />
        </Pressable>
        <Pressable accessibilityLabel={t("Condividi")} onPress={() => actions.share(post)} style={styles.act}>
          <Send size={24} color={theme.text} />
        </Pressable>
        <View style={styles.dots} pointerEvents="none">
          {images.length > 1 && kind !== "tweet" ? images.map((src, index) => <View key={`${index}-${src}`} style={[styles.dot, { backgroundColor: index === slide ? theme.blue : theme.text3 }]} />) : null}
        </View>
        <Pressable accessibilityLabel={t("Salva")} accessibilityState={{ selected: saved }} onPress={() => actions.save(post.id)} style={styles.act}>
          <Bookmark size={25} weight={saved ? "fill" : "regular"} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.meta}>
        {showCounts && !post.hideLikes ? <T size={14} weight="600">{t("{n} Mi piace", { n: tally(post.likes || "0", liked) })}</T> : null}
        {post.tags?.length ? (
          <View style={styles.tagged}>
            <At size={14} color={theme.text2} />
            <T size={13} color={theme.text2} style={{ flexShrink: 1 }}>
              {post.tags.map((name, index) => (
                <Fragment key={name}>{index ? ", " : ""}<TagName name={name} color={theme.text2} /></Fragment>
              ))}
            </T>
          </View>
        ) : null}
        {kind !== "tweet" && post.text ? (
          <Rich text={post.text} style={{ marginTop: 4 }} prefix={<T size={14} weight="600">{post.name} </T>} />
        ) : null}
        {comments > 0 ? (
          <Pressable onPress={() => actions.comment(post)} style={{ marginTop: 4 }}>
            <T size={14} color={theme.text2}>{t("Mostra tutti i {n} commenti", { n: comments })}</T>
          </Pressable>
        ) : null}
        {time ? <T size={12} color={theme.text2} style={{ marginTop: 4 }}>{time}</T> : null}
      </View>
    </View>
  );
});

// A FeedPost wired to the store, for single posts outside the Home list.
export function PostCard({ post, onOpen }) {
  const store = useStore();
  const [menu, setMenu] = useState(null);
  const actions = usePostActions({ onMenu: (target, mine) => setMenu({ post: target, mine }) });
  const mine = Boolean(post.mine);
  return (
    <>
      <FeedPost
        post={post}
        liked={store.likes.includes(post.id)}
        saved={store.saves.includes(post.id)}
        following={store.follows.includes(post.name)}
        extraComments={store.postComments?.[post.id]}
        mine={mine}
        canFollow={post.name !== store.profile.name}
        showCounts={store.prefs?.likeCounts !== false}
        actions={actions}
        onOpen={onOpen || (() => {})}
      />
      <PostMenu target={menu} onClose={() => setMenu(null)} onDeleted={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
    </>
  );
}

// ---------------------------------------------------------------------------
// "Altro" menu of a post (web .ig-menu), as a bottom sheet.
// ---------------------------------------------------------------------------
export function PostMenu({ target, onClose, onDeleted }) {
  const theme = useTheme();
  const store = useStore();
  const post = target?.post;
  const mine = target?.mine;
  const saved = post ? store.saves.includes(post.id) : false;
  const following = post ? store.follows.includes(post.name) : false;
  const canFollow = post && post.name !== store.profile.name;
  const inLibrary = post ? (store.library || []).some((item) => item.id === post.id) : false;
  const rows = [];
  if (post) {
    if (mine) {
      if (target.archivable ?? (inLibrary || post.mine)) rows.push({ label: store.archived?.includes(post.id) ? t("Mostra nel profilo") : t("Archivia"), run: () => store.toggleArchive(post.id) });
      if (inLibrary) rows.push({ label: t("Elimina"), danger: true, run: () => { store.dropPost(post.id); onDeleted?.(post.id); } });
    } else {
      rows.push({ label: saved ? t("Rimuovi dai salvati") : t("Salva"), run: () => store.toggleSave(post.id) });
      if (canFollow) rows.push({ label: following ? t("Non seguire più") : t("Segui"), run: () => store.toggleFollow(post.name) });
    }
    rows.push({ label: t("Condividi"), run: () => setTimeout(() => router.push(`/share/${encodeURIComponent(post.id)}`), 260) });
  }
  return (
    <Sheet open={Boolean(post)} onClose={onClose}>
      <View style={[styles.menu, { backgroundColor: theme.card }]}>
        {rows.map((row, index) => (
          <Pressable
            key={row.label}
            onPress={() => { tap(); onClose(); row.run(); }}
            style={({ pressed }) => [styles.menuRow, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null, pressed && { backgroundColor: theme.fill }]}
          >
            <T size={16} weight={row.danger ? "600" : "400"} color={row.danger ? theme.red : theme.text}>{row.label}</T>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

export function sharePostNative(post) {
  const url = `${SHARE_BASE}${post.id}`;
  return Share.share({ title: post.name, message: `${post.name}: ${post.text || ""}\n${url}`.trim(), url }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Home blocks
// ---------------------------------------------------------------------------
export const SuggestRail = memo(function SuggestRail({ people, follows, onFollow }) {
  const theme = useTheme();
  return (
    <View style={[styles.suggest, { borderColor: theme.line }]}>
      <T size={15} weight="600" style={styles.suggestTitle}>{t("Persone che potresti conoscere")}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRail}>
        {people.map((person) => {
          const on = follows.includes(person.name);
          const known = personByName(person.name);
          return (
            <Pressable key={person.name} onPress={() => known && router.push(`/person/${known.handle}`)} style={[styles.suggestCard, { borderColor: theme.line }]}>
              <Image source={{ uri: person.src }} style={styles.suggestFace} transition={150} recyclingKey={person.src} />
              <T size={13.5} weight="600" lines={1}>{person.name}</T>
              <T size={12} color={theme.text2} lines={1}>{person.meta}</T>
              <Pressable onPress={() => onFollow(person.name)} style={({ pressed }) => [styles.suggestBtn, { backgroundColor: on ? theme.btn : theme.blue, opacity: pressed ? 0.75 : 1 }]}>
                <T size={14} weight="600" color={on ? theme.text : "#fff"}>{on ? t("Segui già") : t("Segui")}</T>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const ReelCard = memo(function ReelCard({ reel, on, onToggle }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => onToggle(reel.id)} accessibilityLabel={on ? t("Pausa reel, {name}", { name: reel.name }) : t("Riproduci reel, {name}", { name: reel.name })} style={[styles.reelCard, { backgroundColor: theme.fill }]}>
      <Image source={{ uri: reel.src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={reel.src} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.45)"]} style={[StyleSheet.absoluteFill, { top: "50%" }]} />
      <View style={styles.reelViews}><PlayGlyph size={12} weight="fill" color="#fff" /><T size={12.5} weight="600" color="#fff">{reel.likes}</T></View>
      <ReelBar playing={on} />
    </Pressable>
  );
});

export const ReelsRail = memo(function ReelsRail({ prefs }) {
  const theme = useTheme();
  const [playing, setPlaying] = useState(null);
  const toggle = useCallback((id) => { tap(); setPlaying((value) => (value === id ? null : id)); }, []);
  return (
    <View style={[styles.suggest, { borderColor: theme.line }]}>
      <T size={15} weight="600" style={styles.suggestTitle}>{t("Reels")}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRail}>
        {REELS.filter((reel) => shown(prefs, reel)).map((reel) => <ReelCard key={reel.id} reel={reel} on={playing === reel.id} onToggle={toggle} />)}
      </ScrollView>
    </View>
  );
});

export function FeaturedHead({ onAll }) {
  const theme = useTheme();
  return (
    <View style={[styles.featuredHead, { borderTopColor: theme.line }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather size={16} weight="fill" color={theme.text} />
        <T size={15} weight="700">{t("Pensieri per te")}</T>
      </View>
      <Pressable hitSlop={8} onPress={onAll}><T size={14} weight="600" color={theme.blue}>{t("Vedi tutti")}</T></Pressable>
    </View>
  );
}

export function FeedFooter({ done }) {
  const theme = useTheme();
  if (!done) return <View style={styles.footer}><Spinner /></View>;
  return (
    <View style={styles.footer}>
      <LinearGradient colors={["#ffb800", "#ff2d55", "#c013d1"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.caughtRing}>
        <View style={[styles.caughtInner, { backgroundColor: theme.bg }]}><ChecksGlyph size={30} color={theme.text} /></View>
      </LinearGradient>
      <T size={17} weight="600">{t("Sei aggiornato")}</T>
      <T size={14} color={theme.text2}>{t("Hai visto tutti i nuovi post")}</T>
    </View>
  );
}

export function Spinner({ size = 22 }) {
  const theme = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1);
  }, [v]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.value}deg` }] }));
  return <Animated.View accessibilityLabel={t("Caricamento")} style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: theme.text3, borderTopColor: theme.text2 }, style]} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  rail: { paddingHorizontal: 8, gap: 2, paddingTop: 6, paddingBottom: 10 },
  story: { width: 80, alignItems: "center", gap: 5 },
  storyPlus: { position: "absolute", right: 6, top: 46, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  post: { marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 4 },
  headHit: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  headRing: { width: 34, height: 34, borderRadius: 17, padding: 2 },
  headInner: { flex: 1, borderRadius: 15, borderWidth: 2, overflow: "hidden" },
  headFace: { width: "100%", height: "100%" },
  followLink: { height: 30, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  more: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tweetText: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 4, letterSpacing: -0.15 },
  count: { position: "absolute", top: 12, right: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.6)" },
  reelMark: { position: "absolute", top: 12, right: 12 },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center" },
  reelBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  reelBarFill: { height: 2, width: "100%", backgroundColor: "#fff" },
  tagBtn: { position: "absolute", left: 10, bottom: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" },
  tagPillWrap: { position: "absolute", alignItems: "center", transform: [{ translateX: "-50%" }] },
  tagArrow: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "rgba(0,0,0,0.78)" },
  tagPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.78)" },
  burstShadow: { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  actions: { flexDirection: "row", alignItems: "center", paddingTop: 4, paddingHorizontal: 6 },
  act: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  dots: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginRight: 84 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { paddingHorizontal: 14 },
  tagged: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  menu: { borderRadius: 14, overflow: "hidden", marginBottom: 6 },
  menuRow: { paddingVertical: 15, paddingHorizontal: 16 },
  suggest: { marginTop: 4, marginBottom: 16, paddingTop: 10, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestTitle: { paddingHorizontal: 14, paddingBottom: 10 },
  suggestRail: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  suggestCard: { width: 158, alignItems: "center", gap: 2, paddingTop: 18, paddingHorizontal: 12, paddingBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  suggestFace: { width: 84, height: 84, borderRadius: 42, marginBottom: 8 },
  suggestBtn: { alignSelf: "stretch", height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 10 },
  reelCard: { width: 132, height: 234, borderRadius: 8, overflow: "hidden" },
  reelViews: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  featuredHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, paddingTop: 14, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth },
  footer: { marginVertical: 8, paddingTop: 16, paddingBottom: 24, alignItems: "center", gap: 4 },
  caughtRing: { width: 64, height: 64, borderRadius: 32, padding: 2, marginBottom: 8 },
  caughtInner: { flex: 1, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  mention: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 8 },
  mentionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12 },
  mentionFace: { width: 34, height: 34, borderRadius: 17 },
});
