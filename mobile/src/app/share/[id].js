import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../../theme";
import { Check, PlusSquare, Search } from "../../ui/icons";
import { ArrowUpRightGlyph, LinkGlyph } from "../../ui/feedIcons";
import { T, tap } from "../../ui/kit";
import { SHARE_BASE, findPost } from "../../ui/feedData";
import { useKeyboardPad } from "../../ui/comments";
import { useLive } from "../../live/LiveStore";
import { useThreads } from "../../live/threads";
import { usePeople } from "../../live/people";
import { Face, GroupAvatar } from "../../ui/chat";
import { createStory, postCard, usePost } from "../../lib/social";
import { t } from "../../lib/i18n";

// Send a post to people, add it to your story, copy its link or open the system share sheet (web ShareScreen).
export default function ShareSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const fetched = usePost(findPost(String(id)) ? null : String(id));
  const post = findPost(String(id)) || postCard(fetched.data?.post);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const pad = useKeyboardPad(0);
  const needle = query.trim().toLowerCase();
  const live = useLive();
  const threads = useThreads();
  const found = usePeople(query);
  // Recent conversations first, then the people I follow (or the search results), each once.
  const people = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const thread of threads) {
      if (needle && !thread.name.toLowerCase().includes(needle) && !thread.other?.handle?.includes(needle)) continue;
      if (thread.other?.handle) seen.add(thread.other.handle);
      out.push({ key: `c:${thread.id}`, name: thread.name, src: thread.src, convId: thread.id, group: thread.group ? thread : null });
    }
    for (const person of found.searching ? found.results : found.following) {
      if (seen.has(person.handle)) continue;
      seen.add(person.handle);
      out.push({ key: `p:${person.handle}`, name: person.name, src: person.src, handle: person.handle });
    }
    return out;
  }, [threads, found.searching, found.results, found.following, needle]);
  const image = post?.image || "";
  const link = `${SHARE_BASE}${post?.id || ""}`;
  const sheetBg = theme.scheme === "dark" ? "#1c1c1e" : theme.bg;

  function note(text) {
    setToast(text);
    setTimeout(() => setToast(""), 1300);
  }

  // The post goes as its link (the chat shows it as a card); a note, if any, goes first.
  function send() {
    if (!post || busy) return;
    if (live?.status !== "open") {
      note(t("Connessione…"));
      return;
    }
    tap("medium");
    setBusy(true);
    const text = message.trim();
    const chosen = people.filter((person) => picked.includes(person.key));
    Promise.all(chosen.map(async (person) => {
      const convId = person.convId || await live.openDm(person.handle);
      live.send(convId, text ? `${text}\n${link}` : link);
    })).then(() => {
      note(t("Inviato"));
      setTimeout(() => router.back(), 650);
    }).catch(() => {
      setBusy(false);
      note(t("Invio non riuscito"));
    });
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
        ListEmptyComponent={found.loading ? <ActivityIndicator style={{ marginTop: 32 }} color={theme.text2} /> : (
          <T size={14} color={theme.text2} style={{ textAlign: "center", marginTop: 32 }}>{needle ? t("Nessun account trovato.") : t("Segui qualcuno o cercalo per inviargli il post.")}</T>
        )}
        onEndReached={found.more}
        onEndReachedThreshold={0.5}
        numColumns={3}
        keyExtractor={(person) => person.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: INSET, paddingVertical: 10 }}
        columnWrapperStyle={{ gap: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item: person }) => {
          const on = picked.includes(person.key);
          return (
            <Pressable style={styles.cell} onPress={() => { tap(); setPicked((prev) => (on ? prev.filter((key) => key !== person.key) : [...prev, person.key])); }}>
              <View>
                <View style={on && { opacity: 0.75 }}>{person.group ? <GroupAvatar photo={person.group.photo} title={person.name} size={64} /> : <Face src={person.src} name={person.name} size={64} />}</View>
                {on ? <View style={[styles.check, { borderColor: sheetBg, backgroundColor: theme.blue }]}><Check size={13} weight="bold" color={theme.accentInk || "#fff"} /></View> : null}
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
            <Pressable disabled={busy} onPress={send} style={({ pressed }) => [styles.sendBtn, { backgroundColor: theme.blue, opacity: pressed || busy ? 0.7 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <T size={15} weight="600" color="#fff">{picked.length > 1 ? t("Invia separatamente ({n})", { n: picked.length }) : t("Invia")}</T>}
            </Pressable>
          </View>
        ) : (
          <View style={[styles.actions, { borderTopColor: theme.line, paddingBottom: insets.bottom + 10 }]}>
            <ShareAction icon={PlusSquare} label={t("Aggiungi alla storia")} onPress={() => {
              if (!post) return;
              if (!image) {
                note(t("Solo i post con una foto vanno nella storia"));
                return;
              }
              createStory({ uri: image, stickers: [{ type: "tag", name: post.name, x: 50, y: 82, s: 1, r: 0 }] })
                .then(() => note(t("Aggiunto alla tua storia")))
                .catch(() => note(t("Impossibile aggiungere alla storia")));
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
