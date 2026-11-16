import { useMemo, useState } from "react";
import { FlatList, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { AVATAR, CONTACTS } from "../../data";
import { Check, PlusSquare, Search } from "../../ui/icons";
import { ArrowUpRightGlyph, LinkGlyph } from "../../ui/feedIcons";
import { T, tap } from "../../ui/kit";
import { SHARE_BASE, findPost, personHidden } from "../../ui/feedData";
import { useKeyboardPad } from "../../ui/comments";
import { t } from "../../lib/i18n";

// Send a post to people, add it to your story, copy its link or open the system share sheet (web ShareScreen).
export default function ShareSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { id } = useLocalSearchParams();
  const post = findPost(String(id), store.library);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const pad = useKeyboardPad(0);
  const needle = query.trim().toLowerCase();
  const people = useMemo(() => CONTACTS.filter((person) => !personHidden(store.prefs, person.name, true) && (!needle || person.name.toLowerCase().includes(needle))), [store.prefs, needle]);
  const image = post?.image || "";
  const link = `${SHARE_BASE}${post?.id || ""}`;
  const sheetBg = theme.scheme === "dark" ? "#1c1c1e" : theme.bg;

  function note(text) {
    setToast(text);
    setTimeout(() => setToast(""), 1300);
  }

  function send() {
    if (!post) return;
    tap("medium");
    const text = message.trim();
    for (const person of CONTACTS.filter((entry) => picked.includes(entry.name))) {
      const chatId = store.ensureChat(person);
      const payload = image ? { kind: "image", image, text: text || `${post.name}: ${post.text || ""}`.trim() } : { text: `${text ? `${text} · ` : ""}${post.name}: ${post.text || link}` };
      setTimeout(() => store.sendMessage(chatId, payload), 0);
    }
    note(t("Inviato"));
    setTimeout(() => router.back(), 650);
  }

  return (
    <View style={{ flex: 1, backgroundColor: sheetBg }}>
      <View style={[styles.grab, { backgroundColor: theme.text3 }]} />
      <View style={[styles.search, { backgroundColor: theme.fill }]}>
        <Search size={17} color={theme.text2} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t("Cerca")} placeholderTextColor={theme.text2} accessibilityLabel={t("Cerca persone")} style={[styles.searchInput, { color: theme.text }]} />
      </View>
      <FlatList
        data={people}
        numColumns={3}
        keyExtractor={(person) => person.name}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: INSET, paddingVertical: 10 }}
        columnWrapperStyle={{ gap: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item: person }) => {
          const on = picked.includes(person.name);
          return (
            <Pressable style={styles.cell} onPress={() => { tap(); setPicked((prev) => (on ? prev.filter((name) => name !== person.name) : [...prev, person.name])); }}>
              <View>
                <Image source={{ uri: person.src }} style={[styles.face, on && { opacity: 0.75 }]} transition={120} recyclingKey={person.src} />
                {on ? <View style={[styles.check, { borderColor: sheetBg }]}><Check size={13} weight="bold" color="#fff" /></View> : null}
              </View>
              <T size={12.5} lines={1} style={{ textAlign: "center" }}>{person.name}</T>
            </Pressable>
          );
        }}
      />
      <Animated.View style={pad}>
        {picked.length ? (
          <View style={[styles.send, { borderTopColor: theme.line, paddingBottom: insets.bottom + 10 }]}>
            <TextInput value={message} onChangeText={setMessage} placeholder={t("Scrivi un messaggio…")} placeholderTextColor={theme.text2} accessibilityLabel={t("Messaggio")} style={[styles.message, { color: theme.text }]} />
            <Pressable onPress={send} style={({ pressed }) => [styles.sendBtn, { backgroundColor: theme.blue, opacity: pressed ? 0.8 : 1 }]}>
              <T size={15} weight="600" color="#fff">{picked.length > 1 ? t("Invia separatamente ({n})", { n: picked.length }) : t("Invia")}</T>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.actions, { borderTopColor: theme.line, paddingBottom: insets.bottom + 10 }]}>
            <ShareAction icon={PlusSquare} label={t("Aggiungi alla storia")} onPress={() => {
              if (!post) return;
              store.addStory?.({ id: `st-me-${Date.now()}`, image: image || AVATAR, text: "", stickers: [{ type: "tag", name: post.name, x: 50, y: 82, s: 1, r: 0 }], time: t("ora"), at: Date.now() });
              note(t("Aggiunto alla tua storia"));
            }} />
            <ShareAction icon={LinkGlyph} label={t("Copia link")} onPress={() => { Clipboard.setStringAsync(link).catch(() => {}); note(t("Link copiato")); }} />
            <ShareAction icon={ArrowUpRightGlyph} label={t("Condividi su…")} onPress={() => post && Share.share({ title: post.name, message: `${post.name}: ${post.text || ""}\n${link}`.trim(), url: link }).catch(() => {})} />
          </View>
        )}
      </Animated.View>
      {toast ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)} pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toast}><T size={14} weight="600" color="#fff">{toast}</T></View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function ShareAction({ icon: Icon, label, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.actionIcon, { backgroundColor: theme.fill }]}><Icon size={24} color={theme.text} /></View>
      <T size={12} lines={2} style={{ textAlign: "center" }}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grab: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 10, opacity: 0.6 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 38, borderRadius: 10, marginHorizontal: INSET, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, height: 38 },
  cell: { flex: 1 / 3, alignItems: "center", gap: 6 },
  face: { width: 64, height: 64, borderRadius: 32 },
  check: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  send: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: INSET, paddingTop: 10, gap: 10 },
  message: { fontSize: 15, minHeight: 36 },
  sendBtn: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingHorizontal: 8 },
  action: { width: 92, alignItems: "center", gap: 6 },
  actionIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  toastWrap: { position: "absolute", left: 0, right: 0, top: "42%", alignItems: "center" },
  toast: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.78)" },
});
