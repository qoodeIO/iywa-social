import { useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTheme } from "../theme";
import { useStore } from "../lib/store";
import { TIME } from "../lib/profile-data";
import { Feather } from "../ui/icons-profile";
import { Header, T, tap } from "../ui/kit";
import { IgEmpty, SlideTabs } from "../ui/profile-kit";
import { ComposePrompt, ThoughtEntry, buildThoughts, composeThought } from "../ui/thoughts";

// Pensieri: "Per te" and "Seguiti", with a floating pen that hides while you scroll down.
export default function ThoughtsScreen() {
  const theme = useTheme();
  const store = useStore();
  const { all } = buildThoughts(store);
  const [tab, setTab] = useState(0);
  const fab = useRef(new Animated.Value(1)).current;
  const shown = useRef(true);
  const last = useRef(0);
  const list = useMemo(() => (tab === 0
    ? [...all].sort((a, b) => Number(Boolean(b.mine)) - Number(Boolean(a.mine)) || (b.likes + b.created / TIME.HOUR) - (a.likes + a.created / TIME.HOUR))
    : all.filter((item) => item.mine || store.follows.includes(item.name)).sort((a, b) => b.created - a.created)), [all, tab, store.follows]);

  function onScroll(event) {
    const top = event.nativeEvent.contentOffset.y;
    const next = top < last.current || top < 60;
    last.current = top;
    if (next !== shown.current) {
      shown.current = next;
      Animated.spring(fab, { toValue: next ? 1 : 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Feather size={18} weight="fill" color={theme.text} /><T size={17} weight="700">Pensieri</T></View>} />
      <SlideTabs tabs={[{ key: "foryou", label: "Per te" }, { key: "following", label: "Seguiti" }]} active={tab} onChange={setTab} height={42} size={15} dim="text3" />
      <FlashList
        key={tab}
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ThoughtEntry thought={item} />}
        ListHeaderComponent={<ComposePrompt />}
        ListEmptyComponent={<IgEmpty icon={Feather} title="Ancora niente qui" text="Segui qualcuno per vedere i suoi pensieri." />}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: 90 }}
      />
      <Animated.View style={[styles.fabWrap, { opacity: fab, transform: [{ translateY: fab.interpolate({ inputRange: [0, 1], outputRange: [110, 0] }) }, { scale: fab.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
        <Pressable accessibilityLabel="Nuovo pensiero" onPress={() => { tap(); composeThought(); }} style={({ pressed }) => [styles.fab, { backgroundColor: theme.text, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
          <Feather size={26} weight="bold" color={theme.bg} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: "absolute", right: 18, bottom: 28 },
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 13, shadowOffset: { width: 0, height: 10 } },
});
