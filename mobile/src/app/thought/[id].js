import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { createPost, usePost } from "../../lib/social";
import { useMe } from "../../lib/session";
import { errorText } from "../../lib/api";
import { Feather, ImageIcon } from "../../ui/icons-profile";
import { Btn, Header, T, tap } from "../../ui/kit";
import { IgEmpty } from "../../ui/profile-kit";
import { t } from "../../lib/i18n";
import { showToast } from "../../ui/feedEcho";
import { Face, ThoughtCard, composeThought, thoughtHidden, thoughtShape } from "../../ui/thoughts";

const LIMIT = 500;

// One thought: the thread above it, the thought, its replies, and a reply box.
export default function ThoughtScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const me = useMe();
  const { id } = useLocalSearchParams();
  const { data, loading, error, refresh } = usePost(String(id || ""));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [freshId, setFreshId] = useState(null);
  const scrollRef = useRef(null);
  const thought = data?.post;

  if (!thought) {
    const gone = error && (error.status === 404 || error.code === "not-found");
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Pensiero")} />
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.text2} />
          : gone ? <IgEmpty icon={Feather} title={t("Questo pensiero non è disponibile")} text={t("Potrebbe essere stato eliminato o l'account è privato.")} />
          : (
            <IgEmpty icon={Feather} title={t("Impossibile caricare il pensiero")} text={errorText(error, t)}>
              <Btn title={t("Riprova")} onPress={refresh} height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} />
            </IgEmpty>
          )}
      </View>
    );
  }

  const ancestors = data.ancestors || [];
  const replies = (data.replies || []).filter((item) => !thoughtHidden(store.prefs, thoughtShape(item)));
  const handle = thought.author?.handle || "";

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    tap();
    setSending(true);
    try {
      const reply = await createPost({ kind: "thought", text, parent: thought.id });
      setDraft("");
      setFreshId(reply.id);
      showToast({ text: t("Risposta pubblicata") });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      showToast({ text: errorText(err, t) });
    } finally {
      setSending(false);
    }
  }

  async function pull() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title={t("Pensiero")} />
      <ScrollView
        ref={scrollRef}
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={theme.text2} />}
      >
        {ancestors.map((item, index) => (
          <ThoughtCard key={item.id} thought={item} lineUp={index > 0} line />
        ))}
        <ThoughtCard thought={thought} big lineUp={ancestors.length > 0} onDeleted={() => router.back()} />
        <View style={styles.repliesHead}>
          <T size={15} weight="700">{t("Risposte")}</T>
          <T size={14} color={theme.text3}>{replies.length ? `${replies.length}` : ""}</T>
        </View>
        {replies.length ? replies.map((item) => (
          <View key={item.id} style={item.id === freshId ? { backgroundColor: "rgba(0,149,246,0.07)" } : null}>
            <ThoughtCard thought={item} />
          </View>
        )) : (
          <T size={14} color={theme.text2} style={{ textAlign: "center", marginVertical: 18, marginHorizontal: INSET }}>{t("Ancora nessuna risposta. Inizia tu la conversazione.")}</T>
        )}
      </ScrollView>
      <View style={[styles.reply, { backgroundColor: theme.fill, marginBottom: Math.max(10, insets.bottom) }]}>
        <Face person={me} size={32} />
        <TextInput
          value={draft}
          maxLength={LIMIT}
          onChangeText={setDraft}
          onSubmitEditing={send}
          editable={!sending}
          returnKeyType="send"
          placeholder={t("Rispondi a {handle}…", { handle })}
          placeholderTextColor={theme.text2}
          accessibilityLabel={t("Rispondi")}
          style={{ flex: 1, height: 36, color: theme.text, fontSize: 15 }}
        />
        {sending ? (
          <ActivityIndicator style={{ paddingHorizontal: 10 }} color={theme.text2} />
        ) : draft.trim() ? (
          <Pressable onPress={send} hitSlop={6} style={{ paddingHorizontal: 8 }}><T size={15} weight="700" color={theme.blue}>{t("Pubblica")}</T></Pressable>
        ) : (
          <Pressable accessibilityLabel={t("Apri editor")} onPress={() => composeThought({ reply: thought.id })} style={styles.expand}><ImageIcon size={21} color={theme.text2} /></Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  repliesHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 14, paddingBottom: 4, paddingHorizontal: INSET },
  reply: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 10, marginTop: 6, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 24 },
  expand: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
