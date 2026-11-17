import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { useLive } from "../../live/LiveStore";
import { fileToDataUrl } from "../../live/media";
import { usePeople } from "../../live/people";
import { Face, GroupAvatar, Hint, Spinner, SubHead, useChatTheme, useFlash } from "../../ui/chat";
import { CheckRow, ToneRow } from "../../ui/chatPick";
import { ArrowRight, Camera, Check, Close, ImageIcon, Plus } from "../../ui/chatIcons";
import { T, tap } from "../../ui/kit";
import { INSET } from "../../theme";

export default function NewGroup() {
  const theme = useChatTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const live = useLive();
  const [step, setStep] = useState("members");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Map());
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoPick, setPhotoPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, flash] = useFlash();
  const people = usePeople(query);
  const online = live?.status === "open";
  const chips = [...picked.values()].map((person) => ({ key: person.handle, label: person.name.split(" ")[0], name: person.name, src: person.src, meta: person.meta }));
  const enough = chips.length >= 1;
  const ready = name.trim().length > 0 && enough && !busy && online;
  const list = people.searching ? people.results : [...people.following, ...people.suggested];

  function toggle(person) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(person.handle)) next.delete(person.handle);
      else next.set(person.handle, person);
      return next;
    });
  }

  async function uploadPhoto() {
    tap();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,  mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.25 });
      if (result.canceled || !result.assets?.[0]) return;
      // The hub keeps a group photo as a small data URL (160 kB at most).
      const url = await fileToDataUrl(result.assets[0].uri, "image/jpeg");
      if (!url || url.length > 160_000) {
        flash(t("Foto troppo grande, scegline una più piccola."), 2200);
        return;
      }
      setPhoto(url);
      setPhotoPick(false);
    } catch {
      flash(t("Impossibile aprire la foto."));
    }
  }

  function create() {
    const title = name.trim();
    if (!title || !chips.length || busy) return;
    tap();
    setBusy(true);
    live.createGroup(title, chips.map((chip) => chip.key), { about: about.trim(), photo })
      .then((id) => router.replace(`/chat/${id}`))
      .catch(() => flash(t("Impossibile creare il gruppo. Riprova."), 2200))
      .finally(() => setBusy(false));
  }

  const fab = (on, icon, onPress, label) => (
    <Pressable accessibilityLabel={label} disabled={!on} onPress={onPress} style={[styles.fab, { bottom: 22 + insets.bottom, backgroundColor: on ? theme.blue : theme.fill, opacity: on ? 1 : 0.7, transform: [{ scale: on ? 1 : 0.85 }] }]}>
      {icon}
    </Pressable>
  );

  if (step === "members") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SubHead title={t("Nuovo gruppo")} meta={picked.size ? t("{n} di 199 selezionati", { n: picked.size }) : t("Aggiungi membri")} />
        <View style={[styles.chips, { borderBottomColor: theme.line }]}>
          {chips.map((chip) => (
            <Animated.View key={chip.key} entering={ZoomIn.springify().damping(14)}>
              <Pressable accessibilityLabel={t("Rimuovi {name}", { name: chip.name })} onPress={() => { tap(); toggle({ handle: chip.key }); }} style={[styles.chip, { backgroundColor: theme.dark ? "#0a2236" : "#e3f2fe" }]}>
                <Face src={chip.src} name={chip.name} size={32} />
                <T size={14} weight="600">{chip.label}</T>
                <Close size={12} weight="bold" color={theme.text2} />
              </Pressable>
            </Animated.View>
          ))}
          <TextInput
            value={query}
            onChangeText={setQuery}
            onKeyPress={(event) => { if (event.nativeEvent.key === "Backspace" && !query && chips.length) toggle({ handle: chips[chips.length - 1].key }); }}
            placeholder={chips.length ? "" : t("Chi vuoi aggiungere?")}
            placeholderTextColor={theme.text3}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t("Cerca persone per il gruppo")}
            style={{ flexGrow: 1, minWidth: 120, height: 32, color: theme.text, fontSize: 15 }}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 110 }}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            if (layoutMeasurement.height + contentOffset.y > contentSize.height - 300) people.more();
          }}
          scrollEventThrottle={200}
        >
          {!online ? <Hint>{t("Connessione…")}</Hint> : null}
          {!people.searching && people.following.length ? <T size={13} weight="700" color={theme.text2} style={styles.letter}>{t("Persone che segui")}</T> : null}
          {list.map((person, index) => (
            <View key={person.handle}>
              {!people.searching && index === people.following.length && people.suggested.length ? <T size={13} weight="700" color={theme.text2} style={styles.letter}>{t("Suggeriti")}</T> : null}
              <CheckRow on={picked.has(person.handle)} src={person.src} name={person.name} online={person.online} meta={person.meta} metaBlue={person.online} onPress={() => toggle(person)} />
            </View>
          ))}
          {people.loading || people.moreLoading ? <ActivityIndicator style={{ marginVertical: 24 }} color={theme.text2} /> : null}
          {!people.loading && !list.length ? (
            <Hint center>{people.searching ? t("Nessun account trovato.") : t("Cerca le persone da aggiungere per nome o nome utente.")}</Hint>
          ) : null}
        </ScrollView>
        {hint ? <Hint style={[styles.floatHint, { bottom: 90 + insets.bottom, backgroundColor: theme.bg }]}>{hint}</Hint> : null}
        {fab(enough, <ArrowRight size={24} weight="bold" color={enough ? "#fff" : theme.text3} />, () => { tap(); setStep("details"); setQuery(""); }, t("Avanti"))}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SubHead title={t("Nuovo gruppo")} meta={t("{n} membri", { n: chips.length + 1 })} onBack={() => setStep("members")} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.details}>
          <Pressable accessibilityLabel={t("Foto del gruppo")} onPress={() => { tap(); setPhotoPick((value) => !value); }} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            {photo ? <GroupAvatar photo={photo} title={name || "?"} size={70} /> : (
              <View style={[styles.photoEmpty, { backgroundColor: theme.dark ? "#0a2236" : "#e3f2fe" }]}><Camera size={28} weight="fill" color={theme.blue} /></View>
            )}
            <View style={[styles.photoPlus, { backgroundColor: theme.blue, borderColor: theme.bg }]}><Plus size={12} weight="bold" color="#fff" /></View>
          </Pressable>
          <TextInput value={name} onChangeText={setName} maxLength={40} autoFocus placeholder={t("Nome del gruppo")} placeholderTextColor={theme.text3} accessibilityLabel={t("Nome del gruppo")} style={[styles.name, { color: theme.text, borderBottomColor: theme.blue }]} />
        </View>
        {photoPick ? (
          <ToneRow
            photo={photo}
            title={name}
            onPick={(value) => { setPhoto(value); setPhotoPick(false); }}
            extra={(
              <>
                <Pressable onPress={uploadPhoto} style={[styles.toneExtra, { backgroundColor: theme.fill }]}><ImageIcon size={16} color={theme.text} /><T size={9} weight="600">{t("Foto")}</T></Pressable>
                {photo ? <Pressable onPress={() => { tap(); setPhoto(""); setPhotoPick(false); }} style={[styles.toneExtra, { backgroundColor: theme.fill }]}><Close size={16} weight="bold" color={theme.text} /></Pressable> : null}
              </>
            )}
          />
        ) : null}
        <TextInput value={about} onChangeText={setAbout} maxLength={255} multiline placeholder={t("Descrizione (facoltativa)")} placeholderTextColor={theme.text2} accessibilityLabel={t("Descrizione")} style={[styles.about, { backgroundColor: theme.fill, color: theme.text }]} />
        <Hint>{t("Puoi cambiare nome, foto e descrizione più tardi nelle info del gruppo.")}</Hint>
        <T size={13} weight="700" color={theme.text2} style={styles.letter}>{t("{n} membri", { n: chips.length + 1 })}</T>
        <View style={styles.member}>
          <Face src={live?.me?.src || store.profile?.src || ""} name={live?.me?.name || store.profile?.name} size={46} />
          <View style={{ flex: 1 }}><T size={15} weight="600">{live?.me?.name || store.profile?.name || t("Tu")}</T><T size={13.5} color={theme.text2}>{t("proprietario")}</T></View>
        </View>
        {chips.map((chip) => (
          <View key={chip.key} style={styles.member}>
            <Face src={chip.src} name={chip.name} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}><T size={15} weight="600" lines={1}>{chip.name}</T><T size={13.5} color={theme.text2} lines={1}>{chip.meta}</T></View>
          </View>
        ))}
      </ScrollView>
      {hint ? <Hint style={[styles.floatHint, { bottom: 90 + insets.bottom, backgroundColor: theme.bg }]}>{hint}</Hint> : null}
      {fab(ready, busy ? <Spinner color="#fff" size={22} /> : <Check size={24} weight="bold" color={ready ? "#fff" : theme.text3} />, create, t("Crea gruppo"))}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, maxHeight: 120, paddingTop: 6, paddingBottom: 10, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingRight: 12, borderRadius: 16, overflow: "hidden" },
  letter: { paddingTop: 10, paddingBottom: 4, paddingHorizontal: INSET },
  fab: { position: "absolute", right: 18, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 11, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  floatHint: { position: "absolute", left: 0, right: 80 },
  details: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 16, paddingBottom: 8, paddingHorizontal: INSET },
  photoEmpty: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  photoPlus: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  name: { flex: 1, minWidth: 0, height: 40, borderBottomWidth: 2, fontSize: 18, fontWeight: "600" },
  toneExtra: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  about: { marginTop: 6, marginHorizontal: INSET, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, fontSize: 14.5, minHeight: 56, textAlignVertical: "top" },
  member: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 7, paddingHorizontal: INSET },
});
