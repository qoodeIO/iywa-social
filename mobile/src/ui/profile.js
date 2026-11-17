// Profiles: your own (web Profile) and someone else's (web PersonScreen), with the business
// card, the shop grid, highlights, sticky tabs and swipe between boards. Everything comes from
// the server (lib/social.js); my own counts render at once from the session (useMe).
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lockPager, openTab, useTabReselect } from "../lib/tabs";
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, FadeInDown, FadeOutUp } from "react-native-reanimated";
import { GestureDetector, ScrollView as GHScrollView, usePanGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { compact, euro, stockLabel } from "../data";
import { daysLabel, openGridItem, openProfile, openState, useCountUp } from "../lib/profile-data";
import { myHandle, patchMe, useMe } from "../lib/session";
import {
  createHighlight, deleteHighlight, editPost, postCard, removeFollower, toggleFollow, toggleLike, unfollow,
  useHighlights, useProfile, useRequests, useShop as useServerShop, useSuggested, useUserPosts, useUserReposts, useUserStories,
} from "../lib/social";
import { errorText } from "../lib/api";
import { useLive } from "../live/LiveStore";
import {
  Archive, AtSign, Bag, Block, Camera, Carousel, Check, ChevronDown, Directions, Feather, Heart, LayoutGrid, LinkIcon, Lock, Mail, MapPin,
  MessageCircle, Mute, Phone, Play, Plus, Send, SquarePlay, Trash, UserMinus, UserPlus, Verified, X,
} from "./icons-profile";
import { Btn, T, tap } from "./kit";
import { ActionSheet, IgEmpty, SlideTabs, useToast } from "./profile-kit";
import { RichText, ThoughtCard, composeThought } from "./thoughts";
import { t } from "../lib/i18n";

const W = Dimensions.get("window").width;
const TILE = (W - 4) / 3;

// ---------------------------------------------------------------------------
// Avatar with a neutral placeholder (initial on a grey circle) when there is no photo.
// ---------------------------------------------------------------------------
export function Face({ src, name, size = 44, style }) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill };
  if (src) return <Image source={{ uri: src }} recyclingKey={src} style={[box, style]} contentFit="cover" transition={150} />;
  const initial = String(name || "").trim().replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <View style={[box, { alignItems: "center", justifyContent: "center" }, style]}>
      <T size={Math.round(size * 0.42)} weight="600" color={theme.text2}>{initial || "?"}</T>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Business card and shop
// ---------------------------------------------------------------------------
export function BusinessCard({ business }) {
  const theme = useTheme();
  const [note, setNote] = useState("");
  if (!business) return null;
  const hours = business.hours?.days ? business.hours : null;
  const state = hours ? openState(hours) : null;
  const place = [business.address, business.city].filter(Boolean).join(", ");
  const maps = place ? (Platform.OS === "ios" ? `http://maps.apple.com/?q=${encodeURIComponent(place)}` : `https://maps.google.com/?q=${encodeURIComponent(place)}`) : null;
  if (!place && !state && !business.phone && !business.email) return null;
  function flash(text) {
    setNote(text);
    setTimeout(() => setNote(""), 1600);
  }
  function open(url, copy, label) {
    Linking.openURL(url).catch(() => {
      Clipboard.setStringAsync(copy).catch(() => {});
      flash(label);
    });
  }
  return (
    <View style={{ gap: 3, paddingTop: 2, paddingHorizontal: INSET }}>
      {place ? (
        <Pressable onPress={() => Linking.openURL(maps).catch(() => {})} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <MapPin size={14} weight="fill" color={theme.text2} />
          <T size={14} weight="500" lines={1} style={{ flexShrink: 1 }}>{place}</T>
        </Pressable>
      ) : null}
      {state && hours.days.length ? (
        <T size={14} color={theme.text2}>
          <T size={14} weight="600" color={state.open ? "#1cd14f" : theme.text2}>{state.open ? t("Aperto ora") : t("Chiuso")}</T>
          {" · "}{daysLabel(hours.days)} {hours.open}–{hours.close}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: 6, paddingTop: 12 }}>
        {business.phone ? <Btn title={t("Chiama")} icon={Phone} size={14} height={32} flex={1} onPress={() => open(`tel:${String(business.phone).replace(/\s/g, "")}`, business.phone, t("Numero copiato"))} /> : null}
        {maps ? <Btn title={t("Indicazioni")} icon={Directions} size={14} height={32} flex={1} onPress={() => Linking.openURL(maps).catch(() => {})} /> : null}
        {business.email ? <Btn title={t("Email")} icon={Mail} size={14} height={32} flex={1} onPress={() => open(`mailto:${business.email}`, business.email, t("Email copiata"))} /> : null}
      </View>
      {note ? <T size={12.5} color={theme.text2} style={{ textAlign: "center", marginTop: 6 }}>{note}</T> : null}
    </View>
  );
}

export function ShopGrid({ products = [], mine, onOpen, onAdd }) {
  const theme = useTheme();
  const [cat, setCat] = useState("all");
  const cats = [...new Set(products.map((product) => product.category).filter(Boolean))];
  const list = products.filter((product) => cat === "all" || product.category === cat);
  const width = (W - INSET * 2 - 10) / 2;
  return (
    <View>
      {cats.length > 1 ? (
        <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10, paddingBottom: 4, paddingHorizontal: INSET }}>
          {["all", ...cats].map((item) => {
            const on = cat === item;
            return (
              <Pressable key={item} onPress={() => { tap(); setCat(item); }} style={[styles.cat, { backgroundColor: on ? theme.text : "transparent", borderColor: on ? theme.text : theme.line }]}>
                <T size={13} weight="600" color={on ? theme.bg : theme.text}>{item === "all" ? t("Tutti") : item}</T>
              </Pressable>
            );
          })}
        </GHScrollView>
      ) : null}
      <View style={styles.shopGrid}>
        {mine && onAdd ? (
          <Pressable onPress={onAdd} style={({ pressed }) => [styles.shopAdd, { width, height: width, borderColor: "rgba(0,149,246,0.55)", backgroundColor: "rgba(0,149,246,0.06)", transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <View style={[styles.shopAddIcon, { backgroundColor: theme.blue }]}><Plus size={22} color="#fff" /></View>
            <T size={14} weight="600">{t("Aggiungi prodotto")}</T>
            <T size={13} color={theme.text2}>{t("Foto, prezzo, pezzi")}</T>
          </Pressable>
        ) : null}
        {list.map((product) => {
          const stock = stockLabel(product);
          const cover = product.images?.[0];
          return (
            <Pressable key={product.id} onPress={() => onOpen(product)} style={({ pressed }) => [{ width, gap: 3 }, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <View style={[styles.shopPic, { backgroundColor: theme.fill }]}>
                {cover ? <Image source={{ uri: cover }} recyclingKey={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}><Bag size={28} color={theme.text3} /></View>}
                {product.images?.length > 1 ? <View style={styles.badge}><Carousel size={18} weight="fill" color="#fff" /></View> : null}
                {stock.tone !== "ok" ? (
                  <View style={[styles.flag, { backgroundColor: stock.tone === "low" ? "rgba(255,159,10,0.92)" : stock.tone === "order" ? "rgba(94,92,230,0.92)" : stock.tone === "out" ? "rgba(60,60,67,0.85)" : "rgba(0,0,0,0.6)" }]}>
                    <T size={11} weight="700" color="#fff">{stock.text}</T>
                  </View>
                ) : null}
              </View>
              <T size={14} weight="600" lines={1}>{product.name}</T>
              <T size={14} weight="700" lines={1}>{euro(product.price)}</T>
            </Pressable>
          );
        })}
      </View>
      {!list.length && !mine ? <IgEmpty icon={Bag} title={t("Ancora nessun prodotto")} /> : null}
    </View>
  );
}

function ShopBoard({ handle, mine }) {
  const { data, loading, error, refresh } = useServerShop(handle);
  if (loading && !data) return <Loading />;
  if (error && !data) return <Retry onPress={refresh} />;
  return (
    <ShopGrid
      products={data?.products || []}
      mine={mine}
      onOpen={(product) => router.push(`/product/${encodeURIComponent(handle)}/${encodeURIComponent(product.id)}`)}
      onAdd={mine ? () => router.push("/product-edit/new") : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Grid rows (virtualized by FlashList)
// ---------------------------------------------------------------------------
const GridRow = memo(function GridRow({ items, tall, kindMark, reelMark, onOpen, onPeek }) {
  const theme = useTheme();
  const height = tall ? TILE * (16 / 9) : TILE * (4 / 3);
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
      {items.map((post) => (
        <Pressable
          key={post.id}
          accessibilityLabel={t("Apri {kind}, {name}", { kind: post.kind || "post", name: post.name })}
          onPress={() => onOpen(post)}
          onLongPress={onPeek ? () => { tap("medium"); onPeek(post); } : undefined}
          delayLongPress={380}
          style={({ pressed }) => ({ width: TILE, height, backgroundColor: theme.fill, opacity: pressed ? 0.85 : 1 })}
        >
          {post.image ? <Image source={{ uri: post.image }} recyclingKey={post.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : (
            <View style={[StyleSheet.absoluteFill, { padding: 8 }]}><T size={12} lines={6} color={theme.text2}>{post.text}</T></View>
          )}
          {kindMark && post.kind === "reel" ? <View style={styles.badge}><SquarePlay size={17} weight="fill" color="#fff" /></View> : null}
          {!kindMark && !reelMark && post.images?.length > 1 ? <View style={styles.badge}><Carousel size={18} weight="fill" color="#fff" /></View> : null}
          {kindMark && post.kind !== "reel" && post.images?.length > 1 ? <View style={styles.badge}><Carousel size={18} weight="fill" color="#fff" /></View> : null}
          {reelMark ? (
            <View style={styles.mark}>
              <Play size={12} weight="fill" color="#fff" />
              <T size={12} weight="600" color="#fff" style={styles.shadow}>{compact(post.likes || 0)}</T>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
});

function rowsOf(list, tall, extra = {}) {
  const rows = [];
  for (let i = 0; i < list.length; i += 3) rows.push({ type: tall ? "tallrow" : "row", key: `r-${i}-${list[i].id}`, items: list.slice(i, i + 3), tall, ...extra });
  return rows;
}

function Loading() {
  const theme = useTheme();
  return <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator color={theme.text2} /></View>;
}

function Retry({ onPress }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 40 }}>
      <T size={14} color={theme.text2}>{t("Non è stato possibile caricare.")}</T>
      <Btn title={t("Riprova")} height={32} onPress={onPress} />
    </View>
  );
}

// The posts of one board of a profile, loaded only once the board is shown.
function useBoard(handle, board) {
  const grid = useUserPosts(board === "posts" ? handle : null, "grid");
  const reels = useUserPosts(board === "reels" ? handle : null, "reels");
  const thoughts = useUserPosts(board === "thoughts" ? handle : null, "thoughts");
  const reposts = useUserReposts(board === "thoughts" ? handle : null);
  const tagged = useUserPosts(board === "tagged" ? handle : null, "tagged");
  const pick = board === "reels" ? reels : board === "tagged" ? tagged : grid;
  const cards = useMemo(() => {
    if (board === "thoughts") {
      return [
        ...thoughts.items.map((post) => ({ key: post.id, at: post.createdAt, post: postCard(post) })),
        ...reposts.items.map((post) => ({ key: `rp-${post.id}`, at: post.repostedAt || post.createdAt, post: postCard(post), repost: true })),
      ].sort((a, b) => b.at - a.at);
    }
    return pick.items.map(postCard).filter((post) => board !== "tagged" || post.image);
  }, [board, pick.data, thoughts.data, reposts.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (board === "thoughts") {
    return {
      cards,
      loading: thoughts.loading || reposts.loading,
      error: thoughts.error && reposts.error ? thoughts.error : null,
      moreLoading: thoughts.moreLoading || reposts.moreLoading,
      refresh: () => Promise.allSettled([thoughts.refresh(), reposts.refresh()]),
      more: () => { if (!thoughts.done) thoughts.more(); if (!reposts.done) reposts.more(); },
    };
  }
  if (board === "shop") return { cards: [], loading: false, error: null, moreLoading: false, refresh: () => Promise.resolve(), more: () => {} };
  return { cards, loading: pick.loading, error: pick.error, moreLoading: pick.moreLoading, refresh: pick.refresh, more: pick.more };
}

function boardItems(board, state) {
  if (board === "shop") return [{ type: "shop", key: "shop" }];
  if (state.loading && !state.cards.length) return [{ type: "loading", key: `loading-${board}` }];
  if (state.error && !state.cards.length) return [{ type: "error", key: `error-${board}` }];
  if (!state.cards.length) return [{ type: "empty", key: `empty-${board}` }];
  const rows = board === "thoughts" ? state.cards.map((row) => ({ type: "thought", key: row.key, row })) : rowsOf(state.cards, board === "reels", { board });
  return state.moreLoading ? [...rows, { type: "more", key: "more" }] : rows;
}

// Swipe left or right on the boards to change tab, like the web pager.
function useBoardSwipe(onSwipe, enabled = true) {
  return usePanGesture({
    enabled,
    activeOffsetX: [-24, 24],
    failOffsetY: [-12, 12],
    onDeactivate: (event) => {
      "worklet";
      if (Math.abs(event.translationX) > 70 || Math.abs(event.velocityX) > 650) scheduleOnRN(onSwipe, event.translationX < 0 ? 1 : -1);
    },
  });
}

function ProfileList({ header, tabs, board, setBoard, items, renderBoard, reselect, onRefresh, onEndReached }) {
  const theme = useTheme();
  const listRef = useRef(null);
  const [pulling, setPulling] = useState(false);
  useTabReselect(reselect, () => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  const count = tabs?.length || 0;
  const swipe = useCallback((dir) => {
    // On your own profile (inside the pager), swiping right on the first board goes back to Messaggi.
    if (reselect && dir < 0 && board === 0) { openTab("messages", null, { animated: true }); return; }
    if (!count) return;
    setBoard((value) => Math.max(0, Math.min(count - 1, value + dir)));
  }, [setBoard, count, reselect, board]);
  // Inside the pager the boards read the finger directly: the pager is held still while a finger
  // is on them, and a clear sideways move on release changes board.
  const touch = useRef(null);
  const hold = reselect ? {
    onTouchStart: (event) => { const { pageX, pageY } = event.nativeEvent; touch.current = { x: pageX, y: pageY, lx: pageX, ly: pageY, t: Date.now() }; lockPager(true); },
    onTouchMove: (event) => { if (touch.current) { touch.current.lx = event.nativeEvent.pageX; touch.current.ly = event.nativeEvent.pageY; } },
    onTouchEnd: (event) => { finish(event.nativeEvent.pageX, event.nativeEvent.pageY); },
    onTouchCancel: () => { finish(); },
  } : null;
  function finish(x, y) {
    const start = touch.current;
    touch.current = null;
    lockPager(false);
    if (!start) return;
    const dx = (x ?? start.lx) - start.x;
    const dy = (y ?? start.ly) - start.y;
    const fast = Math.abs(dx) / Math.max(Date.now() - start.t, 1) > 0.5;
    if ((Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30)) && Math.abs(dx) > Math.abs(dy) * 1.6) swipe(dx < 0 ? 1 : -1);
  }
  const pan = useBoardSwipe(swipe, !reselect && count > 1);
  const data = useMemo(() => [{ type: "head", key: "head" }, ...(count ? [{ type: "tabs", key: "tabs" }] : []), ...items], [items, count]);
  async function pull() {
    if (!onRefresh) return;
    setPulling(true);
    try { await onRefresh(); } finally { setPulling(false); }
  }
  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          data={data}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          stickyHeaderIndices={count ? [1] : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          extraData={header}
          refreshing={pulling}
          onRefresh={onRefresh ? pull : undefined}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => {
            if (item.type === "head") return header;
            if (item.type === "tabs") return <View {...hold}><SlideTabs tabs={tabs} active={board} onChange={setBoard} height={46} iconSize={24} dim="text3" style={{ backgroundColor: theme.bg }} /></View>;
            if (item.type === "loading" || item.type === "more") return <View {...hold}><Loading /></View>;
            return <View {...hold}>{renderBoard(item)}</View>;
          }}
        />
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Avatar with the story ring, highlights
// ---------------------------------------------------------------------------
function StoryFace({ src, name, frames, mine, size = 90, onPress, label }) {
  const theme = useTheme();
  const has = frames?.length > 0;
  const unseen = has && (mine || frames.some((frame) => !frame.seen));
  const face = <Face src={src} name={name} size={size - 8} style={{ borderWidth: 3, borderColor: theme.bg, width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }} />;
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
      {has ? (
        unseen ? (
          <LinearGradient colors={["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>{face}</LinearGradient>
        ) : (
          <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.line }]}>{face}</View>
        )
      ) : <Face src={src} name={name} size={size} />}
    </Pressable>
  );
}

function frameCover(frame) {
  const media = frame?.media || {};
  return media.type === "video" ? media.poster || media.url : media.url;
}

function Highlights({ handle, mine, onNew, onRemove }) {
  const theme = useTheme();
  const { data } = useHighlights(handle);
  const list = data || [];
  if (!mine && !list.length) return null;
  return (
    <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
      {mine ? (
        <Pressable onPress={onNew} style={({ pressed }) => [styles.highlight, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <View style={[styles.hlRing, { borderColor: theme.line, alignItems: "center", justifyContent: "center" }]}><Plus size={26} weight="light" color={theme.text} /></View>
          <T size={12} lines={1}>{t("Nuovo")}</T>
        </Pressable>
      ) : null}
      {list.map((item) => {
        const cover = item.cover || frameCover(item.frames?.[0]);
        return (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/story/h:${item.id}?owner=${encodeURIComponent(handle)}`)}
            onLongPress={mine ? () => { tap("medium"); onRemove?.(item); } : undefined}
            style={({ pressed }) => [styles.highlight, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <View style={[styles.hlRing, { borderColor: theme.line }]}>
              {cover ? <Image source={{ uri: cover }} style={{ width: "100%", height: "100%", borderRadius: 33 }} contentFit="cover" /> : <View style={{ flex: 1, borderRadius: 33, backgroundColor: theme.fill }} />}
            </View>
            <T size={12} lines={1}>{item.title}</T>
          </Pressable>
        );
      })}
    </GHScrollView>
  );
}

// A new highlight from my active stories: pick frames, give it a name.
function NewHighlight({ open, onClose, frames, say }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) { setTitle(""); setPicked((frames || []).map((frame) => frame.id)); setError(""); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = frames || [];
  const chosen = list.filter((frame) => picked.includes(frame.id));
  async function save() {
    if (!chosen.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await createHighlight({ title: title.trim() || t("In evidenza"), cover: frameCover(chosen[0]), frames: chosen });
      tap("medium");
      onClose();
      say(t("Aggiunto in evidenza"));
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.scheme === "dark" ? "#1c1c1e" : theme.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grab, { backgroundColor: theme.line }]} />
          <T size={16} weight="700" style={{ textAlign: "center", marginVertical: 8 }}>{t("Nuovo in evidenza")}</T>
          {list.length ? (
            <>
              <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                {list.map((frame) => {
                  const on = picked.includes(frame.id);
                  const cover = frameCover(frame);
                  return (
                    <Pressable key={frame.id} onPress={() => { tap(); setPicked((prev) => (on ? prev.filter((id) => id !== frame.id) : [...prev, frame.id])); }} style={[styles.frame, { backgroundColor: theme.fill, borderColor: on ? theme.blue : "transparent" }]}>
                      {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      <View style={[styles.pick, { backgroundColor: on ? theme.blue : "rgba(0,0,0,0.35)" }]}>{on ? <Check size={13} weight="bold" color="#fff" /> : null}</View>
                    </Pressable>
                  );
                })}
              </GHScrollView>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={30}
                placeholder={t("Nome")}
                placeholderTextColor={theme.text2}
                accessibilityLabel={t("Nome")}
                style={[styles.input, { backgroundColor: theme.fill, color: theme.text }]}
              />
              {error ? <T size={13} color={theme.red} style={{ textAlign: "center", marginTop: 8 }}>{error}</T> : null}
              <Btn title={busy ? t("Salvataggio…") : t("Aggiungi")} kind="primary" height={42} disabled={!chosen.length || busy} style={{ marginTop: 14 }} onPress={save} />
            </>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}>
              <T size={14} color={theme.text2} style={{ textAlign: "center" }}>{t("Le storie restano 24 ore. Pubblicane una per tenerla in evidenza sul profilo.")}</T>
              <Btn title={t("Nuova storia")} kind="primary" height={36} onPress={() => { onClose(); router.push("/story/new"); }} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StatButton({ value, label, onPress }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
      <T size={16.5} weight="700" style={{ fontVariant: ["tabular-nums"], lineHeight: 20 }}>{value}</T>
      <T size={13.5}>{label}</T>
    </Pressable>
  );
}

function Website({ url }) {
  const theme = useTheme();
  if (!url) return null;
  const color = theme.scheme === "dark" ? "#4f8ff7" : "#00376b";
  return (
    <Pressable onPress={() => Linking.openURL(/^https?:\/\//.test(url) ? url : `https://${url}`).catch(() => {})} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
      <View style={{ transform: [{ rotate: "-45deg" }] }}><LinkIcon size={15} weight="bold" color={color} /></View>
      <T size={14} weight="600" color={color} lines={1} style={{ flexShrink: 1 }}>{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</T>
    </Pressable>
  );
}

function NameLine({ name, verified, size = 15 }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <T size={size} weight="600" lines={1} style={{ flexShrink: 1 }}>{name}</T>
      {verified ? <Verified size={size} weight="fill" color={theme.blue} /> : null}
    </View>
  );
}

// "Scopri persone": real suggestions from the server.
function Discover({ say }) {
  const theme = useTheme();
  const store = useStore();
  const { data, loading } = useSuggested();
  const [dismissed, setDismissed] = useState([]);
  const blocked = store.prefs.blocked || [];
  const people = (data || []).filter((person) => !dismissed.includes(person.handle) && !blocked.includes(person.handle));
  return (
    <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(200)}>
      <View style={styles.discoverHead}>
        <T size={14} weight="600">{t("Scopri persone")}</T>
        <Pressable onPress={() => openTab("search")}><T size={14} color={theme.scheme === "dark" ? "#4f8ff7" : "#00376b"}>{t("Cerca")}</T></Pressable>
      </View>
      <GHScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={{ gap: 8, paddingHorizontal: INSET, paddingBottom: 8 }}>
        {people.map((person) => {
          const on = person.isFollowing || person.requested;
          return (
            <Pressable key={person.handle} onPress={() => openProfile(person.handle)} style={[styles.suggest, { borderColor: theme.line }]}>
              <Pressable accessibilityLabel={t("Ignora")} hitSlop={6} style={styles.suggestX} onPress={() => setDismissed((prev) => [...prev, person.handle])}><X size={14} color={theme.text2} /></Pressable>
              <Face src={person.avatar} name={person.name || person.handle} size={76} />
              <T size={13.5} weight="600" lines={1} style={{ marginTop: 8 }}>{person.name || person.handle}</T>
              <T size={12} color={theme.text2} lines={1}>@{person.handle}</T>
              <Btn
                title={person.isFollowing ? t("Segui già") : person.requested ? t("Richiesta inviata") : t("Segui")}
                kind={on ? "gray" : "primary"}
                height={30}
                style={{ alignSelf: "stretch", marginTop: 10 }}
                onPress={() => toggleFollow(person).catch((err) => say(errorText(err, t)))}
              />
            </Pressable>
          );
        })}
        {loading && !people.length ? <View style={{ width: W - INSET * 2, paddingVertical: 30 }}><ActivityIndicator color={theme.text2} /></View> : null}
        {!loading && !people.length ? <T size={13} color={theme.text2} style={{ paddingVertical: 20 }}>{t("Nessun suggerimento per ora.")}</T> : null}
      </GHScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Your profile
// ---------------------------------------------------------------------------
export function MyProfile({ embedded = false }) {
  const theme = useTheme();
  const me = useMe();
  const handle = me?.handle || null;
  const fresh = useProfile(handle);
  const stories = useUserStories(handle);
  const highlights = useHighlights(handle);
  const [board, setBoard] = useState(0);
  const [discover, setDiscover] = useState(false);
  const [peek, setPeek] = useState(null);
  const [newHighlight, setNewHighlight] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [toast, say] = useToast();

  // The server copy refreshes the counts the session shows at once.
  useEffect(() => {
    const data = fresh.data;
    if (data && data.handle === myHandle()) patchMe({ followers: data.followers, following: data.following, posts: data.posts, shop: data.shop, private: data.private, verified: data.verified });
  }, [fresh.data]);

  const profile = me || {};
  const business = profile.kind === "business" ? profile.business || null : null;
  const shopOn = Boolean(business) && business.shop !== false;
  const boards = shopOn ? ["posts", "reels", "shop", "thoughts", "tagged"] : ["posts", "reels", "thoughts", "tagged"];
  const tabs = [
    { key: "posts", label: t("Post"), icon: LayoutGrid },
    { key: "reels", label: t("Reels"), icon: SquarePlay },
    ...(shopOn ? [{ key: "shop", label: t("Shop"), icon: Bag }] : []),
    { key: "thoughts", label: t("Pensieri"), icon: Feather },
    { key: "tagged", label: t("Tag"), icon: AtSign },
  ];
  const index = Math.min(board, boards.length - 1);
  const current = boards[index];
  const state = useBoard(handle, current);
  const items = useMemo(() => boardItems(current, state), [current, state.cards, state.loading, state.error, state.moreLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const posts = useCountUp(profile.posts || 0);
  const followers = useCountUp(profile.followers || 0);
  const following = useCountUp(profile.following || 0);
  const frames = stories.data?.frames || [];

  const openTile = useCallback((post) => openGridItem(post, current === "thoughts" ? [] : state.cards, current === "reels" ? t("Reels") : t("Post")), [current, state.cards]);

  const refresh = () => Promise.allSettled([fresh.refresh(), stories.refresh(), highlights.refresh(), state.refresh()]);

  const header = (
    <View>
      <View style={styles.head}>
        <View>
          <StoryFace
            src={profile.avatar}
            name={profile.name || handle}
            frames={frames}
            mine
            label={frames.length ? t("Apri la tua storia") : t("Aggiungi alla storia")}
            onPress={() => (frames.length ? router.push(`/story/${encodeURIComponent(handle)}`) : router.push("/story/new"))}
          />
          <Pressable accessibilityLabel={t("Nuova storia")} hitSlop={6} onPress={() => router.push("/story/new")} style={[styles.add, { backgroundColor: theme.text, borderColor: theme.bg }]}>
            <Plus size={12} weight="bold" color={theme.bg} />
          </Pressable>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ marginBottom: 8 }}><NameLine name={profile.name || handle} verified={profile.verified} /></View>
          <View style={{ flexDirection: "row", gap: 22 }}>
            <StatButton value={compact(posts)} label={t("post")} onPress={() => setBoard(0)} />
            <StatButton value={compact(followers)} label={t("follower")} onPress={() => router.push("/people/followers")} />
            <StatButton value={compact(following)} label={t("seguiti")} onPress={() => router.push("/people/following")} />
          </View>
        </View>
      </View>
      <View style={{ paddingTop: 10, paddingHorizontal: INSET }}>
        {business?.category ? <T size={14} color={theme.text2}>{business.category}</T> : null}
        {profile.bio ? <RichText text={profile.bio} size={14} style={{ marginTop: 2, lineHeight: 19 }} /> : null}
        <Website url={profile.website} />
      </View>
      {business ? <View style={{ paddingTop: 6 }}><BusinessCard business={business} /></View> : null}
      {profile.private ? <Requests /> : null}
      <View style={styles.buttons}>
        <Btn title={t("Modifica profilo")} flex={1} height={32} onPress={() => router.push("/edit-profile")} />
        <Btn title={t("Condividi profilo")} flex={1} height={32} onPress={() => router.push("/qr")} />
        <Pressable accessibilityLabel={t("Scopri persone")} accessibilityState={{ selected: discover }} onPress={() => { tap(); setDiscover((value) => !value); }} style={({ pressed }) => [styles.square, { backgroundColor: discover ? theme.text : theme.btn, opacity: pressed ? 0.7 : 1 }]}>
          <UserPlus size={17} weight={discover ? "fill" : "regular"} color={discover ? theme.bg : theme.text} />
        </Pressable>
      </View>
      {discover ? <Discover say={say} /> : null}
      <Highlights handle={handle} mine onNew={() => setNewHighlight(true)} onRemove={setRemoving} />
    </View>
  );

  function renderBoard(item) {
    if (item.type === "row" || item.type === "tallrow") {
      return <GridRow items={item.items} tall={item.tall} kindMark={item.board === "posts"} reelMark={item.board === "reels"} onOpen={openTile} onPeek={item.board === "tagged" ? undefined : (post) => setPeek(post)} />;
    }
    if (item.type === "thought") return <ThoughtCard thought={item.row.post} repostedBy={item.row.repost ? t("Hai ripubblicato") : undefined} />;
    if (item.type === "shop") return <ShopBoard handle={handle} mine />;
    if (item.type === "error") return <Retry onPress={state.refresh} />;
    if (current === "thoughts") {
      return (
        <IgEmpty icon={Feather} title={t("Condividi il tuo primo pensiero")} text={t("Una frase, una domanda, un sondaggio.")}>
          <Btn title={t("Scrivi un pensiero")} kind="primary" height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} onPress={() => composeThought()} />
        </IgEmpty>
      );
    }
    if (current === "tagged") return <IgEmpty icon={AtSign} title={t("Foto e video in cui sei taggato")} text={t("Quando qualcuno ti tagga, appariranno qui.")} />;
    return (
      <IgEmpty icon={current === "reels" ? SquarePlay : Camera} title={current === "reels" ? t("Condividi il tuo primo reel") : t("Condividi il tuo primo post")} text={t("Apparirà sul tuo profilo.")}>
        <Btn title={t("Crea")} kind="primary" height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} onPress={() => router.push("/create")} />
      </IgEmpty>
    );
  }

  async function likePeek() {
    const post = peek;
    setPeek({ ...post, liked: !post.liked });
    try { await toggleLike(post); } catch (err) { say(errorText(err, t)); }
  }

  async function archivePeek() {
    const post = peek;
    setPeek(null);
    try {
      await editPost(post.id, { archived: true });
      say(t("Archiviato"));
    } catch (err) {
      say(errorText(err, t));
    }
  }

  async function removeHighlight() {
    const item = removing;
    setRemoving(null);
    try { await deleteHighlight(item.id); } catch (err) { say(errorText(err, t)); }
  }

  if (!handle) return <View style={{ flex: 1 }}><Loading /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ProfileList
        reselect={embedded ? null : "profile"}
        header={header}
        tabs={tabs}
        board={index}
        setBoard={setBoard}
        items={items}
        renderBoard={renderBoard}
        onRefresh={refresh}
        onEndReached={state.more}
      />
      <Modal visible={Boolean(peek)} transparent animationType="fade" onRequestClose={() => setPeek(null)} statusBarTranslucent>
        <Pressable style={styles.peekBack} onPress={() => setPeek(null)}>
          {peek ? (
            <Animated.View entering={FadeIn.duration(180)} style={[styles.peek, { backgroundColor: theme.scheme === "dark" ? "#262626" : "#fff" }]}>
              <Pressable>
                <View style={styles.peekHead}>
                  <Face src={profile.avatar} name={profile.name || handle} size={30} />
                  <T size={14} weight="600">{handle}</T>
                </View>
                {peek.image ? <Image source={{ uri: peek.image }} style={{ width: "100%", aspectRatio: 4 / 5 }} contentFit="cover" /> : <View style={{ width: "100%", aspectRatio: 4 / 5, backgroundColor: theme.fill }} />}
                <View style={[styles.peekActions, { borderTopColor: theme.line }]}>
                  <PeekAction icon={Heart} label={t("Mi piace")} on={peek.liked} onPress={likePeek} />
                  <PeekAction icon={MessageCircle} label={t("Apri")} onPress={() => { const post = peek; setPeek(null); openTile(post); }} />
                  <PeekAction icon={Archive} label={t("Archivia")} onPress={archivePeek} />
                </View>
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
      <NewHighlight open={newHighlight} onClose={() => setNewHighlight(false)} frames={frames} say={say} />
      <ActionSheet
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        hint={removing ? removing.title : null}
        items={[{ icon: Trash, label: t("Elimina dagli highlight"), danger: true, onPress: removeHighlight }]}
      />
      {toast}
    </View>
  );
}

// Follow requests waiting on my private account.
function Requests() {
  const theme = useTheme();
  const { data } = useRequests();
  const count = data?.length || 0;
  if (!count) return null;
  return (
    <Pressable onPress={() => router.push("/people/requests")} style={({ pressed }) => [styles.requests, { backgroundColor: pressed ? theme.fill : theme.btn }]}>
      <UserPlus size={18} color={theme.text} />
      <T size={14} weight="600" style={{ flex: 1 }}>{t("Richieste di follow")}</T>
      <View style={[styles.count, { backgroundColor: theme.red }]}><T size={12} weight="700" color="#fff">{count > 99 ? "99+" : count}</T></View>
    </Pressable>
  );
}

function PeekAction({ icon: Icon, label, on, onPress }) {
  const theme = useTheme();
  const color = on ? theme.red : theme.text;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.peekAction, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <Icon size={22} weight={on ? "fill" : "regular"} color={color} />
      <T size={11.5} color={color}>{label}</T>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Someone else's profile
// ---------------------------------------------------------------------------
export function profileUrl(handle) {
  return `https://iywa.app/${handle}`;
}

export function PersonProfile({ handle, menu, setMenu }) {
  const theme = useTheme();
  const store = useStore();
  const live = useLive();
  const { data: person, loading, error, refresh } = useProfile(handle);
  const stories = useUserStories(person?.visible ? handle : null);
  const highlights = useHighlights(person?.visible ? handle : null);
  const [board, setBoard] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [unfollowAsk, setUnfollowAsk] = useState(false);
  const [toast, say] = useToast();
  const blocked = (store.prefs.blocked || []).includes(handle);
  const muted = (store.prefs.muted || []).includes(handle);
  const visible = Boolean(person?.visible) && !blocked;
  const business = person?.kind === "business" ? person.business || null : null;
  const shopOn = Boolean(person?.shop);
  const boards = ["posts", ...(shopOn ? ["shop"] : []), "reels", "thoughts", "tagged"];
  const tabs = [
    { key: "posts", label: t("Post"), icon: LayoutGrid },
    ...(shopOn ? [{ key: "shop", label: t("Shop"), icon: Bag }] : []),
    { key: "reels", label: t("Reels"), icon: SquarePlay },
    { key: "thoughts", label: t("Pensieri"), icon: Feather },
    { key: "tagged", label: t("Tag"), icon: AtSign },
  ];
  const index = Math.min(board, boards.length - 1);
  const current = boards[index];
  const state = useBoard(visible ? handle : null, current);
  const shownPosts = useCountUp(person?.posts || 0);
  const shownFollowers = useCountUp(person?.followers || 0);
  const shownFollowing = useCountUp(person?.following || 0);
  const frames = stories.data?.frames || [];

  const items = useMemo(() => {
    if (!person) return [];
    if (blocked) return [{ type: "blocked", key: "blocked" }];
    if (!visible) return [{ type: "private", key: "private" }];
    return boardItems(current, state);
  }, [person, blocked, visible, current, state.cards, state.loading, state.error, state.moreLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFollow() {
    if (busy) return;
    if (person.isFollowing) { setUnfollowAsk(true); return; }
    setBusy(true);
    try { await toggleFollow(person); } catch (err) { say(errorText(err, t)); } finally { setBusy(false); }
  }

  async function doUnfollow() {
    setUnfollowAsk(false);
    setBusy(true);
    try { await unfollow(handle); } catch (err) { say(errorText(err, t)); } finally { setBusy(false); }
  }

  function message() {
    if (opening) return;
    if (!live?.openDm) { say(t("Chat non raggiungibile. Riprova.")); return; }
    setOpening(true);
    live.openDm(handle)
      .then((id) => router.push(`/chat/${id}`))
      .catch(() => say(t("Chat non raggiungibile. Riprova.")))
      .finally(() => setOpening(false));
  }

  function setList(key, on) {
    const list = store.prefs[key] || [];
    store.setPrefs({ [key]: on ? [...list.filter((item) => item !== handle), handle] : list.filter((item) => item !== handle) });
  }

  function block() {
    setMenu(false);
    Alert.alert(t("Bloccare @{handle}?", { handle }), t("Non vedrai più i suoi post e smetterete di seguirvi."), [
      { text: t("Annulla"), style: "cancel" },
      {
        text: t("Blocca"),
        style: "destructive",
        onPress: () => {
          setList("blocked", true);
          if (person.isFollowing || person.requested) unfollow(handle).catch(() => {});
          if (person.followsMe) removeFollower(handle).catch(() => {});
          say(t("Account bloccato"));
        },
      },
    ]);
  }

  async function dropFollower() {
    setMenu(false);
    try {
      await removeFollower(handle);
      refresh();
      say(t("Follower rimosso"));
    } catch (err) {
      say(errorText(err, t));
    }
  }

  if (!person) {
    if (error) {
      return error.code === "not-found"
        ? <IgEmpty title={t("Profilo non trovato")} text={t("Il link potrebbe essere sbagliato o l'account non esiste più.")} />
        : <Retry onPress={refresh} />;
    }
    return loading ? <Loading /> : null;
  }

  const followTitle = person.isFollowing ? t("Segui già") : person.requested ? t("Richiesta inviata") : person.followsMe ? t("Segui anche tu") : t("Segui");
  const followOn = person.isFollowing || person.requested;
  const openList = visible ? (kind) => router.push({ pathname: "/people/[kind]", params: { kind, handle } }) : null;

  const header = (
    <View>
      <View style={styles.psTop}>
        <StoryFace
          src={person.avatar}
          name={person.name || handle}
          frames={visible ? frames : []}
          size={86}
          label={frames.length ? t("Apri la storia") : person.name}
          onPress={frames.length && visible ? () => router.push(`/story/${encodeURIComponent(handle)}`) : undefined}
        />
        <View style={{ flex: 1, flexDirection: "row" }}>
          {[[compact(shownPosts), t("post"), null], [compact(shownFollowers), t("follower"), openList ? () => openList("followers") : null], [compact(shownFollowing), t("seguiti"), openList ? () => openList("following") : null]].map(([value, label, onPress]) => (
            <Pressable key={label} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: "center", opacity: pressed ? 0.55 : 1 })}>
              <T size={17} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{value}</T>
              <T size={13}>{label}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ alignItems: "flex-start", gap: 2, paddingTop: 12, paddingHorizontal: INSET }}>
        <NameLine name={business?.title || person.name || handle} verified={person.verified} size={14} />
        {business?.category ? <T size={14} color={theme.text2}>{business.category}</T> : null}
        {person.bio ? <RichText text={person.bio} size={14} style={{ lineHeight: 19 }} /> : null}
        <Website url={person.website} />
        {person.followsMe && !person.isFollowing ? <T size={12.5} color={theme.text2} style={{ marginTop: 4 }}>{t("Ti segue")}</T> : null}
      </View>
      {business && visible ? <View style={{ paddingTop: 6 }}><BusinessCard business={business} /></View> : null}
      {blocked ? null : (
        <View style={styles.psActions}>
          <Pressable disabled={busy} onPress={() => { tap(); onFollow(); }} style={({ pressed }) => [styles.psBtn, { backgroundColor: followOn ? theme.btn : theme.blue, opacity: pressed || busy ? 0.7 : 1 }]}>
            <T size={14} weight="600" color={followOn ? theme.text : "#fff"}>{followTitle}</T>
            {person.isFollowing ? <ChevronDown size={14} weight="bold" color={theme.text} /> : null}
          </Pressable>
          <Pressable disabled={opening} onPress={() => { tap(); message(); }} style={({ pressed }) => [styles.psBtn, { backgroundColor: theme.btn, opacity: pressed || opening ? 0.7 : 1 }]}>
            <T size={14} weight="600">{t("Messaggio")}</T>
          </Pressable>
        </View>
      )}
      {visible ? <Highlights handle={handle} /> : null}
    </View>
  );

  function renderBoard(item) {
    if (item.type === "blocked") {
      return (
        <IgEmpty icon={Block} title={t("Hai bloccato questo account")} text={t("Sbloccalo per vedere i suoi post.")}>
          <Btn title={t("Sblocca")} height={32} style={{ marginTop: 8, paddingHorizontal: 18 }} onPress={() => setList("blocked", false)} />
        </IgEmpty>
      );
    }
    if (item.type === "private") {
      return <IgEmpty icon={Lock} title={t("Questo account è privato")} text={t("Segui questo account per vedere le sue foto e i suoi video.")} />;
    }
    if (item.type === "row" || item.type === "tallrow") return <GridRow items={item.items} tall={item.tall} kindMark={item.board === "posts"} reelMark={item.board === "reels"} onOpen={(post) => openGridItem(post, state.cards, person.handle)} />;
    if (item.type === "thought") return <ThoughtCard thought={item.row.post} repostedBy={item.row.repost ? t("{name} ha ripubblicato", { name: person.name || handle }) : undefined} />;
    if (item.type === "shop") return <ShopBoard handle={handle} />;
    if (item.type === "error") return <Retry onPress={state.refresh} />;
    if (current === "thoughts") return <IgEmpty icon={Feather} title={t("Ancora nessun pensiero")} />;
    if (current === "tagged") return <IgEmpty icon={AtSign} title={t("Nessuna foto con tag")} />;
    return <IgEmpty icon={current === "posts" ? Camera : SquarePlay} title={current === "posts" ? t("Ancora nessun post") : t("Ancora nessun reel")} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ProfileList
        header={header}
        tabs={visible ? tabs : null}
        board={index}
        setBoard={setBoard}
        items={items}
        renderBoard={renderBoard}
        onRefresh={() => Promise.allSettled([refresh(), stories.refresh(), highlights.refresh(), visible ? state.refresh() : null])}
        onEndReached={visible ? state.more : undefined}
      />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        items={[
          { icon: LinkIcon, label: t("Copia URL del profilo"), onPress: () => { Clipboard.setStringAsync(profileUrl(handle)).catch(() => {}); setMenu(false); say(t("Link copiato")); } },
          blocked ? null : { icon: Send, label: t("Invia messaggio"), onPress: () => { setMenu(false); message(); } },
          person.isFollowing || person.requested ? { icon: UserMinus, label: person.requested ? t("Annulla richiesta") : t("Non seguire più"), onPress: () => { setMenu(false); unfollow(handle).catch((err) => say(errorText(err, t))); } } : null,
          person.followsMe ? { icon: UserMinus, label: t("Rimuovi follower"), onPress: dropFollower } : null,
          { icon: Mute, label: muted ? t("Riattiva") : t("Silenzia"), onPress: () => { setMenu(false); setList("muted", !muted); say(muted ? t("Account riattivato") : t("Account silenziato")); } },
          blocked
            ? { icon: Block, label: t("Sblocca"), onPress: () => { setMenu(false); setList("blocked", false); say(t("Account sbloccato")); } }
            : { icon: Block, label: t("Blocca"), danger: true, onPress: block },
        ]}
      />
      <ActionSheet
        open={unfollowAsk}
        onClose={() => setUnfollowAsk(false)}
        hint={person.private ? t("Se cambi idea, dovrai chiedere di nuovo di seguire @{handle}.", { handle }) : `@${handle}`}
        items={[{ icon: UserMinus, label: t("Non seguire più"), danger: true, onPress: doUnfollow }]}
      />
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: 22, paddingTop: 14, paddingHorizontal: INSET },
  ring: { padding: 4, alignItems: "center", justifyContent: "center" },
  add: { position: "absolute", right: -1, bottom: -1, width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  buttons: { flexDirection: "row", gap: 6, paddingTop: 14, paddingBottom: 4, paddingHorizontal: INSET },
  square: { width: 34, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  requests: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginHorizontal: INSET, paddingHorizontal: 12, height: 40, borderRadius: 10 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  discoverHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 8, paddingHorizontal: INSET },
  suggest: { width: 150, alignItems: "center", paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  suggestX: { position: "absolute", top: 6, right: 6, width: 24, height: 24, alignItems: "center", justifyContent: "center", zIndex: 2 },
  highlights: { gap: 16, paddingTop: 12, paddingBottom: 14, paddingHorizontal: INSET },
  highlight: { width: 66, alignItems: "center", gap: 6 },
  hlRing: { width: 66, height: 66, borderRadius: 33, padding: 3, borderWidth: 1 },
  cat: { height: 30, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 12, paddingTop: 10, paddingHorizontal: INSET },
  shopPic: { width: "100%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", marginBottom: 5 },
  shopAdd: { alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", gap: 3 },
  shopAddIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  flag: { position: "absolute", left: 8, top: 8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  badge: { position: "absolute", top: 6, right: 6, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  mark: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  shadow: { textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  peekBack: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)" },
  peek: { width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  peekHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  peekActions: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  peekAction: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 12 },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: INSET, paddingTop: 8 },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 6 },
  input: { marginTop: 10, height: 44, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  frame: { width: 72, height: 128, borderRadius: 10, overflow: "hidden", borderWidth: 2 },
  pick: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  psTop: { flexDirection: "row", alignItems: "center", gap: 24, paddingTop: 8, paddingHorizontal: INSET },
  psActions: { flexDirection: "row", gap: 6, paddingTop: 14, paddingBottom: 12, paddingHorizontal: INSET },
  psBtn: { flex: 1, height: 34, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
});
