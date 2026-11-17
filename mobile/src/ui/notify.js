import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { router, usePathname } from "expo-router";
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { useStore } from "../lib/store";
import { onLiveNote } from "../lib/social";
import { At, Bag, Comment, Heart, Repost, Sparkle, Star, User } from "./icons";
import { ReplyGlyph, UserPlusGlyph } from "./feedIcons";
import { T, tap } from "./kit";
import { onToast } from "./feedEcho";
import { Face, openPerson } from "./thoughts";
import { t } from "../lib/i18n";

export const NOTE_KINDS = {
  like: { icon: Heart, tone: "#ff3040" },
  comment_like: { icon: Heart, tone: "#ff3040" },
  story_like: { icon: Heart, tone: "#ec4899" },
  comment: { icon: Comment, tone: "#0a84ff" },
  reply: { icon: ReplyGlyph, tone: "#14b8a6" },
  mention: { icon: At, tone: "#a855f7" },
  story_mention: { icon: At, tone: "#ec4899" },
  tag: { icon: User, tone: "#ff9f0a" },
  follow: { icon: UserPlusGlyph, tone: "#0a84ff" },
  request: { icon: UserPlusGlyph, tone: "#0a84ff" },
  accepted: { icon: UserPlusGlyph, tone: "#22c55e" },
  repost: { icon: Repost, tone: "#22c55e" },
  review: { icon: Star, tone: "#ff9f0a" },
  story: { icon: Sparkle, tone: "#ec4899" },
  order: { icon: Bag, tone: "#22c55e" },
};

// Which settings toggle (prefs.notes) silences a type; types not listed always show.
const PREF_OF = {
  like: "likes", comment_like: "likes", story_like: "likes", repost: "likes",
  comment: "comments", reply: "comments", review: "comments",
  follow: "follows", request: "follows", accepted: "follows",
  mention: "mentions", story_mention: "mentions", tag: "mentions",
};

export function noteAllowed(prefs, note) {
  const key = PREF_OF[note?.type];
  return !key || prefs?.notes?.[key] !== false;
}

// Device-local notes (orders, from LiveStore → store.pushNote) in the server's shape.
export function localNote(note) {
  const handle = String(note.name || "").replace(/^@/, "");
  return {
    id: note.id,
    type: note.type || "order",
    actor: { handle, name: handle, avatar: note.src || "" },
    target: note.target || null,
    message: note.text || "",
    read: Boolean(note.read),
    createdAt: note.at || 0,
    local: true,
  };
}

function quoted(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return `“${clean.length > 90 ? `${clean.slice(0, 90)}…` : clean}”`;
}

// The sentence after the actor's name.
export function noteText(note) {
  if (note.local) return note.message;
  const kind = note.target?.kind;
  const thought = kind === "thought";
  const body = quoted(note.text);
  switch (note.type) {
    case "like": return thought ? t("ha messo mi piace al tuo pensiero.") : t("ha messo mi piace al tuo post.");
    case "comment": return body ? t("ha commentato: {text}", { text: body }) : t("ha commentato il tuo post.");
    case "reply":
      if (thought) return body ? t("ha risposto al tuo pensiero: {text}", { text: body }) : t("ha risposto al tuo pensiero.");
      return body ? t("ha risposto al tuo commento: {text}", { text: body }) : t("ha risposto al tuo commento.");
    case "mention":
      if (thought) return body ? t("ti ha menzionato in un pensiero: {text}", { text: body }) : t("ti ha menzionato in un pensiero.");
      return body ? t("ti ha menzionato: {text}", { text: body }) : t("ti ha menzionato.");
    case "tag": return t("ti ha taggato in un post.");
    case "follow": return t("ha iniziato a seguirti.");
    case "request": return t("ha chiesto di seguirti.");
    case "accepted": return t("ha accettato la tua richiesta di follow.");
    case "repost": return thought ? t("ha ripubblicato il tuo pensiero.") : t("ha ripubblicato il tuo post.");
    case "story_like": return t("ha messo mi piace alla tua storia.");
    case "story_mention": return t("ti ha menzionato nella sua storia.");
    case "comment_like": return body ? t("ha messo mi piace al tuo commento: {text}", { text: body }) : t("ha messo mi piace al tuo commento.");
    case "review": return body ? t("ha recensito un tuo prodotto: {text}", { text: body }) : t("ha recensito un tuo prodotto.");
    default: return note.text || "";
  }
}

// Where tapping a note goes.
export function openNote(note) {
  const target = note.target || {};
  const type = note.type;
  if (target.kind === "orders") router.push("/shop/orders");
  else if (target.kind === "thought" && target.id) router.push(`/thought/${target.id}`);
  else if (target.kind === "story") router.push(`/story/${encodeURIComponent(target.author || note.actor?.handle || "")}`);
  else if (target.kind === "product" && target.owner && target.id) router.push(`/product/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.id)}`);
  else if (target.kind === "post" && target.id) {
    if (type === "comment" || type === "reply" || type === "comment_like") router.push(`/comments/${target.id}`);
    else router.push(`/post/${target.id}`);
  } else if (note.actor?.handle) openPerson(note.actor.handle);
}

// In-app banner for a fresh notification (web NotifyBanner) plus the app toast ("Post condiviso").
// Mounted once in the root layout.
export function FeedOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const path = usePathname();
  const [banner, setBanner] = useState(null);
  const [toast, setToast] = useState(null);
  const pathRef = useRef(path);
  const prefsRef = useRef(store.prefs);
  pathRef.current = path;
  prefsRef.current = store.prefs;

  function show(note) {
    if (!note || note.read || pathRef.current === "/notifications") return;
    if (!noteAllowed(prefsRef.current, note)) return;
    setBanner(note);
  }

  // Live notes from the server.
  useEffect(() => onLiveNote((note) => show(note)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Device-local notes (orders) pushed into the store.
  const newest = store.notifications?.[0];
  const last = useRef(undefined);
  useEffect(() => {
    if (!store.ready) return;
    if (last.current === undefined) { last.current = newest?.id || null; return; }
    if (!newest || newest.id === last.current) return;
    last.current = newest.id;
    show(localNote(newest));
  }, [newest, store.ready]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const actor = banner?.actor || {};
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {banner ? (
        <Animated.View key={banner.id} entering={SlideInUp.springify().damping(16)} exiting={SlideOutUp.duration(300)} style={[styles.bannerWrap, { top: insets.top + 4 }]}>
          <Pressable onPress={() => { tap(); const note = banner; setBanner(null); if (note.type === "request") router.push("/people/requests"); else openNote(note); }} style={styles.bannerShadow}>
            <BlurView intensity={70} tint={dark ? "systemThickMaterialDark" : "systemThickMaterialLight"} style={styles.banner}>
              <View>
                <Face person={actor} size={40} />
                <View style={[styles.kind, { backgroundColor: kind.tone, borderColor: dark ? "#1c1c1e" : "#fff" }]}><Icon size={10} weight="fill" color="#fff" /></View>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T size={12} weight="600" color={theme.text2} style={{ letterSpacing: 0.5 }}>IYWA</T>
                <T size={14} lines={2} style={{ lineHeight: 18 }}><T size={14} weight="700">{actor.handle || actor.name}</T> {noteText(banner)}</T>
              </View>
              <T size={12} color={theme.text2} style={{ alignSelf: "flex-start" }}>{t("ora")}</T>
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
  kind: { position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(28,28,30,0.92)" },
  toastImg: { width: 30, height: 30, borderRadius: 6 },
});
