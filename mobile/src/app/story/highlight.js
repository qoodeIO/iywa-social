import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { Camera } from "../../ui/icons";
import { Empty, Header, T, tap } from "../../ui/kit";
import { StoryMedia } from "../../ui/story";
import { frameCover } from "../../lib/stories";
import { t } from "../../lib/i18n";

// New highlight: pick your stories, then name it and choose the cover (web HighlightNew).
export default function HighlightNew() {
  const theme = useTheme();
  const store = useStore();
  const { width } = useWindowDimensions();
  const stories = (store.myStories || []).slice().reverse();
  const [picked, setPicked] = useState([]);
  const [step, setStep] = useState("pick");
  const [name, setName] = useState(t("In evidenza"));
  const [cover, setCover] = useState(null);
  const chosen = stories.filter((item) => picked.includes(item.id));
  const coverItem = stories.find((item) => item.id === (cover || picked[0]));
  const tile = (width - 2) / 3;
  const disabled = !picked.length || (step === "name" && !name.trim());

  function next() {
    if (disabled) return;
    tap();
    if (step === "pick") {
      setStep("name");
      return;
    }
    const cov = coverItem || chosen[0];
    store.addHighlight({
      id: `hl-${Date.now()}`,
      name: name.trim().slice(0, 16),
      full: store.profile.name,
      src: frameCover(cov) || frameCover(chosen.find((item) => frameCover(item))) || store.profile.src,
      mine: true,
      frames: chosen.map((item) => ({
        id: `${item.id}-hl`,
        image: item.image || "",
        video: item.video || "",
        cells: item.cells,
        layout: item.layout,
        gradient: item.gradient,
        muted: item.muted,
        filter: item.filter,
        stickers: item.stickers || [],
        text: item.text || "",
        time: item.time || "",
      })),
    });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header
        title={step === "pick" ? t("Seleziona storie") : t("Nome")}
        onBack={step === "name" ? () => setStep("pick") : undefined}
        right={(
          <Pressable hitSlop={8} disabled={disabled} onPress={next} style={{ paddingHorizontal: 8 }}>
            <T size={16} weight="700" color={theme.blue} style={{ opacity: disabled ? 0.4 : 1 }}>{step === "pick" ? t("Avanti") : t("Fine")}</T>
          </Pressable>
        )}
      />
      {step === "pick" ? (
        stories.length ? (
          <FlatList
            data={stories}
            numColumns={3}
            keyExtractor={(item) => item.id}
            columnWrapperStyle={{ gap: 1 }}
            contentContainerStyle={{ gap: 1, paddingBottom: 40 }}
            initialNumToRender={12}
            windowSize={7}
            renderItem={({ item }) => {
              const n = picked.indexOf(item.id);
              return (
                <Pressable
                  onPress={() => { tap(); setPicked((prev) => (n >= 0 ? prev.filter((id) => id !== item.id) : [...prev, item.id])); }}
                  style={{ width: tile, height: tile * 1.6, backgroundColor: theme.fill, overflow: "hidden" }}
                >
                  <StoryMedia frame={item} />
                  {n >= 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.25)" }]} /> : null}
                  <View style={[styles.check, n >= 0 ? { backgroundColor: theme.blue, borderColor: theme.blue } : null]}>
                    {n >= 0 ? <T size={12} weight="700" color="#fff">{n + 1}</T> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : (
          <Empty icon={Camera} title={t("Nessuna storia ancora")} text={t("Pubblica una storia e potrai metterla in evidenza.")} />
        )
      ) : (
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingTop: 28, paddingHorizontal: INSET, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.bigRing, { borderColor: theme.line }]}>
            <View style={{ flex: 1, borderRadius: 60, overflow: "hidden", backgroundColor: theme.fill }}>
              {coverItem ? <StoryMedia frame={coverItem} /> : null}
            </View>
          </View>
          <TextInput
            value={name}
            maxLength={16}
            autoFocus
            onChangeText={setName}
            accessibilityLabel={t("Nome highlight")}
            selectionColor={theme.blue}
            style={{ minWidth: 200, textAlign: "center", fontSize: 18, fontWeight: "600", color: theme.text, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }}
          />
          <T size={13} color={theme.text2}>{t("Scegli la copertina")}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}>
            {chosen.map((item) => {
              const on = (cover || picked[0]) === item.id;
              return (
                <Pressable key={item.id} onPress={() => { tap(); setCover(item.id); }} style={[styles.cover, { borderColor: on ? theme.text : "transparent" }]}>
                  <View style={{ flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: theme.fill }}>
                    <StoryMedia frame={item} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  check: { position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  bigRing: { width: 128, height: 128, borderRadius: 64, padding: 4, borderWidth: 1.5 },
  cover: { width: 64, height: 100, borderRadius: 10, padding: 2, borderWidth: 2 },
});
