import { memo, useCallback, useMemo } from "react";
import { Dimensions, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { postCard, useTagPosts } from "../../lib/social";
import { openGridItem } from "../../lib/profile-data";
import { Hash } from "../../ui/icons";
import { CarouselGlyph, ReelGlyph } from "../../ui/feedIcons";
import { Empty, Header, T } from "../../ui/kit";
import { RetryLine, Spinner } from "../../ui/feed";
import { shown } from "../../ui/feedData";
import { t } from "../../lib/i18n";

const W = Dimensions.get("window").width;
const TILE = (W - 4) / 3;

// Every post with a #tag, newest first (web HashtagScreen).
export default function HashtagScreen() {
  const theme = useTheme();
  const store = useStore();
  const { tag } = useLocalSearchParams();
  const key = decodeURIComponent(String(tag || "")).replace(/^#/, "").toLowerCase();
  const feed = useTagPosts(key);
  const prefs = store.prefs;
  const cards = useMemo(() => feed.items.map(postCard).filter((post) => shown(prefs, post)), [feed.items, prefs]);
  const total = Math.max(feed.data?.total || 0, cards.length);
  const cover = cards.find((post) => post.image && !post.video)?.image || cards.find((post) => post.image)?.image;
  const open = useCallback((post) => {
    if (post.kind === "tweet") router.push(`/thought/${encodeURIComponent(post.id)}`);
    else openGridItem(post, cards.filter((item) => item.kind !== "tweet"), `#${key}`);
  }, [cards, key]);

  const head = (
    <View style={[styles.head, { borderBottomColor: theme.line }]}>
      <View style={styles.face}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        {cover ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} /> : null}
        <Hash size={34} weight="bold" color="#fff" />
      </View>
      <View style={{ flex: 1, alignItems: "flex-start", gap: 3 }}>
        <T size={20} weight="700">#{key}</T>
        <T size={14} color={theme.text2}>{feed.loading ? " " : total === 1 ? t("1 post") : t("{n} post", { n: total })}</T>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={`#${key}`} />
      <FlashList
        data={cards}
        numColumns={3}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={head}
        renderItem={({ item, index }) => <Tile post={item} index={index} onOpen={open} />}
        onEndReached={() => { if (!feed.done) feed.more(); }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={theme.text2} />}
        ListEmptyComponent={
          feed.loading ? <View style={styles.center}><Spinner /></View>
            : feed.error ? <RetryLine error={feed.error} onRetry={feed.refresh} />
              : <Empty icon={Hash} title={t("Ancora nessun post")} text={t("Usa tu per primo questo tag.")} />
        }
        ListFooterComponent={feed.moreLoading ? <View style={styles.center}><Spinner /></View> : null}
      />
    </View>
  );
}

const Tile = memo(function Tile({ post, index, onOpen }) {
  const theme = useTheme();
  const thought = post.kind === "tweet";
  const src = post.media?.[0]?.type === "video" ? post.media[0].poster : post.image;
  return (
    <Pressable
      onPress={() => onOpen(post)}
      accessibilityLabel={t("Post, {name}", { name: post.owner })}
      style={{ width: TILE, height: TILE, marginLeft: index % 3 ? 2 : 0, marginTop: 2, backgroundColor: theme.fill }}
    >
      {thought ? (
        <View style={styles.thought}>
          <T size={12} weight="600" color={theme.text2} lines={1}>{post.owner}</T>
          <T size={13} lines={5}>{post.text}</T>
        </View>
      ) : src ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={src} />
      ) : null}
      {post.kind === "reel" ? <View style={styles.badge}><ReelGlyph size={18} weight="fill" color="#fff" /></View> : post.images?.length > 1 ? <View style={styles.badge}><CarouselGlyph size={18} weight="fill" color="#fff" /></View> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: INSET, paddingTop: 8, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 2 },
  face: { width: 86, height: 86, borderRadius: 43, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#6d6af6" },
  center: { alignItems: "center", paddingVertical: 32 },
  thought: { flex: 1, padding: 8, gap: 4 },
  badge: { position: "absolute", top: 6, right: 6, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});
