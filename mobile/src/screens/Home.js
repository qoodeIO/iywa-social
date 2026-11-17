import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTabReselect, openTab } from "../lib/tabs";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { postCard, useFeed, useNotifications, useStories, useSuggested, useUnreadCount } from "../lib/social";
import { Bag, Feather, Heart, PlusSquare, Search } from "../ui/icons";
import { Btn, T, tap } from "../ui/kit";
import { FeedFooter, FeedPost, PostMenu, RetryLine, Spinner, StoryRail, SuggestRail, setVisiblePosts, usePostActions } from "../ui/feed";
import { ComposePrompt, composeThought } from "../ui/thoughts";
import { shown } from "../ui/feedData";
import { t } from "../lib/i18n";

const BAR = 48;
const THOUGHTS_ROUTE = "/thoughts";
// Below this many posts the feed also suggests people to follow.
const SHORT_FEED = 6;

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const feed = useFeed();
  const stories = useStories();
  const suggested = useSuggested();
  useNotifications(); // loads the unread count for the heart dot
  const unread = useUnreadCount() > 0;
  const [menu, setMenu] = useState(null);
  const actions = usePostActions({ onMenu: (post, mine) => setMenu({ post, mine }) });
  const prefs = store.prefs;
  const cartCount = store.cart.reduce((sum, item) => sum + item.qty, 0);
  const [pulling, setPulling] = useState(false);

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

  const posts = useMemo(() => feed.items.map(postCard).filter((post) => shown(prefs, post)), [feed.items, prefs]);
  const people = useMemo(() => (suggested.data || []).filter((person) => shown(prefs, { owner: person.handle, name: person.name })).slice(0, 15), [suggested.data, prefs]);
  const suggest = !feed.loading && posts.length < SHORT_FEED && people.length > 0 && prefs.suggested !== false;

  const rows = useMemo(() => {
    const out = [{ type: "rail", key: "rail" }, { type: "prompt", key: "prompt" }];
    if (feed.loading && !posts.length) return [...out, { type: "loading", key: "loading" }];
    if (feed.error && !posts.length) return [...out, { type: "error", key: "error" }];
    if (!posts.length) out.push({ type: "empty", key: "empty" });
    // A new account sees people to follow right away; a short feed after its first posts.
    const at = Math.min(2, posts.length);
    posts.forEach((post, index) => {
      if (index === at && suggest) out.push({ type: "suggest", key: "suggest" });
      out.push({ type: "post", key: `p-${post.id}`, post });
    });
    if (posts.length <= at && suggest) out.push({ type: "suggest", key: "suggest" });
    return out;
  }, [posts, suggest, feed.loading, feed.error]);

  const showCounts = prefs.likeCounts !== false;

  const renderItem = useCallback(({ item: row }) => {
    switch (row.type) {
      case "rail":
        return <StoryRail />;
      case "prompt":
        return <ComposePrompt onCompose={() => composeThought()} />;
      case "loading":
        return <View style={styles.loading}><Spinner /></View>;
      case "error":
        return <RetryLine error={feed.error} onRetry={feed.refresh} />;
      case "empty":
        return <EmptyFeed />;
      case "suggest":
        return <SuggestRail people={people} title={t("Persone da seguire")} />;
      default:
        return <FeedPost post={row.post} mine={row.post.mine} showCounts={showCounts} actions={actions} />;
    }
  }, [showCounts, people, actions, feed.error, feed.refresh]);

  const refresh = useCallback(async () => {
    setPulling(true);
    await Promise.all([feed.refresh(), stories.refresh(), suggested.refresh()]).catch(() => {});
    setPulling(false);
  }, [feed, stories, suggested]);

  const onViewable = useCallback(({ viewableItems }) => {
    setVisiblePosts(viewableItems.filter((v) => v.item?.type === "post").map((v) => v.item.post.id));
  }, []);

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
        onViewableItemsChanged={onViewable}
        onEndReached={() => { if (posts.length && !feed.done) feed.more(); }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={posts.length ? <FeedFooter done={feed.done} loading={feed.moreLoading} /> : null}
        contentContainerStyle={{ paddingBottom: 8 }}
        refreshControl={<RefreshControl refreshing={pulling || feed.refreshing} tintColor={theme.text2} onRefresh={refresh} />}
      />
      <PostMenu target={menu} onClose={() => setMenu(null)} />
    </View>
  );
}

// A new account follows nobody yet: point to Search and Explore.
function EmptyFeed() {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: theme.text }]}><Search size={32} color={theme.text} weight="light" /></View>
      <T size={20} weight="700" style={{ textAlign: "center" }}>{t("Benvenuto su iywa")}</T>
      <T size={14} color={theme.text2} style={{ textAlign: "center" }}>{t("Segui qualcuno per vedere i suoi post qui. Cerca persone che conosci o scopri nuovi creatori in Esplora.")}</T>
      <Btn title={t("Cerca persone")} kind="primary" height={38} style={{ marginTop: 8, alignSelf: "stretch" }} onPress={() => { tap(); openTab("search"); }} />
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
  loading: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", gap: 8, paddingTop: 40, paddingBottom: 24, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 6 },
});
