import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTabReselect } from "../lib/tabs";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR, FEED_PAGES, MEET } from "../data";
import { Bag, Feather, Heart, PlusSquare } from "../ui/icons";
import { T, tap } from "../ui/kit";
import { FeaturedHead, FeedFooter, FeedPost, PostMenu, ReelsRail, StoryRail, SuggestRail, usePostActions } from "../ui/feed";
import { ComposePrompt, ThoughtEntry, buildThoughts, composeThought } from "../ui/thoughts";
import { HOME_HERO, personHidden, shown } from "../ui/feedData";
import { t } from "../lib/i18n";

const BAR = 48;
const THOUGHTS_ROUTE = "/thoughts";

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState(null);
  const actions = usePostActions({ onMenu: (post, mine) => setMenu({ post, mine, archivable: mine && post.id !== HOME_HERO.id }) });
  const prefs = store.prefs;
  const cartCount = store.cart.reduce((sum, item) => sum + item.qty, 0);
  const unread = !store.readNotes || (store.notifications || []).some((note) => !note.read);
  const done = page >= FEED_PAGES.length;

  // Top bar slides away while scrolling down and comes back when scrolling up (web onChrome).
  const barH = useSharedValue(BAR);
  const scroll = useRef({ last: 0, hidden: false });
  const listRef = useRef(null);
  useTabReselect("home", () => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  const barStyle = useAnimatedStyle(() => ({ height: barH.value, opacity: barH.value / BAR }));
  const onScroll = useCallback((event) => {
    const top = event.nativeEvent.contentOffset.y;
    const state = scroll.current;
    const next = top > 80 && top > state.last + 4 ? true : top < state.last - 4 || top < 40 ? false : state.hidden;
    state.last = top;
    if (next !== state.hidden) {
      state.hidden = next;
      barH.value = withTiming(next ? 0 : BAR, { duration: 220 });
    }
  }, [barH]);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => {
      setPage((current) => Math.min(FEED_PAGES.length, current + 1));
      setLoading(false);
    }, 650);
    return () => clearTimeout(timer);
  }, [loading]);

  const rows = useMemo(() => {
    const out = [{ type: "rail", key: "rail" }, { type: "prompt", key: "prompt" }];
    const thoughts = buildThoughts(store);
    for (const thought of thoughts.all.filter((item) => item.mine)) out.push({ type: "thought", key: `t-${thought.id}`, thought });
    const archived = store.archived || [];
    for (const item of store.library || []) {
      if (!["post", "reel", "tweet"].includes(item.kind) || archived.includes(item.id) || !shown(prefs, item)) continue;
      out.push({ type: "post", key: `p-${item.id}`, post: { ...item, src: item.src || store.profile.src || AVATAR }, mine: true });
    }
    out.push({ type: "post", key: "p-hero", post: HOME_HERO, mine: store.profile.name === HOME_HERO.name });
    if (prefs.suggested !== false) out.push({ type: "suggest", key: "suggest" });
    const featured = ["th-thread", "th-poll"].map((id) => thoughts.byId.get(id)).filter(Boolean);
    if (featured.length) {
      out.push({ type: "featuredHead", key: "featured" });
      featured.forEach((thought, index) => out.push({ type: "thought", key: `f-${thought.id}`, thought, last: index === featured.length - 1 }));
    }
    out.push({ type: "reels", key: "reels" });
    for (const item of FEED_PAGES.slice(0, page).flat()) {
      if (!shown(prefs, item) || archived.includes(item.id)) continue;
      const thought = item.type === "tweet" ? thoughts.byId.get(item.id) : null;
      if (thought) out.push({ type: "thought", key: `ft-${item.id}`, thought });
      else out.push({ type: "post", key: `fp-${item.id}`, post: { ...item, kind: item.type }, mine: false });
    }
    return out;
  }, [store.myThoughts, store.thoughtReplies, store.library, store.archived, store.profile, prefs, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const meet = useMemo(() => MEET.filter((person) => !personHidden(prefs, person.name)), [prefs]);
  const follow = actions.follow;
  const showCounts = prefs.likeCounts !== false;
  const { likes, saves, follows, postComments } = store;
  const myName = store.profile.name;
  const mySrc = store.profile.src;

  const renderItem = useCallback(({ item: row }) => {
    switch (row.type) {
      case "rail":
        return <StoryRail />;
      case "prompt":
        return <ComposePrompt onCompose={() => composeThought()} />;
      case "thought":
        return <ThoughtEntry thought={row.thought} />;
      case "featuredHead":
        return <FeaturedHead onAll={() => router.push(THOUGHTS_ROUTE)} />;
      case "suggest":
        return <SuggestRail people={meet} follows={follows} onFollow={follow} />;
      case "reels":
        return <ReelsRail prefs={prefs} />;
      default: {
        const { post } = row;
        return (
          <FeedPost
            post={post}
            liked={likes.includes(post.id)}
            saved={saves.includes(post.id)}
            following={follows.includes(post.name)}
            extraComments={postComments?.[post.id]}
            mine={row.mine}
            canFollow={Boolean(post.name) && post.name !== myName}
            showCounts={showCounts}
            actions={actions}
          />
        );
      }
    }
  }, [likes, saves, follows, postComments, myName, mySrc, showCounts, meet, follow, prefs, actions]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <Animated.View style={[styles.top, { backgroundColor: theme.bg }, barStyle]}>
        <View style={styles.topInner}>
          <T size={27} weight="700" style={{ letterSpacing: -1.6 }}>iywa</T>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TopIcon icon={Bag} label={t("Shop")} badge={cartCount} onPress={() => router.push("/shop")} />
            <TopIcon icon={Feather} label={t("Pensieri")} onPress={() => router.push(THOUGHTS_ROUTE)} />
            <TopIcon icon={PlusSquare} label={t("Crea")} onPress={() => router.push("/create")} />
            <TopIcon icon={Heart} label={t("Notifiche")} dot={unread} onPress={() => router.push("/notifications")} />
          </View>
        </View>
      </Animated.View>
      <FlashList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        renderItem={renderItem}
        extraData={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReached={() => { if (!done && !loading) setLoading(true); }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={<FeedFooter done={done} />}
        contentContainerStyle={{ paddingBottom: 8 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.text2}
            onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); }}
          />
        )}
      />
      <PostMenu target={menu} onClose={() => setMenu(null)} />
    </View>
  );
}

function TopIcon({ icon: Icon, label, onPress, badge, dot }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.5 : 1 }]}>
      <Icon size={26} color={theme.text} />
      {badge ? (
        <View style={[styles.badge, { borderColor: theme.bg, backgroundColor: theme.red }]}>
          <T size={10.5} weight="700" color="#fff">{badge > 9 ? "9+" : badge}</T>
        </View>
      ) : null}
      {dot ? <View style={[styles.dot, { backgroundColor: theme.red, borderColor: theme.bg }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { overflow: "hidden", zIndex: 2 },
  topInner: { height: BAR, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: INSET, paddingRight: 6 },
  icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 8, right: 7, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
});
