import { memo, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { Feather, Hash } from "../../ui/icons";
import { CarouselGlyph, ReelGlyph } from "../../ui/feedIcons";
import { Empty, Header, T, tap } from "../../ui/kit";
import { openPost } from "../../ui/feed";
import { ThoughtEntry, useThoughts } from "../../ui/thoughts";
import { hashtagPool, hashtagsOf } from "../../ui/feedData";

const W = Dimensions.get("window").width;
const TILE = (W - 4) / 3;
const TABS = [["top", "Più popolari"], ["recent", "Recenti"], ["thoughts", "Pensieri"]];

// Every post and thought with a #tag (web HashtagScreen).
export default function HashtagScreen() {
  const theme = useTheme();
  const store = useStore();
  const { tag } = useLocalSearchParams();
  const key = decodeURIComponent(String(tag || "")).replace(/^#/, "").toLowerCase();
  const [tab, setTab] = useState("top");
  const has = (text) => hashtagsOf(text).includes(key);
  const posts = useMemo(() => hashtagPool(store.library).filter((post) => has(post.text) || post.tag?.toLowerCase() === key), [store.library, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { all } = useThoughts();
  const thoughts = useMemo(() => all.filter((thought) => has(thought.text)), [all, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const following = store.follows.includes(`#${key}`);
  const cover = posts[0]?.image;
  const list = tab === "recent" ? [...posts].reverse() : posts;

  const head = (
    <View>
      <View style={styles.head}>
        <View style={styles.face}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
          {cover ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} /> : null}
          <Hash size={34} weight="bold" color="#fff" />
        </View>
        <View style={{ flex: 1, alignItems: "flex-start", gap: 3 }}>
          <T size={20} weight="700">#{key}</T>
          <T size={14} color={theme.text2}>{posts.length} post · {thoughts.length} pensieri</T>
          <Pressable onPress={() => { tap(); store.toggleFollow(`#${key}`); }} style={({ pressed }) => [styles.follow, { backgroundColor: following ? theme.btn : theme.blue, opacity: pressed ? 0.75 : 1 }]}>
            <T size={14} weight="600" color={following ? theme.text : "#fff"}>{following ? "Segui già" : "Segui"}</T>
          </Pressable>
        </View>
      </View>
      <View style={[styles.tabs, { borderBottomColor: theme.line }]}>
        {TABS.map(([id, label]) => (
          <Pressable key={id} onPress={() => { tap(); setTab(id); }} style={styles.tab}>
            <T size={14} weight="600" color={tab === id ? theme.text : theme.text2}>{label}</T>
            {tab === id ? <View style={[styles.tabBar, { backgroundColor: theme.text }]} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={`#${key}`} />
      {tab === "thoughts" ? (
        <FlashList
          key="thoughts"
          data={thoughts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={head}
          renderItem={({ item }) => <ThoughtEntry thought={item} />}
          ListEmptyComponent={<Empty icon={Feather} title="Nessun pensiero con questo tag" />}
        />
      ) : (
        <FlashList
          key={`grid-${tab}`}
          data={list}
          numColumns={3}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={head}
          renderItem={({ item, index }) => <Tile post={item} index={index} />}
          ListEmptyComponent={<Empty icon={Hash} title="Ancora nessun post" text="Usa tu per primo questo tag." />}
        />
      )}
    </View>
  );
}

const Tile = memo(function Tile({ post, index }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => openPost(post.id)} accessibilityLabel={`Post, ${post.name}`} style={{ width: TILE, height: TILE, marginLeft: index % 3 ? 2 : 0, marginTop: 2, backgroundColor: theme.fill }}>
      <Image source={{ uri: post.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={post.image} />
      {post.kind === "reel" ? <View style={styles.badge}><ReelGlyph size={18} weight="fill" color="#fff" /></View> : post.images?.length > 1 ? <View style={styles.badge}><CarouselGlyph size={18} weight="fill" color="#fff" /></View> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: INSET, paddingTop: 8, paddingBottom: 16 },
  face: { width: 86, height: 86, borderRadius: 43, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#6d6af6" },
  follow: { height: 30, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 4 },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  tabBar: { position: "absolute", bottom: 0, left: "18%", right: "18%", height: 1.5, borderRadius: 1 },
  badge: { position: "absolute", top: 6, right: 6, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});
