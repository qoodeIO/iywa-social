// Reels: vertical, full-height pager over the server's reels feed. Port of the web's ReelScreen (src/App.jsx).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { openTab, usePageFocused, useTabParams, useTabReselect } from "../lib/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../lib/store";
import { useTheme } from "../theme";
import { t } from "../lib/i18n";
import { cachedPost, deletePost, fetchPost, like, postCard, toggleFollow, toggleLike, toggleSave, usePost, useProfile, useReelsFeed } from "../lib/social";
import { tap } from "../ui/kit";
import ReelSlide from "../ui/reels-slide";
import { DarkSheet, REEL_SPEEDS, Toast, openReelCamera, reelHidden, useToast } from "../ui/reels-kit";
import { Bookmark, Camera, EyeOff, Hash, SoundOff, SoundOn, SquarePlay, X } from "../ui/reels-icons";

export default function Reels() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const focused = usePageFocused("reels");
  const params = useTabParams("reels");
  const list = useRef(null);
  const accent = useTheme();
  useTabReselect("reels", () => list.current?.scrollToOffset({ offset: 0, animated: true }));
  const feed = useReelsFeed();
  const [size, setSize] = useState(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(Boolean(store.prefs.captions));
  const [hidden, setHidden] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [muteHint, setMuteHint] = useState(0);
  const [pinned, setPinned] = useState(null); // a reel opened by link that isn't in the feed (yet)
  const [relations, setRelations] = useState({}); // handle -> { isFollowing, requested }
  const [toast, note] = useToast(1400);

  // The pinned reel's cache entry, so likes and saves on it show up.
  const pinnedLive = usePost(pinned?.id).data?.post || pinned;
  const all = useMemo(() => {
    const items = feed.items.filter((post) => post.id !== pinnedLive?.id);
    return [...(pinnedLive ? [pinnedLive] : []), ...items]
      .map(postCard)
      .filter((reel) => reel.video && !hidden.includes(reel.id) && (reel.mine || !reelHidden(store.prefs, reel)));
  }, [feed.items, pinnedLive, hidden, store.prefs]);
  const reel = all[index];

  // Follow state of the author on screen (posts only carry the author card, not the relation).
  const author = useProfile(reel && !reel.mine ? reel.owner : null).data;
  useEffect(() => {
    if (!author?.handle) return;
    setRelations((prev) => {
      const now = prev[author.handle];
      if (now && now.isFollowing === author.isFollowing && now.requested === author.requested) return prev;
      return { ...prev, [author.handle]: { isFollowing: Boolean(author.isFollowing), requested: Boolean(author.requested) } };
    });
  }, [author?.handle, author?.isFollowing, author?.requested]); // eslint-disable-line react-hooks/exhaustive-deps

  // Latest state for the stable action handler the slides share.
  const live = useRef({});
  live.current = { all, index, size, note, relations };

  useEffect(() => {
    setSheet(null);
  }, [index]);

  // Keep the index inside the list when it shrinks (refresh, hidden reel, deleted reel).
  useEffect(() => {
    if (index > 0 && index >= all.length) setIndex(Math.max(0, all.length - 1));
  }, [all.length, index]);

  // Shared link or a grid tile: open on a given reel, fetching it when the feed doesn't have it.
  useEffect(() => {
    if (!params.id || !size) return undefined;
    const id = String(params.id);
    let gone = false;
    const show = (at) => {
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: at * size.h, animated: false }));
      setIndex(at);
    };
    const at = all.findIndex((item) => item.id === id);
    if (at >= 0) show(at);
    else {
      const hit = cachedPost(id);
      const use = (post) => {
        if (gone || !post || post.kind !== "reel") return;
        setPinned(post);
        show(0);
      };
      if (hit) use(hit);
      else fetchPost(id).then((data) => use(data.post)).catch(() => { if (!gone) note(t("Reel non disponibile")); });
    }
    router.setParams({ id: undefined });
    return () => { gone = true; };
  }, [params.id, params.at, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback((kind, item) => {
    const { note: say, relations: known } = live.current;
    const fail = () => say(t("Operazione non riuscita"));
    if (kind === "like") toggleLike(item).catch(fail);
    else if (kind === "doubletap") like(item).catch(fail);
    else if (kind === "save") {
      say(item.saved ? t("Rimosso dai salvati") : t("Salvato"));
      toggleSave(item).catch(fail);
    } else if (kind === "follow") {
      const rel = known[item.owner] || {};
      setRelations((prev) => ({ ...prev, [item.owner]: rel.isFollowing || rel.requested ? { isFollowing: false, requested: false } : { isFollowing: true, requested: false } }));
      toggleFollow({ handle: item.owner, ...rel })
        .then((user) => user && setRelations((prev) => ({ ...prev, [item.owner]: { isFollowing: Boolean(user.isFollowing), requested: Boolean(user.requested) } })))
        .catch(() => {
          setRelations((prev) => ({ ...prev, [item.owner]: rel }));
          fail();
        });
    } else if (kind === "comments") router.push(`/comments/${item.id}`);
    else if (kind === "share") router.push(`/share/${item.id}`);
    else if (kind === "more") setSheet("more");
    else if (kind === "audio") say(`♫ ${item.audio || t("Audio originale")}`);
    else if (kind === "mute") {
      setMuted((on) => !on);
      setMuteHint(Date.now());
    } else if (kind === "person") {
      if (item.mine) openTab("profile");
      else router.push(`/person/${item.owner}`);
    }
  }, []);

  const onScroll = useCallback((event) => {
    const box = live.current.size;
    if (!box) return;
    const next = Math.round(event.nativeEvent.contentOffset.y / Math.max(box.h, 1));
    setIndex((current) => (current === next ? current : next));
  }, []);

  function remove(item) {
    Alert.alert(t("Eliminare il reel?"), t("Non potrai recuperarlo."), [
      { text: t("Annulla"), style: "cancel" },
      {
        text: t("Elimina"),
        style: "destructive",
        onPress: () => {
          setSheet(null);
          if (pinned?.id === item.id) setPinned(null);
          deletePost(item.id).then(() => note(t("Reel eliminato"))).catch(() => note(t("Operazione non riuscita")));
        },
      },
    ]);
  }

  const height = size?.h || 0;
  const showCounts = store.prefs.likeCounts !== false;

  const renderItem = ({ item, index: i }) => {
    const rel = relations[item.owner] || {};
    return (
      <ReelSlide
        reel={item}
        width={size.w}
        height={size.h}
        top={insets.top}
        active={i === index && focused}
        near={Math.abs(i - index) <= 1}
        muted={muted}
        rate={rate}
        captions={captions}
        sheetOpen={Boolean(sheet) && i === index}
        commentsOpen={false}
        mine={Boolean(item.mine)}
        liked={Boolean(item.liked)}
        saved={Boolean(item.saved)}
        following={Boolean(rel.isFollowing)}
        requested={Boolean(rel.requested)}
        showCounts={showCounts}
        act={act}
      />
    );
  };

  let empty;
  if (feed.loading) empty = <ActivityIndicator color="#fff" />;
  else if (feed.error && !feed.items.length) {
    empty = (
      <>
        <Text style={styles.emptyTitle}>{t("Impossibile caricare i reel")}</Text>
        <Pressable onPress={() => { tap(); feed.refresh(); }} style={({ pressed }) => [styles.primary, { backgroundColor: "rgba(255,255,255,0.18)", opacity: pressed ? 0.7 : 1 }]}>
          <Text style={styles.primaryText}>{t("Riprova")}</Text>
        </Pressable>
      </>
    );
  } else {
    empty = (
      <>
        <View style={styles.emptyIcon}><SquarePlay size={30} color="#fff" /></View>
        <Text style={styles.emptyTitle}>{t("Ancora nessun reel")}</Text>
        <Text style={styles.emptyText}>{t("Registra un video e sarai il primo a pubblicarne uno.")}</Text>
        <Pressable onPress={() => { tap(); openReelCamera(); }} style={({ pressed }) => [styles.primary, { backgroundColor: accent.blue, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.primaryText, { color: accent.accentInk || "#fff" }]}>{t("Crea un reel")}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.root} onLayout={(event) => { const { width, height: h } = event.nativeEvent.layout; setSize((prev) => (prev && prev.w === width && prev.h === h ? prev : { w: width, h })); }}>
      {focused ? <StatusBar style="light" /> : null}
      {size ? (
        <FlatList
          ref={list}
          data={all}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={[index, focused, muted, rate, captions, sheet, relations, showCounts, size]}
          pagingEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          scrollsToTop={false}
          overScrollMode="never"
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!sheet}
          refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor="#fff" progressViewOffset={insets.top + 44} />}
          onEndReached={() => { if (!feed.done) feed.more(); }}
          onEndReachedThreshold={2}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={<View style={[styles.empty, { height }]}>{empty}</View>}
        />
      ) : null}

      <View pointerEvents="box-none" style={[styles.head, { top: insets.top + 4 }]}>
        <Text style={[styles.title, styles.shadow]}>{t("Reels")}</Text>
        {feed.moreLoading ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t("Crea reel")} hitSlop={6} onPress={() => { tap(); openReelCamera(); }} style={({ pressed }) => [styles.cam, { opacity: pressed ? 0.6 : 1 }]}>
          <Camera size={26} color="#fff" />
        </Pressable>
      </View>

      {muteHint ? <MuteHint key={muteHint} muted={muted} /> : null}
      <Toast text={toast} bottom={110} />

      <DarkSheet open={sheet === "more" && Boolean(reel)} onClose={() => setSheet(null)}>
        <View style={styles.speeds}>
          <Text style={styles.speedLabel}>{t("Velocità")}</Text>
          {REEL_SPEEDS.map((value) => (
            <Pressable key={value} onPress={() => { tap(); setRate(value); }} style={[styles.speed, rate === value ? styles.speedOn : null]}>
              <Text style={[styles.speedText, { color: rate === value ? "#111" : "#fff" }]}>{value}×</Text>
            </Pressable>
          ))}
        </View>
        <Line icon={Hash} label={captions ? t("Nascondi didascalia") : t("Mostra didascalia")} onPress={() => { setCaptions((value) => !value); setSheet(null); }} />
        <Line icon={Bookmark} label={reel?.saved ? t("Rimuovi dai salvati") : t("Salva")} onPress={() => { act("save", reel); setSheet(null); }} />
        {reel?.mine ? (
          <Line icon={X} warn label={t("Elimina")} onPress={() => remove(reel)} />
        ) : (
          <Line icon={EyeOff} label={t("Non mi interessa")} onPress={() => { setHidden((prev) => [...prev, reel.id]); setSheet(null); note(t("Ne vedrai meno così")); }} />
        )}
      </DarkSheet>
    </View>
  );
}

function Line({ icon: Icon, label, warn, onPress }) {
  const color = warn ? "#ff3040" : "#fff";
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.line, { backgroundColor: pressed ? "rgba(255,255,255,0.06)" : "transparent" }]}>
      <Icon size={22} color={color} />
      <Text style={[styles.lineText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function MuteHint({ muted }) {
  const alpha = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    alpha.value = withSequence(withTiming(1, { duration: 175 }), withTiming(0, { duration: 525 }));
    scale.value = withSequence(withTiming(1, { duration: 175 }), withTiming(1.25, { duration: 525 }));
  }, [alpha, scale]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.muteHint, style]}>
      {muted ? <SoundOff size={28} weight="fill" color="#fff" /> : <SoundOn size={28} weight="fill" color="#fff" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  shadow: { textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  head: { position: "absolute", zIndex: 6, left: 0, right: 0, height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 10 },
  title: { flex: 1, color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: -0.66 },
  cam: { width: 40, height: 40, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyText: { color: "rgba(255,255,255,0.65)", fontSize: 14, textAlign: "center" },
  primary: { height: 34, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  muteHint: { position: "absolute", zIndex: 7, top: "50%", left: "50%", width: 64, height: 64, marginTop: -32, marginLeft: -32, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  speeds: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 12 },
  speedLabel: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  speed: { height: 32, paddingHorizontal: 12, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  speedOn: { backgroundColor: "#fff" },
  speedText: { fontSize: 13.5, fontWeight: "600" },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  lineText: { fontSize: 15 },
});
