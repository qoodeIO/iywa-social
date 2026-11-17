import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, { Easing, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { INSET, useTheme } from "../theme";
import { filterOf } from "../lib/stories";
import { euro } from "../data";
import { deletePost, editPost, like, postCard, toggleFollow, toggleLike, toggleSave, usePost, usePostLikes, useProduct, useProfile, useSearch, useStories } from "../lib/social";
import { myHandle, useMe } from "../lib/session";
import { errorText } from "../lib/api";
import { At, Bag, Bookmark, ChevronRight, Comment, Heart, More, Plus, Send } from "./icons";
import { ChecksGlyph, PlayGlyph, ReelGlyph, UserGlyph } from "./feedIcons";
import { Name, Sheet, T, tap } from "./kit";
import { SHARE_BASE, commentCount, shapePost, tally } from "./feedData";
import { t } from "../lib/i18n";
import { showToast } from "./feedEcho";
import { openTab } from "../lib/tabs";

const W = Dimensions.get("window").width;

// Where the story camera lives (owned by the stories area).
export const STORY_CAMERA = "/story/new";

export function failAlert(error) {
  Alert.alert(errorText(error, t));
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------
export function openHandle(handle) {
  const key = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!key) return;
  if (key === myHandle()) {
    if (router.canDismiss()) router.dismissAll();
    openTab("profile");
  } else {
    router.push(`/person/${encodeURIComponent(key)}`);
  }
}

// People are identified by handle; kept under the old name for callers that still use it.
export const openPerson = openHandle;

export function openTag(tag) {
  const key = String(tag || "").replace(/^#/, "").toLowerCase();
  if (key) router.push(`/hashtag/${encodeURIComponent(key)}`);
}

export function openPost(id) {
  router.push(`/post/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// A person's face, or their initial on a grey circle when they have no photo.
// ---------------------------------------------------------------------------
export function Face({ src, name, size = 34, style }) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill };
  if (src) return <Image source={{ uri: src }} style={[box, style]} contentFit="cover" transition={120} recyclingKey={src} />;
  const initial = String(name || "").replace(/^@/, "").trim().charAt(0).toUpperCase();
  return (
    <View style={[box, styles.center, style]}>
      <T size={Math.round(size * 0.42)} weight="600" color={theme.text2}>{initial}</T>
    </View>
  );
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

// A tagged person (by handle): opens their profile.
export function TagName({ handle, name, size = 13, color, weight = "600" }) {
  const key = String(handle || name || "").replace(/^@/, "");
  return (
    <T size={size} weight={weight} color={color} onPress={key ? () => openHandle(key) : undefined}>{key}</T>
  );
}

export function useDebounced(value, ms = 250) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return out;
}

// "@" suggestions while typing, from the server's people search.
export function MentionSuggest({ value, onPick, style }) {
  const theme = useTheme();
  const match = String(value || "").match(/(^|\s)@([\w.]*)$/);
  const query = useDebounced(match ? match[2].toLowerCase() : "", 200);
  const { data } = useSearch(match && query ? query : "");
  if (!match || !query) return null;
  const people = (data?.people || []).filter((person) => person.handle !== myHandle()).slice(0, 5);
  if (!people.length) return null;
  return (
    <View style={[styles.mention, { backgroundColor: theme.scheme === "dark" ? "#262626" : "#fff", borderColor: theme.line }, style]}>
      {people.map((person) => (
        <Pressable key={person.handle} onPress={() => { tap(); onPick(String(value).replace(/@[\w.]*$/, `@${person.handle} `)); }} style={({ pressed }) => [styles.mentionRow, pressed && { backgroundColor: theme.fill }]}>
          <Face src={person.avatar} name={person.name || person.handle} size={34} />
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
// After you publish a story your ring turns once (web ".story.yours.posted .ring-svg").
function RingSpin({ at, children }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!at) return;
    v.value = 0;
    // Starts as the camera flies into the rail and closes.
    v.value = withDelay(420, withTiming(1, { duration: 1200, easing: Easing.bezier(0.32, 0.72, 0, 1) }));
  }, [at, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.value * 360}deg` }, { scale: 1 + Math.sin(v.value * Math.PI) * 0.06 }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

export const StoryRing = memo(function StoryRing({ src, name, size = 66, total = 1, seen = 0, tone = "live", spinAt = 0 }) {
  const theme = useTheme();
  const count = Math.max(1, total);
  const gap = count > 1 ? 11 : 0;
  const sweep = (360 - gap * count) / count;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const dash = (sweep / 360) * circ;
  const muted = theme.scheme === "dark" ? "#3a3a3c" : "#c7c7c7";
  const inner = Math.round(size * 0.84);
  const ring = (
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ringB" x1="18" y1="88" x2="82" y2="12" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffb800" />
            <Stop offset="0.45" stopColor="#ff2d55" />
            <Stop offset="1" stopColor="#c013d1" />
          </SvgGradient>
          <SvgGradient id="ringG" x1="18" y1="88" x2="82" y2="12" gradientUnits="userSpaceOnUse">
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
  );
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {spinAt ? <RingSpin at={spinAt}>{ring}</RingSpin> : ring}
      <Face src={src} name={name} size={inner} />
    </View>
  );
});

// Stories of the people I follow (and mine), from the server.
export function StoryRail() {
  const theme = useTheme();
  const me = useMe();
  const { data: decks } = useStories();
  const list = decks || [];
  const yours = list.find((deck) => deck.mine) || null;
  const rest = list.filter((deck) => !deck.mine);
  // A new frame in my story (not the ones loading at launch) plays the "posted" turn.
  const mineCount = yours?.frames.length || 0;
  const counted = useRef(decks ? mineCount : -1);
  const [postedAt, setPostedAt] = useState(0);
  useEffect(() => {
    if (!decks) return;
    if (counted.current >= 0 && mineCount > counted.current) setPostedAt(Date.now());
    counted.current = mineCount;
  }, [mineCount, decks]);
  const watched = (deck) => deck.frames.filter((frame) => frame.seen).length;
  const myHandleNow = me?.handle;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      <View style={styles.story}>
        <Pressable accessibilityLabel={t("La tua storia")} onPress={() => { tap(); router.push(yours && myHandleNow ? `/story/${myHandleNow}` : STORY_CAMERA); }}>
          <StoryRing
            src={me?.avatar}
            name={me?.name || myHandleNow}
            total={yours?.frames.length || 1}
            seen={yours ? watched(yours) : 0}
            tone={yours ? (yours.seen ? "seen" : yours.frames.some((frame) => frame.closeFriends) ? "close" : "live") : "empty"}
            spinAt={postedAt}
          />
        </Pressable>
        <Pressable accessibilityLabel={t("Nuova storia")} hitSlop={6} onPress={() => { tap(); router.push(STORY_CAMERA); }} style={[styles.storyPlus, { backgroundColor: theme.blue, borderColor: theme.bg }]}>
          <Plus size={12} weight="bold" color="#fff" />
        </Pressable>
        <T size={12} color={theme.text2} lines={1}>{t("La tua storia")}</T>
      </View>
      {rest.map((deck) => {
        const seen = Boolean(deck.seen);
        const close = deck.frames.some((frame) => frame.closeFriends && !frame.seen);
        return (
          <Pressable key={deck.handle} accessibilityLabel={t("Storia di {name}", { name: deck.name || deck.handle })} style={styles.story} onPress={() => { tap(); router.push(`/story/${encodeURIComponent(deck.handle)}`); }}>
            <StoryRing src={deck.avatar} name={deck.name || deck.handle} total={deck.frames.length} seen={watched(deck)} tone={seen ? "seen" : close ? "close" : "live"} />
            <T size={12} lines={1} color={seen ? theme.text2 : theme.text}>{deck.handle}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Post actions: one stable object per screen so memoized rows never re-render for nothing.
// Every action takes the post (card or server shape) and goes to the server.
// ---------------------------------------------------------------------------
export function usePostActions({ onMenu } = {}) {
  const menuRef = useRef(onMenu);
  menuRef.current = onMenu;
  return useMemo(() => ({
    like: (post) => { tap(); toggleLike(post).catch(failAlert); },
    doubleLike: (post) => { tap("medium"); like(post).catch(failAlert); },
    save: (post) => {
      tap();
      toggleSave(post).then((on) => showToast({ text: on ? t("Salvato") : t("Rimosso dai salvati") })).catch(failAlert);
    },
    follow: (person) => { tap(); toggleFollow(person).catch(failAlert); },
    comment: (post) => router.push(`/comments/${encodeURIComponent(post.id)}`),
    share: (post) => router.push(`/share/${encodeURIComponent(post.id)}`),
    open: (post) => openPost(post.id),
    menu: (post, mine) => menuRef.current?.(post, mine),
  }), []);
}

// Which posts are on screen: a playing video stops when its post scrolls away.
let visiblePosts = null;
const visibleSubs = new Set();
export function setVisiblePosts(ids) {
  visiblePosts = new Set(ids);
  visibleSubs.forEach((fn) => fn());
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

// An image with a look (native approximation of the web CSS filter).
export function Filtered({ src, filter, style, recyclingKey, transition = 180 }) {
  const look = filterOf(filter);
  return (
    <View style={[style, { overflow: "hidden" }, look.css ? { filter: look.css } : null]}>
      <Image source={src ? { uri: src } : null} style={StyleSheet.absoluteFill} contentFit="cover" transition={transition} recyclingKey={recyclingKey || src} />
      {look.tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: look.tint[0], opacity: look.tint[1] }]} /> : null}
    </View>
  );
}

// A reel's video: plays on tap, loops; before the first frame the poster (if any) shows.
function PostVideo({ url, poster, playing, height }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(url, (p) => { p.loop = true; });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);
  return (
    <View style={{ width: W, height, backgroundColor: "#000" }}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} onFirstFrameRender={() => setReady(true)} />
      {poster && !ready ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} /> : null}
    </View>
  );
}

function openProduct(owner, id) {
  router.push(`/product/${encodeURIComponent(owner)}/${encodeURIComponent(id)}`);
}

// One product pin (server shape { owner, id }); a product that no longer exists shows nothing.
function ProductPin({ owner, id, index }) {
  const { data } = useProduct(owner, id);
  const product = data?.product;
  if (!product) return null;
  return (
    <View pointerEvents="box-none" style={[styles.tagPillWrap, { left: `${30 + ((index * 41) % 45)}%`, top: `${32 + ((index * 29) % 40)}%` }]}>
      <Animated.View entering={ZoomIn.springify().damping(14).delay(index * 60)} style={{ alignItems: "center" }}>
        <View style={styles.tagArrow} />
        <Pressable accessibilityRole="link" accessibilityLabel={`${product.name}, ${euro(product.price)}`} onPress={() => { tap(); openProduct(owner, id); }} style={({ pressed }) => [styles.tagPill, styles.prodPill, pressed && { opacity: 0.8 }]}>
          <T size={13} weight="600" color="#fff" lines={1}>{product.name}</T>
          <T size={12} weight="500" color="rgba(255,255,255,0.8)">{euro(product.price)}</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Height from the first photo's size, between 1.91:1 and 4:5 like Instagram.
function mediaHeight(post) {
  const first = post.media?.[0];
  if (!first?.w || !first?.h) return Math.round(W * 1.25);
  return Math.round(W * Math.min(1.25, Math.max(0.524, first.h / first.w)));
}

function PostMedia({ post, kind, images, onDouble, onSlide, burst, shop }) {
  const theme = useTheme();
  const [showTags, setShowTags] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = useRef({ at: 0, timer: 0 });
  const height = mediaHeight(post);
  const video = kind === "reel" ? post.video : null;
  const poster = video ? post.media?.find((m) => m.type === "video")?.poster : null;
  useEffect(() => () => clearTimeout(last.current.timer), []);
  // Rows are recycled: a new post starts from its first slide, paused.
  useEffect(() => {
    setPlaying(false);
    setSlide(0);
    setShowTags(false);
    setShowShop(false);
  }, [post.id]);
  useEffect(() => {
    if (!playing) return undefined;
    const check = () => { if (visiblePosts && !visiblePosts.has(post.id)) setPlaying(false); };
    visibleSubs.add(check);
    return () => visibleSubs.delete(check);
  }, [playing, post.id]);

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
      {video ? (
        <Pressable onPress={press} accessibilityLabel={playing ? t("Pausa reel, {name}", { name: post.name }) : t("Riproduci reel, {name}", { name: post.name })}>
          {playing || !poster ? <PostVideo url={video} poster={poster} playing={playing} height={height} /> : <Filtered src={poster} style={{ width: W, height }} />}
        </Pressable>
      ) : images.length > 1 ? (
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
              <Filtered src={src} style={{ width: W, height }} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={press} accessibilityLabel={t("Apri post di {name}", { name: post.name })}>
          <Filtered src={images[0]} style={{ width: W, height }} />
        </Pressable>
      )}
      {images.length > 1 && !video ? (
        <View pointerEvents="none" style={styles.count}><T size={12} weight="600" color="#fff">{slide + 1}/{images.length}</T></View>
      ) : null}
      {kind === "reel" ? (
        <>
          <View pointerEvents="none" style={styles.reelMark}><ReelGlyph size={22} color="#fff" weight="bold" /></View>
          {!playing ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}><View style={styles.play}><PlayGlyph size={26} weight="fill" color="#fff" style={{ marginLeft: 3 }} /></View></View> : null}
        </>
      ) : null}
      {post.tags?.length && kind !== "reel" ? (
        <>
          {showTags ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {post.tags.map((handle, index) => (
                <View key={handle} style={[styles.tagPillWrap, { left: `${18 + ((index * 37) % 60)}%`, top: `${30 + ((index * 23) % 45)}%` }]}>
                  <View style={styles.tagArrow} />
                  <View style={styles.tagPill}><TagName handle={handle} color="#fff" /></View>
                </View>
              ))}
            </View>
          ) : null}
          <Pressable accessibilityLabel={t("Persone taggate")} hitSlop={8} onPress={() => { tap(); setShowTags((value) => !value); }} style={[styles.tagBtn, showTags && { backgroundColor: "#fff" }]}>
            <UserGlyph size={15} weight="fill" color={showTags ? "#000" : "#fff"} />
          </Pressable>
        </>
      ) : null}
      {shop.length ? (
        <>
          {showShop ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {shop.map((pin, index) => <ProductPin key={`${pin.owner}-${pin.id}`} owner={pin.owner} id={pin.id} index={index} />)}
            </View>
          ) : null}
          <Pressable accessibilityLabel={t("Prodotti")} accessibilityState={{ selected: showShop }} hitSlop={8} onPress={() => { tap(); setShowShop((value) => !value); }} style={[styles.shopBtn, showShop && { backgroundColor: "#fff" }]}>
            <Bag size={15} weight="fill" color={showShop ? "#000" : "#fff"} />
          </Pressable>
        </>
      ) : null}
      <Burst trigger={burst} />
    </View>
  );
}

// `post` is a card (postCard) of a server post: liked, saved and the counts come with it.
// `follow` is the author's { handle, isFollowing, requested } when a "Segui" button should show.
export const FeedPost = memo(function FeedPost({ post, mine, follow, showCounts = true, actions }) {
  const theme = useTheme();
  const [slide, setSlide] = useState(0);
  const [burst, setBurst] = useState(0);
  const [likers, setLikers] = useState(false);
  const kind = post.kind === "reel" ? "reel" : post.kind === "tweet" || !post.image ? "tweet" : "post";
  const images = Array.isArray(post.images) && post.images.length ? post.images : [post.image];
  const comments = commentCount(post);
  const isMine = mine ?? post.mine;
  const sub = kind === "reel" ? (post.audio || t("Audio originale")) : String(post.place || "");
  const doubleLike = useCallback(() => { actions.doubleLike(post); setBurst(Date.now()); }, [actions, post]);
  const shop = kind === "tweet" ? [] : (post.products || []).filter((pin) => pin?.owner && pin?.id);
  const showLikes = showCounts && (!post.hideLikes || isMine);
  const deck = (useStories().data || []).find((item) => item.handle === post.owner && item.frames?.length);

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <Pressable onPress={() => (deck ? router.push(`/story/${post.owner}`) : openHandle(post.owner))} style={styles.headHit}>
          {/* Ring only when the author has a story up: colour if unseen, grey if seen. */}
          <LinearGradient colors={deck ? (deck.seen ? [theme.line, theme.line] : ["#ffb800", "#ff2d55", "#c013d1"]) : ["transparent", "transparent"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.headRing}>
            <View style={[styles.headInner, { borderColor: deck ? theme.bg : "transparent" }]}>
              <Face src={post.src} name={post.name || post.owner} size={26} />
            </View>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Name size={14} verified={post.verified}>{post.owner}</Name>
            {sub ? <T size={12} lines={1}>{sub}</T> : null}
          </View>
        </Pressable>
        {!isMine && follow && !follow.isFollowing ? (
          <Pressable onPress={() => actions.follow(follow)} style={({ pressed }) => [styles.followLink, { backgroundColor: theme.btn, opacity: pressed ? 0.7 : 1 }]}>
            <T size={13.5} weight="600">{follow.requested ? t("Richiesta inviata") : t("Segui")}</T>
          </Pressable>
        ) : null}
        <Pressable accessibilityLabel={t("Altro")} hitSlop={8} onPress={() => { tap(); actions.menu(post, isMine); }} style={styles.more}>
          <More size={22} weight="bold" color={theme.text} />
        </Pressable>
      </View>

      {kind === "tweet" ? (
        <Rich text={post.text} size={16} style={styles.tweetText} />
      ) : (
        <PostMedia post={post} kind={kind} images={images} onDouble={doubleLike} onSlide={setSlide} burst={burst} shop={shop} />
      )}

      {shop.length ? (
        <Pressable accessibilityRole="link" onPress={() => { tap(); openProduct(shop[0].owner, shop[0].id); }} style={({ pressed }) => [styles.shopStrip, pressed && { opacity: 0.6 }]}>
          <Bag size={17} weight="fill" color={theme.text} />
          <T size={14} weight="600" style={{ flex: 1 }}>{shop.length > 1 ? t("Visualizza prodotti · {n}", { n: shop.length }) : t("Visualizza prodotti")}</T>
          <ChevronRight size={14} weight="bold" color={theme.text3} />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable accessibilityLabel={t("Mi piace")} accessibilityState={{ selected: Boolean(post.liked) }} onPress={() => actions.like(post)} style={styles.act}>
          <Heart size={25} weight={post.liked ? "fill" : "regular"} color={post.liked ? theme.red : theme.text} />
        </Pressable>
        {!post.commentsOff || isMine ? (
          <Pressable accessibilityLabel={t("Commenta")} onPress={() => actions.comment(post)} style={styles.act}>
            <Comment size={25} color={theme.text} />
          </Pressable>
        ) : null}
        <Pressable accessibilityLabel={t("Condividi")} onPress={() => actions.share(post)} style={styles.act}>
          <Send size={24} color={theme.text} />
        </Pressable>
        <View style={styles.dots} pointerEvents="none">
          {images.length > 1 && kind === "post" ? images.map((src, index) => <View key={`${index}-${src}`} style={[styles.dot, { backgroundColor: index === slide ? theme.blue : theme.text3 }]} />) : null}
        </View>
        <Pressable accessibilityLabel={t("Salva")} accessibilityState={{ selected: Boolean(post.saved) }} onPress={() => actions.save(post)} style={styles.act}>
          <Bookmark size={25} weight={post.saved ? "fill" : "regular"} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.meta}>
        {showLikes && post.likes > 0 ? (
          <Pressable onPress={() => { tap(); setLikers(true); }} hitSlop={4}>
            <T size={14} weight="600">{post.likes === 1 ? t("1 Mi piace") : t("{n} Mi piace", { n: tally(post.likes) })}</T>
          </Pressable>
        ) : null}
        {post.tags?.length ? (
          <View style={styles.tagged}>
            <At size={14} color={theme.text2} />
            <T size={13} color={theme.text2} style={{ flexShrink: 1 }}>
              {post.tags.map((handle, index) => (
                <Fragment key={handle}>{index ? ", " : ""}<TagName handle={handle} color={theme.text2} /></Fragment>
              ))}
            </T>
          </View>
        ) : null}
        {kind !== "tweet" && post.text ? (
          <Rich text={post.text} style={{ marginTop: 4 }} prefix={<T size={14} weight="600" onPress={() => openHandle(post.owner)}>{post.owner} </T>} />
        ) : null}
        {comments > 0 && !post.commentsOff ? (
          <Pressable onPress={() => actions.comment(post)} style={{ marginTop: 4 }}>
            <T size={14} color={theme.text2}>{comments === 1 ? t("Mostra 1 commento") : t("Mostra tutti i {n} commenti", { n: comments })}</T>
          </Pressable>
        ) : null}
        {post.time ? <T size={12} color={theme.text2} style={{ marginTop: 4 }}>{post.time}</T> : null}
      </View>
      {likers ? <LikesSheet postId={post.id} onClose={() => setLikers(false)} /> : null}
    </View>
  );
});

// Who liked a post.
function LikesSheet({ postId, onClose }) {
  const theme = useTheme();
  const { data: people, loading, error, refresh } = usePostLikes(postId);
  const me = myHandle();
  return (
    <Sheet open onClose={onClose} title={t("Mi piace")}>
      {loading && !people ? <View style={styles.footer}><Spinner /></View> : null}
      {error && !people ? <RetryLine error={error} onRetry={refresh} /> : null}
      <ScrollView style={{ maxHeight: 420 }}>
        {(people || []).map((person) => {
          const on = person.isFollowing || person.requested;
          return (
            <Pressable key={person.handle} onPress={() => { onClose(); later(() => openHandle(person.handle)); }} style={styles.likerRow}>
              <Face src={person.avatar} name={person.name || person.handle} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Name size={14} verified={person.verified}>{person.handle}</Name>
                <T size={13} color={theme.text2} lines={1}>{person.name}</T>
              </View>
              {person.handle !== me ? (
                <Pressable onPress={() => { tap(); toggleFollow(person).catch(failAlert); }} style={({ pressed }) => [styles.likerBtn, { backgroundColor: on ? theme.btn : theme.blue, opacity: pressed ? 0.75 : 1 }]}>
                  <T size={13.5} weight="600" color={on ? theme.text : "#fff"}>{person.isFollowing ? t("Segui già") : person.requested ? t("Richiesta inviata") : t("Segui")}</T>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

// A FeedPost for single posts outside the Home list. `post` may be a server post or a card;
// the post is kept fresh from the server (counts, liked, saved) and the author's follow state
// decides the "Segui" button.
export function PostCard({ post: given, onDeleted }) {
  const base = useMemo(() => shapePost(given), [given]);
  const { data } = usePost(base?.id);
  const post = useMemo(() => (data?.post ? postCard(data.post) : base), [data, base]);
  const mine = Boolean(post?.mine);
  const { data: author } = useProfile(post && !mine ? post.owner : null);
  const [menu, setMenu] = useState(null);
  const actions = usePostActions({ onMenu: (target, isMine) => setMenu({ post: target, mine: isMine }) });
  if (!post) return null;
  return (
    <>
      <FeedPost post={post} mine={mine} follow={author || null} actions={actions} />
      <PostMenu target={menu} onClose={() => setMenu(null)} onDeleted={onDeleted || (() => (router.canGoBack() ? router.back() : router.replace("/")))} />
    </>
  );
}

// ---------------------------------------------------------------------------
// "Altro" menu of a post (web .ig-menu), as a bottom sheet.
// ---------------------------------------------------------------------------
const later = (fn) => setTimeout(fn, 320);

export function PostMenu({ target, onClose, onDeleted }) {
  const theme = useTheme();
  const post = target?.post;
  const mine = Boolean(target?.mine ?? post?.mine);
  const { data: author } = useProfile(post && !mine ? post.owner : null);
  const [editing, setEditing] = useState(null);
  const link = post ? `${SHARE_BASE}${post.id}` : "";

  const change = (patch, done) => editPost(post.id, patch)
    .then(() => { if (done) showToast({ text: done }); return true; })
    .catch((error) => { failAlert(error); return false; });
  const rows = [];
  if (post) {
    if (mine) {
      rows.push({ label: t("Modifica"), run: () => later(() => setEditing(post)) });
      rows.push({ label: t("Archivia"), run: () => change({ archived: true }, t("Archiviato")).then((ok) => ok && onDeleted?.(post.id)) });
      rows.push({ label: post.hideLikes ? t("Mostra il numero di Mi piace") : t("Nascondi il numero di Mi piace"), run: () => change({ hideLikes: !post.hideLikes }) });
      rows.push({ label: post.commentsOff ? t("Attiva i commenti") : t("Disattiva i commenti"), run: () => change({ commentsOff: !post.commentsOff }) });
    } else {
      rows.push({ label: post.saved ? t("Rimuovi dai salvati") : t("Salva"), run: () => toggleSave(post).catch(failAlert) });
      if (author?.isFollowing || author?.requested) {
        rows.push({ label: author.isFollowing ? t("Non seguire più") : t("Annulla richiesta"), run: () => toggleFollow(author).catch(failAlert) });
      } else if (author) {
        rows.push({ label: t("Segui"), run: () => toggleFollow(author).catch(failAlert) });
      }
    }
    rows.push({ label: t("Copia link"), run: () => { Clipboard.setStringAsync(link).catch(() => {}); showToast({ text: t("Link copiato") }); } });
    rows.push({ label: t("Condividi"), run: () => later(() => router.push(`/share/${encodeURIComponent(post.id)}`)) });
    if (mine) {
      rows.push({
        label: t("Elimina"),
        danger: true,
        run: () => later(() => Alert.alert(t("Eliminare il post?"), t("Non potrai recuperarlo."), [
          { text: t("Annulla"), style: "cancel" },
          {
            text: t("Elimina"),
            style: "destructive",
            onPress: () => deletePost(post.id).then(() => { showToast({ text: t("Eliminato") }); onDeleted?.(post.id); }).catch(failAlert),
          },
        ])),
      });
    } else {
      rows.push({ label: t("Segnala"), danger: true, run: () => later(() => Alert.alert(t("Segnalazione inviata"), t("Grazie, la esamineremo al più presto."))) });
    }
  }
  return (
    <>
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
      <EditCaption post={editing} onClose={() => setEditing(null)} />
    </>
  );
}

// Edit the caption and place of one of my posts.
function EditCaption({ post, onClose }) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (post) { setText(post.text || ""); setPlace(post.place || ""); }
  }, [post]);
  const save = () => {
    if (busy) return;
    tap();
    setBusy(true);
    editPost(post.id, { text: text.trim(), place: place.trim() })
      .then(() => { onClose(); showToast({ text: t("Modifiche salvate") }); })
      .catch(failAlert)
      .finally(() => setBusy(false));
  };
  return (
    <Modal visible={Boolean(post)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.editHead, { borderBottomColor: theme.line }]}>
          <Pressable hitSlop={8} onPress={onClose}><T size={16}>{t("Annulla")}</T></Pressable>
          <T size={16} weight="700">{t("Modifica info")}</T>
          <Pressable hitSlop={8} disabled={busy} onPress={save}><T size={16} weight="700" color={busy ? theme.text3 : theme.blue}>{t("Fine")}</T></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: INSET, gap: 14 }}>
          <TextInput
            value={place}
            onChangeText={setPlace}
            maxLength={80}
            placeholder={t("Aggiungi luogo")}
            placeholderTextColor={theme.text2}
            style={[styles.editPlace, { color: theme.text, borderBottomColor: theme.line }]}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={2200}
            multiline
            autoFocus
            placeholder={t("Scrivi una didascalia…")}
            placeholderTextColor={theme.text2}
            accessibilityLabel={t("Didascalia")}
            style={[styles.editText, { color: theme.text }]}
          />
          <MentionSuggest value={text} onPick={setText} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function sharePostNative(post) {
  const url = `${SHARE_BASE}${post.id}`;
  const who = post.owner || post.author?.handle || post.name || "";
  return Share.share({ title: who, message: `${who}: ${post.text || ""}\n${url}`.trim(), url }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Home blocks
// ---------------------------------------------------------------------------
// People to follow (server suggestions), with real follow buttons.
export const SuggestRail = memo(function SuggestRail({ people, title }) {
  const theme = useTheme();
  if (!people?.length) return null;
  return (
    <View style={[styles.suggest, { borderColor: theme.line }]}>
      <T size={15} weight="600" style={styles.suggestTitle}>{title || t("Persone da seguire")}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRail}>
        {people.map((person) => {
          const on = person.isFollowing || person.requested;
          return (
            <Pressable key={person.handle} onPress={() => openHandle(person.handle)} style={[styles.suggestCard, { borderColor: theme.line }]}>
              <Face src={person.avatar} name={person.name || person.handle} size={84} style={{ marginBottom: 8 }} />
              <Name size={13.5} verified={person.verified}>{person.handle}</Name>
              <T size={12} color={theme.text2} lines={1}>{person.followsMe ? t("Ti segue") : person.name}</T>
              <Pressable
                onPress={() => { tap(); toggleFollow(person).catch(failAlert); }}
                style={({ pressed }) => [styles.suggestBtn, { backgroundColor: on ? theme.btn : theme.blue, opacity: pressed ? 0.75 : 1 }]}
              >
                <T size={14} weight="600" color={on ? theme.text : "#fff"}>{person.isFollowing ? t("Segui già") : person.requested ? t("Richiesta inviata") : person.followsMe ? t("Segui anche tu") : t("Segui")}</T>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

export function FeedFooter({ done, loading }) {
  const theme = useTheme();
  if (loading || !done) return <View style={styles.footer}>{loading ? <Spinner /> : null}</View>;
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

// A short error line with "Riprova".
export function RetryLine({ error, onRetry }) {
  const theme = useTheme();
  return (
    <View style={styles.retry}>
      <T size={14} color={theme.text2} style={{ textAlign: "center" }}>{errorText(error, t)}</T>
      <Pressable hitSlop={8} onPress={() => { tap(); onRetry(); }}><T size={14} weight="700" color={theme.blue}>{t("Riprova")}</T></Pressable>
    </View>
  );
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
  headInner: { flex: 1, borderRadius: 15, borderWidth: 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  followLink: { height: 30, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  more: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tweetText: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 4, letterSpacing: -0.15 },
  count: { position: "absolute", top: 12, right: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.6)" },
  reelMark: { position: "absolute", top: 12, right: 12 },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.38)", alignItems: "center", justifyContent: "center" },
  tagBtn: { position: "absolute", left: 10, bottom: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" },
  tagPillWrap: { position: "absolute", alignItems: "center", transform: [{ translateX: "-50%" }] },
  tagArrow: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "rgba(0,0,0,0.78)" },
  tagPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.78)" },
  prodPill: { alignItems: "flex-start", maxWidth: W * 0.6 },
  shopBtn: { position: "absolute", right: 10, bottom: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" },
  shopStrip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  burstShadow: { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  actions: { flexDirection: "row", alignItems: "center", paddingTop: 4, paddingHorizontal: 6 },
  act: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  dots: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginRight: 84 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  meta: { paddingHorizontal: 14 },
  tagged: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  menu: { borderRadius: 14, overflow: "hidden", marginBottom: 6 },
  menuRow: { paddingVertical: 15, paddingHorizontal: 16 },
  editHead: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  editPlace: { fontSize: 15, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  editText: { fontSize: 15, lineHeight: 21, minHeight: 140, textAlignVertical: "top" },
  suggest: { marginTop: 4, marginBottom: 16, paddingTop: 10, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestTitle: { paddingHorizontal: 14, paddingBottom: 10 },
  suggestRail: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  suggestCard: { width: 158, alignItems: "center", gap: 2, paddingTop: 18, paddingHorizontal: 12, paddingBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  suggestBtn: { alignSelf: "stretch", height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 10 },
  footer: { marginVertical: 8, paddingTop: 16, paddingBottom: 24, alignItems: "center", gap: 4 },
  caughtRing: { width: 64, height: 64, borderRadius: 32, padding: 2, marginBottom: 8 },
  caughtInner: { flex: 1, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  mention: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 8 },
  mentionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12 },
  likerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  likerBtn: { height: 32, paddingHorizontal: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  retry: { alignItems: "center", gap: 8, paddingVertical: 24, paddingHorizontal: 32 },
});
