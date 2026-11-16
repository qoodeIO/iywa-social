import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { TAB_HEIGHT, dark as darkTheme, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { useLive } from "../live/LiveStore";
import { House, Reels, Search, Send } from "./icons";
import { T, tap } from "./kit";
import { t, tk } from "../lib/i18n";
import { PAGES, openTab, pagerX, useTabs } from "../lib/tabs";

export const TABS = [
  { page: "home", icon: House, label: tk("Home") },
  { page: "search", icon: Search, label: tk("Cerca") },
  { page: "reels", icon: Reels, label: tk("Reel") },
  { page: "messages", icon: Send, label: tk("Messaggi") },
  { page: "profile", icon: null, label: tk("Profilo") },
];

// Screens that take the whole phone: no tab bar.
const FULL = [/^\/story\//, /^\/chat\//, /^\/compose/, /^\/reel-camera/, /^\/create/, /^\/comments\//, /^\/share\//, /^\/edit-profile/, /^\/product-edit\//, /^\/qr/, /^\/auth/];

export function goTab(page) {
  tap();
  openTab(page);
}

export default function TabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const light = useTheme();
  const live = useLive();
  const { width: W } = useWindowDimensions();
  const { index } = useTabs();
  if (FULL.some((rule) => rule.test(path))) return null;
  const onPager = path === "/";
  const current = PAGES[index];
  const theme = onPager && (current === "reels" || current === "camera") ? darkTheme : light;
  // On the pager the bar slides away to the right as the story camera comes in from the left.
  const slide = onPager ? pagerX.interpolate({ inputRange: [0, W], outputRange: [W, 0], extrapolate: "clamp" }) : 0;
  const unread = store.chats.filter((chat) => chat.unread).length + (live?.unread || 0);
  return (
    <View style={{ backgroundColor: "#000" }}>
    <Animated.View style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: theme.bg, borderTopColor: theme.line, transform: [{ translateX: slide }] }]}>
      {TABS.map((tab) => {
        const on = current === tab.page;
        const Icon = tab.icon;
        return (
          <Pressable key={tab.page} accessibilityRole="tab" accessibilityLabel={t(tab.label)} accessibilityState={{ selected: on }} style={styles.tab} onPress={() => goTab(tab.page)}>
            {Icon ? (
              <Icon size={27} color={theme.text} weight={on ? "fill" : "regular"} />
            ) : (
              <View style={[styles.face, { borderColor: on ? theme.text : "transparent" }]}>
                <Image source={{ uri: store.profile.src }} style={styles.faceImg} />
              </View>
            )}
            {tab.page === "messages" && unread ? (
              <View style={[styles.badge, { backgroundColor: theme.red, borderColor: theme.bg }]}><T size={10} weight="700" color="#fff">{unread}</T></View>
            ) : null}
          </Pressable>
        );
      })}
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: TAB_HEIGHT, alignItems: "center", justifyContent: "center" },
  face: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, padding: 1.5 },
  faceImg: { width: "100%", height: "100%", borderRadius: 15 },
  badge: { position: "absolute", top: 6, left: "54%", minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
