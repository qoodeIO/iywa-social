import { useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useTheme } from "../theme";
import { useStore } from "../lib/store";
import { useThoughtsFeed } from "../lib/social";
import { errorText } from "../lib/api";
import { Feather } from "../ui/icons-profile";
import { Btn, Header, T, tap } from "../ui/kit";
import { IgEmpty, SlideTabs } from "../ui/profile-kit";
import { t } from "../lib/i18n";
import { ComposePrompt, ThoughtEntry, composeThought, thoughtHidden, thoughtShape } from "../ui/thoughts";

const TABS = ["all", "following"];

// Pensieri: "Per te" and "Seguiti", with a floating pen that hides while you scroll down.
export default function ThoughtsScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const fab = useRef(new Animated.Value(1)).current;
  const shown = useRef(true);
  const last = useRef(0);

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
      <Header title={<View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Feather size={18} weight="fill" color={theme.text} /><T size={17} weight="700">{t("Pensieri")}</T></View>} />
      <SlideTabs tabs={[{ key: "foryou", label: t("Per te") }, { key: "following", label: t("Seguiti") }]} active={tab} onChange={setTab} height={42} size={15} dim="text3" />
      <ThoughtFeed key={TABS[tab]} tab={TABS[tab]} onScroll={onScroll} />
      <Animated.View style={[styles.fabWrap, { opacity: fab, transform: [{ translateY: fab.interpolate({ inputRange: [0, 1], outputRange: [110, 0] }) }, { scale: fab.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
        <Pressable accessibilityLabel={t("Nuovo pensiero")} onPress={() => { tap(); composeThought(); }} style={({ pressed }) => [styles.fab, { backgroundColor: theme.text, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
          <Feather size={26} weight="bold" color={theme.bg} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ThoughtFeed({ tab, onScroll }) {
  const theme = useTheme();
  const store = useStore();
  const { items, loading, refreshing, moreLoading, done, error, refresh, more } = useThoughtsFeed(tab);
  const list = items.filter((item) => !thoughtHidden(store.prefs, thoughtShape(item)));

  let empty = null;
  if (loading) empty = <ActivityIndicator style={{ marginTop: 40 }} color={theme.text2} />;
  else if (error) {
    empty = (
      <IgEmpty icon={Feather} title={t("Impossibile caricare i pensieri")} text={errorText(error, t)}>
        <Btn title={t("Riprova")} onPress={refresh} height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} />
      </IgEmpty>
    );
  } else if (tab === "following") {
    empty = (
      <IgEmpty icon={Feather} title={t("Ancora niente qui")} text={t("Segui qualcuno per vedere i suoi pensieri qui.")}>
        <Btn title={t("Trova persone")} kind="primary" onPress={() => router.push("/search")} height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} />
      </IgEmpty>
    );
  } else {
    empty = <IgEmpty icon={Feather} title={t("Ancora nessun pensiero")} text={t("Scrivi il primo: una frase, una domanda, un sondaggio.")} />;
  }

  return (
    <FlashList
      data={list}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ThoughtEntry thought={item} />}
      ListHeaderComponent={<ComposePrompt />}
      ListEmptyComponent={empty}
      ListFooterComponent={moreLoading ? <ActivityIndicator style={{ marginVertical: 18 }} color={theme.text2} /> : null}
      onEndReached={() => { if (!done) more(); }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.text2} />}
      onScroll={onScroll}
      scrollEventThrottle={32}
      contentContainerStyle={{ paddingBottom: 90 }}
    />
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: "absolute", right: 18, bottom: 28 },
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 13, shadowOffset: { width: 0, height: 10 } },
});
