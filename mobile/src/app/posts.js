// A profile or explore grid opened as a feed: starts at the tapped post and scrolls on
// through the rest of the grid, like Instagram (web PostsFeed).
import { useCallback, useMemo, useRef } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_HEIGHT, useTheme } from "../theme";
import { Header } from "../ui/kit";
import { PostCard } from "../ui/feed";
import { gridFeed } from "../lib/profile-data";
import { t } from "../lib/i18n";

export default function PostsFeed() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { list, start, title } = useMemo(() => gridFeed(), []);
  const renderItem = useCallback(({ item }) => <PostCard post={item} />, []);
  const listRef = useRef(null);
  const placed = useRef(false);
  // Posts have different heights, so the first jump is an estimate: once drawn, land exactly.
  const onLoad = useCallback(() => {
    if (placed.current || !start) return;
    placed.current = true;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: start, animated: false }));
  }, [start]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={title || t("Post")} border />
      <FlashList
        ref={listRef}
        onLoad={onLoad}
        data={list}
        keyExtractor={(post) => String(post.id)}
        renderItem={renderItem}
        initialScrollIndex={start}
        contentContainerStyle={{ paddingBottom: TAB_HEIGHT + insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
