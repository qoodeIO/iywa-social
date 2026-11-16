import { Pressable, StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { TAB_HEIGHT, dark as darkTheme, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { useLive } from "../live/LiveStore";
import { House, Reels, Search, Send } from "./icons";
import { T, tap } from "./kit";

export const TABS = [
  { href: "/", icon: House, label: "Home" },
  { href: "/search", icon: Search, label: "Cerca" },
  { href: "/reels", icon: Reels, label: "Reel" },
  { href: "/messages", icon: Send, label: "Messaggi" },
  { href: "/profile", icon: null, label: "Profilo" },
];

// Screens that take the whole phone: no tab bar.
const FULL = [/^\/story\//, /^\/chat\//, /^\/compose/, /^\/reel-camera/, /^\/create/, /^\/comments\//, /^\/share\//, /^\/edit-profile/, /^\/product-edit\//, /^\/qr/, /^\/auth/];

export function tabOf(path) {
  if (path === "/") return "/";
  return TABS.find((tab) => tab.href !== "/" && path.startsWith(tab.href))?.href || null;
}

export function goTab(href, path) {
  tap();
  if (path === href) return;
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

export default function TabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const light = useTheme();
  if (FULL.some((rule) => rule.test(path))) return null;
  const onReels = path === "/reels";
  const theme = onReels ? darkTheme : light;
  const current = tabOf(path);
  const live = useLive();
  const unread = store.chats.filter((chat) => chat.unread).length + (live?.unread || 0);
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: theme.bg, borderTopColor: theme.line }]}>
      {TABS.map((tab) => {
        const on = current === tab.href;
        const Icon = tab.icon;
        return (
          <Pressable key={tab.href} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }} style={styles.tab} onPress={() => goTab(tab.href, path)}>
            {Icon ? (
              <Icon size={27} color={theme.text} weight={on ? "fill" : "regular"} />
            ) : (
              <View style={[styles.face, { borderColor: on ? theme.text : "transparent" }]}>
                <Image source={{ uri: store.profile.src }} style={styles.faceImg} />
              </View>
            )}
            {tab.href === "/messages" && unread ? (
              <View style={[styles.badge, { backgroundColor: theme.red, borderColor: theme.bg }]}><T size={10} weight="700" color="#fff">{unread}</T></View>
            ) : null}
          </Pressable>
        );
      })}
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
