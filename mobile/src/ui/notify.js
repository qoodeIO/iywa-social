import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { router, usePathname } from "expo-router";
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { useStore } from "../lib/store";
import { avatarFor, personByName } from "../data";
import { At, Bag, Comment, Heart, Repost, Sparkle, User } from "./icons";
import { ReplyGlyph, UserPlusGlyph } from "./feedIcons";
import { T, tap } from "./kit";
import { openPost } from "./feed";
import { onToast } from "./feedEcho";

export const NOTE_KINDS = {
  like: { icon: Heart, tone: "#ff3040" },
  comment: { icon: Comment, tone: "#0a84ff" },
  mention: { icon: At, tone: "#a855f7" },
  tag: { icon: User, tone: "#ff9f0a" },
  follow: { icon: UserPlusGlyph, tone: "#0a84ff" },
  reply: { icon: ReplyGlyph, tone: "#14b8a6" },
  repost: { icon: Repost, tone: "#22c55e" },
  story: { icon: Sparkle, tone: "#ec4899" },
  order: { icon: Bag, tone: "#22c55e" },
};

export function openPersonByName(name) {
  const person = personByName(name);
  if (person?.handle) router.push(`/person/${person.handle}`);
}

export function openNote(note) {
  const target = note.target || {};
  if (target.kind === "story") router.push(`/story/${target.id}`);
  else if (target.kind === "thought") router.push(`/thought/${target.id}`);
  else if (target.kind === "person") openPersonByName(target.name);
  else if (target.kind === "orders") router.push("/shop/orders");
  else if (target.kind === "post") openPost(target.id);
  else openPersonByName(note.name);
}

// In-app banner for a fresh notification (web NotifyBanner) plus the app toast ("Post condiviso").
// Mounted once in the root layout.
export function FeedOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const path = usePathname();
  const newest = store.notifications?.[0];
  const last = useRef(undefined);
  const [banner, setBanner] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!store.ready) return;
    if (last.current === undefined) { last.current = newest?.id || null; return; }
    if (!newest || newest.id === last.current) return;
    last.current = newest.id;
    if (!newest.read && path !== "/notifications") setBanner(newest);
  }, [newest, store.ready, path]);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 3800);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => onToast((entry) => setToast(entry)), []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const kind = banner ? NOTE_KINDS[banner.type] || NOTE_KINDS.like : null;
  const Icon = kind?.icon;
  const dark = theme.scheme === "dark";
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {banner ? (
        <Animated.View key={banner.id} entering={SlideInUp.springify().damping(16)} exiting={SlideOutUp.duration(300)} style={[styles.bannerWrap, { top: insets.top + 4 }]}>
          <Pressable onPress={() => { tap(); setBanner(null); router.push("/notifications"); }} style={styles.bannerShadow}>
            <BlurView intensity={70} tint={dark ? "systemThickMaterialDark" : "systemThickMaterialLight"} style={styles.banner}>
              <View>
                <Image source={{ uri: banner.src || avatarFor(banner.name) }} style={styles.face} />
                <View style={[styles.kind, { backgroundColor: kind.tone, borderColor: dark ? "#1c1c1e" : "#fff" }]}><Icon size={10} weight="fill" color="#fff" /></View>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T size={12} weight="600" color={theme.text2} style={{ letterSpacing: 0.5 }}>SPACE</T>
                <T size={14} lines={2} style={{ lineHeight: 18 }}><T size={14} weight="700">{banner.name}</T> {banner.text}</T>
              </View>
              <T size={12} color={theme.text2} style={{ alignSelf: "flex-start" }}>ora</T>
            </BlurView>
          </Pressable>
        </Animated.View>
      ) : null}
      {toast ? (
        <Animated.View key={toast.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 72 }]}>
          <View style={styles.toast}>
            {toast.src ? <Image source={{ uri: toast.src }} style={styles.toastImg} /> : null}
            <T size={14} weight="600" color="#fff">{toast.text}</T>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { position: "absolute", left: 8, right: 8, zIndex: 60 },
  bannerShadow: { borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 20, overflow: "hidden" },
  face: { width: 40, height: 40, borderRadius: 20 },
  kind: { position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(28,28,30,0.92)" },
  toastImg: { width: 30, height: 30, borderRadius: 6 },
});
