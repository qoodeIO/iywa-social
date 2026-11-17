import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { AVATAR } from "../../data";
import { Feather, ImageIcon } from "../../ui/icons-profile";
import { Header, T, tap } from "../../ui/kit";
import { IgEmpty } from "../../ui/profile-kit";
import { t } from "../../lib/i18n";
import { showToast } from "../../ui/feedEcho";
import { ThoughtCard, buildThoughts, composeThought } from "../../ui/thoughts";

const LIMIT = 500;

export default function ThoughtScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { id } = useLocalSearchParams();
  const { byId, repliesOf, me } = buildThoughts(store);
  const [draft, setDraft] = useState("");
  const [freshId, setFreshId] = useState(null);
  const scrollRef = useRef(null);
  const thought = byId.get(String(id));
  if (!thought) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Pensiero")} />
        <IgEmpty icon={Feather} title={t("Questo pensiero è stato eliminato")} />
      </View>
    );
  }
  const replies = repliesOf(thought.id);
  const chain = replies.filter((item) => item.chained);
  const others = replies.filter((item) => !item.chained);
  const canReply = thought.mine || thought.audience !== "mention" || String(thought.text || "").includes(`@${me.handle}`);
  const words = (store.prefs.hiddenWords || []).map((word) => String(word).toLowerCase());

  function send() {
    const text = draft.trim();
    if (!text || words.some((word) => word && text.toLowerCase().includes(word))) return;
    tap();
    const reply = { id: `me-r-${Date.now().toString(36)}`, created: Date.now(), likes: 0, text, mine: true, replyTo: thought.handle };
    store.addThoughtReply(thought.id, reply);
    showToast({ text: t("Risposta pubblicata") });
    setDraft("");
    setFreshId(reply.id);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title={t("Pensiero")} />
      <ScrollView ref={scrollRef} keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 24 }}>
        {thought.parentId ? (
          <Pressable onPress={() => router.push(`/thought/${thought.parentId}`)} style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
            <T size={14} weight="600" color={theme.blue}>{t("Mostra il pensiero originale")}</T>
          </Pressable>
        ) : null}
        <ThoughtCard thought={thought} big line={chain.length > 0} replyCount={others.length} onDeleted={() => router.back()} />
        {chain.map((item, index) => <ThoughtCard key={item.id} thought={item} lineUp line={index < chain.length - 1} replyCount={0} onOpen={() => {}} />)}
        <View style={styles.repliesHead}>
          <T size={15} weight="700">{t("Risposte")}</T>
          <T size={14} color={theme.text3}>{others.length ? `${others.length}` : ""}</T>
        </View>
        {others.length ? others.map((item) => (
          <View key={item.id} style={item.id === freshId ? { backgroundColor: "rgba(0,149,246,0.07)" } : null}>
            <ThoughtCard thought={item} replyCount={repliesOf(item.id).length} />
          </View>
        )) : (
          <T size={14} color={theme.text2} style={{ textAlign: "center", marginVertical: 18, marginHorizontal: INSET }}>{t("Ancora nessuna risposta. Inizia tu la conversazione.")}</T>
        )}
      </ScrollView>
      {canReply ? (
        <View style={[styles.reply, { backgroundColor: theme.fill, marginBottom: Math.max(10, insets.bottom) }]}>
          <Image source={{ uri: store.profile.src || AVATAR }} style={{ width: 32, height: 32, borderRadius: 16 }} />
          <TextInput
            value={draft}
            maxLength={LIMIT}
            onChangeText={setDraft}
            onSubmitEditing={send}
            returnKeyType="send"
            placeholder={t("Rispondi a {handle}…", { handle: thought.handle })}
            placeholderTextColor={theme.text2}
            accessibilityLabel={t("Rispondi")}
            style={{ flex: 1, height: 36, color: theme.text, fontSize: 15 }}
          />
          {draft.trim() ? (
            <Pressable onPress={send} hitSlop={6} style={{ paddingHorizontal: 8 }}><T size={15} weight="700" color={theme.blue}>{t("Pubblica")}</T></Pressable>
          ) : (
            <Pressable accessibilityLabel={t("Apri editor")} onPress={() => composeThought({ reply: thought.id })} style={styles.expand}><ImageIcon size={21} color={theme.text2} /></Pressable>
          )}
        </View>
      ) : (
        <View style={[styles.locked, { backgroundColor: theme.fill, marginBottom: Math.max(14, insets.bottom) }]}>
          <T size={13.5} color={theme.text2} style={{ textAlign: "center" }}>{t("Possono rispondere solo i profili menzionati.")}</T>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  repliesHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 14, paddingBottom: 4, paddingHorizontal: INSET },
  reply: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 10, marginTop: 6, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 24 },
  expand: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  locked: { marginHorizontal: INSET, padding: 12, borderRadius: 12 },
});
