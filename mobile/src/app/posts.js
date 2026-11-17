// A profile or explore grid opened as a feed: starts at the tapped post and scrolls on
// through the rest of the grid, like Instagram (web PostsFeed).
// lib/profile-data.js openGridItem stores { list, start, title }; list items are server posts or cards.
import { useCallback, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_HEIGHT, useTheme } from "../theme";
import { Empty, Header } from "../ui/kit";
import { ImageIcon } from "../ui/icons";
import { PostCard, setVisiblePosts } from "../ui/feed";
import { gridFeed } from "../lib/profile-data";
import { t } from "../lib/i18n";

export default function PostsFeed() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { list, start, title } = useMemo(() => gridFeed() || { list: [], start: 0 }, []);
  const [gone, setGone] = useState(() => new Set());
  const posts = useMemo(() => (list || []).filter((item) => item?.id && !gone.has(item.id)), [list, gone]);
  const first = Math.max(0, Math.min(start || 0, posts.length - 1));
  const drop = useCallback((id) => setGone((prev) => new Set(prev).add(id)), []);
  const renderItem = useCallback(({ item }) => <PostCard post={item} onDeleted={drop} />, [drop]);
  const listRef = useRef(null);
  const placed = useRef(false);
  // Posts have different heights, so the first jump is an estimate: once drawn, land exactly.
  const onLoad = useCallback(() => {
    if (placed.current || !first) return;
    placed.current = true;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: first, animated: false }));
  }, [first]);
  const onViewable = useCallback(({ viewableItems }) => setVisiblePosts(viewableItems.map((v) => v.item?.id)), []);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={title || t("Post")} border />
      <FlashList
        ref={listRef}
        onLoad={onLoad}
        data={posts}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderItem}
        initialScrollIndex={posts.length ? first : undefined}
        onViewableItemsChanged={onViewable}
        ListEmptyComponent={<Empty icon={ImageIcon} title={t("Nessun post")} text={t("Torna indietro e riprova.")} />}
        contentContainerStyle={{ paddingBottom: TAB_HEIGHT + insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
