import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { INSET, useTheme } from "../theme";
import { updateMe, useMe } from "../lib/session";
import { api, errorText, uploadMedia } from "../lib/api";
import { invalidate } from "../lib/social";
import { Camera, Check, Checked, ImageIcon, LinkIcon, Trash, User, Warn, X } from "../ui/icons-profile";
import { T, tap } from "../ui/kit";
import { ActionSheet, settingsColors } from "../ui/profile-kit";
import { t } from "../lib/i18n";

// Same rule as the server: 3–30 lowercase letters, numbers, dots and underscores, no dot at the ends.
const validHandle = (value) => /^[a-z0-9._]{3,30}$/.test(value) && !/^[.]|[.]$|\.\./.test(value);

// "Modifica profilo": name, username, bio, website and photo, saved on the server.
export default function EditProfile() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const st = settingsColors(theme);
  const [original] = useState(() => ({
    name: me?.name || "",
    handle: me?.handle || "",
    bio: me?.bio || "",
    website: me?.website || "",
    avatar: me?.avatar || "",
  }));
  const [form, setForm] = useState(original);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taken, setTaken] = useState(false);
  const set = (key) => (value) => { setError(""); setForm((prev) => ({ ...prev, [key]: value })); };
  const handle = form.handle.trim().toLowerCase().replace(/^@/, "");
  const handleChanged = handle !== original.handle;
  const handleOk = validHandle(handle);
  const valid = Boolean(form.name.trim()) && handleOk && !(handleChanged && taken);
  const dirty = Object.keys(original).some((key) => original[key] !== form[key]);
  const linkShown = form.website.trim().replace(/^https?:\/\//, "");

  // Ask the server whether a new username is free while it is typed.
  useEffect(() => {
    setTaken(false);
    if (!handleChanged || !handleOk) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      api("/auth/available", { query: { handle } }).then((data) => { if (live) setTaken(data?.handle === false); }).catch(() => {});
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [handle, handleChanged, handleOk]);

  async function save() {
    if (!valid || busy) return;
    tap("medium");
    setBusy(true);
    setError("");
    try {
      const patch = {};
      if (form.name.trim() !== original.name) patch.name = form.name.trim();
      if (handleChanged) patch.handle = handle;
      if (form.bio.trim() !== original.bio) patch.bio = form.bio.trim();
      if (form.website.trim() !== original.website) patch.website = form.website.trim();
      if (form.avatar !== original.avatar) patch.avatar = form.avatar ? await uploadMedia(form.avatar) : "";
      if (Object.keys(patch).length) {
        const next = await updateMe(patch);
        invalidate(`user:${original.handle}`);
        if (next?.handle) invalidate(`user:${next.handle}`);
      }
      router.back();
    } catch (err) {
      if (err?.code === "handle-taken") setTaken(true);
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto() {
    setSheet(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,  mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.86 });
      if (!result.canceled && result.assets?.[0]?.uri) setForm((prev) => ({ ...prev, avatar: result.assets[0].uri }));
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

  const handleNote = !handleOk
    ? t("Nome utente non valido: 3–30 caratteri, lettere, numeri, punti e trattini bassi.")
    : handleChanged && taken ? t("Questo nome utente è già in uso.") : "";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: st.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.head, { paddingTop: insets.top, backgroundColor: st.bg }]}>
        <View style={styles.headRow}>
          <Pressable hitSlop={8} disabled={busy} onPress={() => (dirty ? setSheet("discard") : router.back())} style={{ width: 80 }}><T size={15.5}>{t("Annulla")}</T></Pressable>
          <T size={17} weight="700" style={{ flex: 1, textAlign: "center" }}>{t("Modifica profilo")}</T>
          <Pressable hitSlop={8} disabled={!valid || !dirty || busy} onPress={save} style={{ width: 80, alignItems: "flex-end" }}>
            {busy ? <ActivityIndicator color={theme.blue} /> : <T size={15.5} weight="700" color={theme.blue} style={{ opacity: !valid || !dirty ? 0.35 : 1 }}>{t("Fine")}</T>}
          </Pressable>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}>
        <View style={{ alignItems: "center", gap: 10, paddingTop: 10, paddingBottom: 4 }}>
          <Pressable accessibilityLabel={t("Cambia foto")} onPress={() => setSheet("photo")} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
            {form.avatar ? <Image source={{ uri: form.avatar }} style={styles.face} contentFit="cover" transition={150} /> : (
              <View style={[styles.face, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }]}><User size={48} color={theme.text3} weight="fill" /></View>
            )}
            <View style={[styles.cam, { backgroundColor: theme.blue, borderColor: st.bg }]}><Camera size={16} weight="fill" color="#fff" /></View>
          </Pressable>
          <Pressable onPress={() => setSheet("photo")}><T size={15} weight="600" color={theme.blue}>{form.avatar ? t("Modifica immagine") : t("Aggiungi una foto")}</T></Pressable>
        </View>

        {error ? (
          <View style={[styles.note, { marginTop: 14 }]}>
            <Warn size={15} weight="fill" color="#ff453a" />
            <T size={13} color="#ff453a" style={{ flex: 1 }}>{error}</T>
          </View>
        ) : null}

        <Cap>{t("Anteprima")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card, paddingVertical: 14, paddingHorizontal: 16, gap: 3 }]}>
          <T size={15} weight="700">{form.name.trim() || t("Il tuo nome")}</T>
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
          {field("name", t("Nome"), { max: 60, first: true })}
          {field("handle", t("Nome utente"), { max: 30, prefix: "@", lower: true, state: handleChanged ? (handleOk && !taken ? "ok" : "err") : "" })}
        </View>
        {handleNote ? (
          <View style={styles.note}>
            <Warn size={15} weight="fill" color="#ff453a" />
            <T size={12.5} color="#ff453a" style={{ flex: 1 }}>{handleNote}</T>
          </View>
        ) : handleChanged ? (
          <View style={styles.note}><T size={12.5} color={theme.text2} style={{ flex: 1 }}>{t("Il link al tuo profilo diventerà iywa.app/{handle}", { handle })}</T></View>
        ) : null}

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
              value={form.website}
              maxLength={200}
              placeholder={t("Il tuo sito")}
              placeholderTextColor={theme.text3}
              onChangeText={set("website")}
              accessibilityLabel={t("Link")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{ flex: 1, height: 48, color: theme.text, fontSize: 15.5 }}
            />
            {form.website ? (
              <Pressable accessibilityLabel={t("Cancella")} hitSlop={8} onPress={() => set("website")("")} style={[styles.clear, { backgroundColor: theme.text3 }]}>
                <X size={10} weight="bold" color={st.card} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.note}><T size={12.5} color={theme.text2} style={{ flex: 1, lineHeight: 17 }}>{t("Nome, nome utente, foto, bio e link sono visibili a tutti su iywa.")}</T></View>
      </ScrollView>
      <ActionSheet
        open={sheet === "photo"}
        onClose={() => setSheet(null)}
        items={[
          { icon: ImageIcon, label: t("Scegli dalla libreria"), onPress: pickPhoto },
          form.avatar ? { icon: Trash, label: t("Rimuovi foto attuale"), danger: true, onPress: () => { set("avatar")(""); setSheet(null); } } : null,
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
  count: { position: "absolute", right: 14, bottom: 8, fontVariant: ["tabular-nums"] },
  linkIco: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  clear: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});
