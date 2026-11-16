import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { Camera, Hash, ImageIcon, MapPin } from "../ui/icons";
import { Avatar, Btn, T, tap } from "../ui/kit";
import ThoughtComposer from "../ui/thought-composer";
import { t } from "../lib/i18n";

const LIMIT = 500;

// Write a Pensiero. The story camera comes with the native camera module in the next step.
export default function Compose() {
  const theme = useTheme();
  const store = useStore();
  const { kind, reply, quote } = useLocalSearchParams();
  const [text, setText] = useState("");
  const left = LIMIT - text.length;
  const handle = String(store.profile.handle).replace("@", "");
  // Pensieri (kind=thought, or no kind): the full composer with threads, photos, polls, replies and quotes.
  if (kind !== "story") return <ThoughtComposer replyId={reply} quoteId={quote} />;

  function publish() {
    const value = text.trim();
    if (!value) return;
    tap("medium");
    store.addThought({ id: `me-${Date.now()}`, name: store.profile.name, handle, src: store.profile.src, verified: false, created: Date.now(), likes: 0, reposts: 0, text: value, replies: [], mine: true });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.head, { borderBottomColor: theme.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}><T size={16}>{t("Annulla")}</T></Pressable>
        <T size={16} weight="700">{kind === "story" ? t("Nuova storia") : t("Nuovo pensiero")}</T>
        <View style={{ width: 60 }} />
      </View>
      {kind === "story" ? (
        <StoryCameraRedirect />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: INSET }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Avatar src={store.profile.src} size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <T size={15} weight="700">{handle}</T>
              <TextInput autoFocus multiline value={text} onChangeText={(value) => setText(value.slice(0, LIMIT))} placeholder={t("Cosa c'è di nuovo?")} placeholderTextColor={theme.text2} style={{ color: theme.text, fontSize: 16, minHeight: 120, textAlignVertical: "top" }} />
              <View style={{ flexDirection: "row", gap: 18, marginTop: 8 }}>
                <ImageIcon size={22} color={theme.text2} />
                <Hash size={22} color={theme.text2} />
                <MapPin size={22} color={theme.text2} />
              </View>
            </View>
          </View>
        </ScrollView>
      )}
      {kind !== "story" ? (
        <View style={[styles.foot, { borderTopColor: theme.line }]}>
          <T size={13} color={left < 40 ? theme.red : theme.text2}>{left}</T>
          <Btn title={t("Pubblica")} kind="primary" disabled={!text.trim()} onPress={publish} height={36} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// kind=story: the story camera lives at /story/new (full screen, black), so hand over to it.
function StoryCameraRedirect() {
  useEffect(() => {
    router.replace("/story/new");
  }, []);
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}

const styles = StyleSheet.create({
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
