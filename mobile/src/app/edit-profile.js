import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR } from "../data";
import { Camera, Check, Checked, ImageIcon, LinkIcon, Trash, Warn, X } from "../ui/icons-profile";
import { T, tap } from "../ui/kit";
import { ActionSheet, settingsColors } from "../ui/profile-kit";
import { keepMedia } from "../lib/media-store";
import { t, tk } from "../lib/i18n";

const CATEGORIES = [tk("Ceramista"), tk("Cuoca"), tk("Liutaio"), tk("Sarta"), tk("Designer"), tk("Artista"), tk("Fotografo")];
const PRONOUNS = [tk("lei/la"), tk("lui/lo"), tk("loro")];

// "Modifica profilo", the same flow as the web EditScreen.
export default function EditProfile() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const profile = store.profile;
  const st = settingsColors(theme);
  const original = {
    name: profile.name || "",
    handle: String(profile.handle || "").replace(/^@/, ""),
    pronouns: profile.pronouns || "",
    bio: profile.bio || "",
    link: profile.link || "",
    category: profile.category || "",
    avatar: profile.src && profile.src !== AVATAR ? profile.src : "",
  };
  const [form, setForm] = useState(original);
  const [sheet, setSheet] = useState(null);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const handleOk = /^[a-z0-9._]{2,30}$/i.test(form.handle.trim());
  const valid = Boolean(form.name.trim()) && handleOk;
  const dirty = Object.keys(original).some((key) => original[key] !== form[key]);
  const linkShown = form.link.trim().replace(/^https?:\/\//, "");

  function save() {
    if (!valid) return;
    tap("medium");
    store.setProfile({
      name: form.name.trim(),
      handle: `@${form.handle.trim().toLowerCase()}`,
      pronouns: form.pronouns.trim(),
      bio: form.bio.trim(),
      link: form.link.trim(),
      category: form.category.trim(),
      src: form.avatar || AVATAR,
    });
    router.back();
  }

  async function pickPhoto() {
    setSheet(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.86 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const avatar = await keepMedia(result.assets[0].uri, "avatar");
        setForm((prev) => ({ ...prev, avatar }));
      }
    } catch {
      // picker unavailable
    }
  }

  const field = (key, label, options = {}) => (
    <View key={key} style={styles.row}>
      {options.first ? null : <View style={[styles.sep, { backgroundColor: theme.line }]} />}
      <T size={15.5} style={{ width: 104 }}>{label}</T>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2 }}>
        {options.prefix ? <T size={15.5} color={theme.text2}>{options.prefix}</T> : null}
        <TextInput
          value={form[key]}
          maxLength={options.max}
          placeholder={options.placeholder || label}
          placeholderTextColor={theme.text3}
          onChangeText={set(key)}
          accessibilityLabel={label}
          autoCapitalize={options.lower ? "none" : "sentences"}
          autoCorrect={!options.lower}
          style={{ flex: 1, height: 48, color: theme.text, fontSize: 15.5 }}
        />
        {options.state ? (options.state === "ok" ? <Checked size={18} weight="fill" color="#30d158" /> : <Warn size={18} weight="fill" color="#ff453a" />) : null}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: st.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.head, { paddingTop: insets.top, backgroundColor: st.bg }]}>
        <View style={styles.headRow}>
          <Pressable hitSlop={8} onPress={() => (dirty ? setSheet("discard") : router.back())} style={{ width: 80 }}><T size={15.5}>{t("Annulla")}</T></Pressable>
          <T size={17} weight="700" style={{ flex: 1, textAlign: "center" }}>{t("Modifica profilo")}</T>
          <Pressable hitSlop={8} disabled={!valid || !dirty} onPress={save} style={{ width: 80, alignItems: "flex-end" }}>
            <T size={15.5} weight="700" color={theme.blue} style={{ opacity: !valid || !dirty ? 0.35 : 1 }}>{t("Fine")}</T>
          </Pressable>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}>
        <View style={{ alignItems: "center", gap: 10, paddingTop: 10, paddingBottom: 4 }}>
          <Pressable accessibilityLabel={t("Cambia foto")} onPress={() => setSheet("photo")} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            <Image source={{ uri: form.avatar || AVATAR }} style={styles.face} contentFit="cover" transition={150} />
            <View style={[styles.cam, { backgroundColor: theme.blue, borderColor: st.bg }]}><Camera size={16} weight="fill" color="#fff" /></View>
          </Pressable>
          <Pressable onPress={() => setSheet("photo")}><T size={15} weight="600" color={theme.blue}>{t("Modifica immagine")}</T></Pressable>
        </View>

        <Cap>{t("Anteprima")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card, paddingVertical: 14, paddingHorizontal: 16, gap: 3 }]}>
          <T size={15} weight="700">{form.name.trim() || t("Il tuo nome")}{form.pronouns.trim() ? <T size={13} color={theme.text2}> {form.pronouns.trim()}</T> : null}</T>
          {form.category.trim() ? <T size={14} color={theme.text2}>{form.category.trim()}</T> : null}
          {form.bio.trim() ? <T size={14} style={{ marginTop: 2, lineHeight: 20 }}>{form.bio.trim()}</T> : <T size={14} color={theme.text3} style={{ marginTop: 2, fontStyle: "italic" }}>{t("Qui comparirà la tua bio.")}</T>}
          {linkShown ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <LinkIcon size={14} weight="bold" color={theme.blue} />
              <T size={14} weight="600" color={theme.blue}>{linkShown}</T>
            </View>
          ) : null}
        </View>

        <Cap>{t("Profilo pubblico")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          {field("name", t("Nome"), { max: 30, first: true })}
          {field("handle", t("Nome utente"), { max: 30, prefix: "@", lower: true, state: form.handle.trim() !== original.handle ? (handleOk ? "ok" : "err") : "" })}
          {field("pronouns", t("Pronomi"), { max: 12, placeholder: t(PRONOUNS[0]) })}
          {field("category", t("Categoria"), { max: 30, placeholder: t(CATEGORIES[0]) })}
        </View>
        {!handleOk ? (
          <View style={styles.note}>
            <Warn size={15} weight="fill" color="#ff453a" />
            <T size={12.5} color="#ff453a" style={{ flex: 1 }}>{t("Nome utente: 2–30 lettere, numeri, punti o trattini bassi.")}</T>
          </View>
        ) : null}
        <Chips items={CATEGORIES.map((item) => t(item))} value={form.category} st={st} onPick={(item) => setForm((prev) => ({ ...prev, category: prev.category === item ? "" : item }))} />
        <Chips items={PRONOUNS.map((item) => t(item))} value={form.pronouns} st={st} small onPick={(item) => setForm((prev) => ({ ...prev, pronouns: prev.pronouns === item ? "" : item }))} />

        <Cap>{t("Bio")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 26 }]}>
          <TextInput
            value={form.bio}
            maxLength={150}
            multiline
            onChangeText={set("bio")}
            placeholder={t("Racconta il tuo lavoro…")}
            placeholderTextColor={theme.text3}
            accessibilityLabel={t("Bio")}
            style={{ minHeight: 88, color: theme.text, fontSize: 15.5, lineHeight: 22, textAlignVertical: "top", padding: 0 }}
          />
          <T size={12.5} color={form.bio.length > 135 ? "#ff9f0a" : theme.text3} style={styles.count}>{150 - form.bio.length}</T>
        </View>

        <Cap>{t("Link")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          <View style={styles.row}>
            <View style={[styles.linkIco, { backgroundColor: "#0a84ff" }]}><LinkIcon size={16} weight="bold" color="#fff" /></View>
            <TextInput
              value={form.link}
              maxLength={120}
              placeholder={t("iywa.app/tuo-nome")}
              placeholderTextColor={theme.text3}
              onChangeText={set("link")}
              accessibilityLabel={t("Link")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{ flex: 1, height: 48, color: theme.text, fontSize: 15.5 }}
            />
            {form.link ? (
              <Pressable accessibilityLabel={t("Cancella")} hitSlop={8} onPress={() => setForm((prev) => ({ ...prev, link: "" }))} style={[styles.clear, { backgroundColor: theme.text3 }]}>
                <X size={10} weight="bold" color={st.card} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.note}><T size={12.5} color={theme.text2} style={{ flex: 1, lineHeight: 17 }}>{t("Nome, nome utente, bio e link sono visibili a tutti su iywa.")}</T></View>
      </ScrollView>
      <ActionSheet
        open={sheet === "photo"}
        onClose={() => setSheet(null)}
        items={[
          { icon: ImageIcon, label: t("Scegli dalla libreria"), onPress: pickPhoto },
          form.avatar ? { icon: Trash, label: t("Rimuovi foto attuale"), danger: true, onPress: () => { setForm((prev) => ({ ...prev, avatar: "" })); setSheet(null); } } : null,
        ]}
      />
      <ActionSheet
        open={sheet === "discard"}
        onClose={() => setSheet(null)}
        hint={t("Scartare le modifiche al profilo?")}
        items={[
          { icon: Trash, label: t("Scarta modifiche"), danger: true, onPress: () => { setSheet(null); router.back(); } },
          { icon: Check, label: t("Salva"), disabled: !valid, onPress: () => { setSheet(null); save(); } },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

function Cap({ children }) {
  const theme = useTheme();
  return <T size={12.5} weight="500" color={theme.text2} style={styles.cap}>{String(children).toUpperCase()}</T>;
}

function Chips({ items, value, onPick, st, small }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingTop: small ? 6 : 10, paddingHorizontal: INSET }}>
      {items.map((item) => {
        const on = value === item;
        return (
          <Pressable key={item} onPress={() => { tap(); onPick(item); }} style={({ pressed }) => [styles.chip, { backgroundColor: on ? theme.blue : st.card, borderColor: on ? theme.blue : theme.line, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <T size={13.5} weight="500" color={on ? "#fff" : theme.text}>{item}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: {},
  headRow: { height: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: INSET },
  face: { width: 100, height: 100, borderRadius: 50 },
  cam: { position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  cap: { marginTop: 22, marginBottom: 7, marginHorizontal: 30, letterSpacing: 0.4 },
  card: { marginHorizontal: INSET, borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 14 },
  sep: { position: "absolute", top: 0, right: 0, left: 14, height: StyleSheet.hairlineWidth },
  note: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginHorizontal: 30 },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 99, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  count: { position: "absolute", right: 14, bottom: 8, fontVariant: ["tabular-nums"] },
  linkIco: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  clear: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});
