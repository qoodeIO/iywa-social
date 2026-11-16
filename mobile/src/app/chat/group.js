import { Fragment, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { ZoomIn } from "react-native-reanimated";
import { AVATAR, CONTACTS } from "../../data";
import { useStore } from "../../lib/store";
import { useLive } from "../../live/LiveStore";
import { GROUP_TONES, personHidden, seenText } from "../../live/format";
import { fileToDataUrl, keepFile } from "../../live/media";
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
  const [picked, setPicked] = useState(() => new Set());
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoPick, setPhotoPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, flash] = useFlash();
  const needle = query.trim().toLowerCase();
  const me = live?.me?.handle;
  const online = live?.status === "open";
  const livePeople = live
    ? Object.values(live.people)
      .filter((person) => person.handle !== me && !personHidden(store.prefs, person.name, true))
      .filter((person) => !needle || `${person.name} ${person.handle}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
    : [];
  const people = CONTACTS.filter((person) => !personHidden(store.prefs, person.name, true) && (!needle || `${person.name} ${person.meta}`.toLowerCase().includes(needle)));
  const pickedLive = [...picked].filter((key) => key.startsWith("live:")).map((key) => key.slice(5));
  const pickedDemo = [...picked].filter((key) => key.startsWith("demo:")).map((key) => key.slice(5));
  const mixed = pickedLive.length > 0 && pickedDemo.length > 0;
  const enough = pickedLive.length ? pickedLive.length >= 1 : pickedDemo.length >= 2;
  const ready = name.trim().length > 0 && enough && !mixed && !busy;
  const chips = [
    ...pickedLive.map((handle) => {
      const person = live?.people[handle];
      return { key: `live:${handle}`, label: (person?.name || handle).split(" ")[0], name: person?.name || handle, src: person?.src || "", meta: person ? seenText(person) : `@${handle}` };
    }),
    ...pickedDemo.map((who) => {
      const person = CONTACTS.find((item) => item.name === who);
      return { key: `demo:${who}`, label: who.split(" ")[0], name: who, src: person?.src || "", meta: person?.meta || "" };
    }),
  ];
  const sorted = [...people].sort((x, y) => x.name.localeCompare(y.name));
  const letters = [];
  for (const person of sorted) {
    const letter = person.name[0].toUpperCase();
    if (!letters.length || letters[letters.length - 1][0] !== letter) letters.push([letter, []]);
    letters[letters.length - 1][1].push(person);
  }

  function toggle(key) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function uploadPhoto() {
    tap();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.25 });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      if (pickedLive.length) {
        const url = await fileToDataUrl(uri, "image/jpeg");
        if (!url || url.length > 160_000) {
          flash("Foto troppo grande per un gruppo live.", 2200);
          return;
        }
        setPhoto(url);
      } else setPhoto(keepFile(uri, "group"));
      setPhotoPick(false);
    } catch {
      flash("Impossibile aprire la foto.");
    }
  }

  function create() {
    const title = name.trim();
    if (!title || mixed) return;
    tap();
    if (pickedLive.length) {
      if (busy) return;
      setBusy(true);
      live.createGroup(title, pickedLive, { about: about.trim(), photo })
        .then((id) => router.replace(`/chat/${id}`))
        .catch(() => flash("Impossibile creare il gruppo. Riprova.", 2200))
        .finally(() => setBusy(false));
      return;
    }
    const members = CONTACTS.filter((person) => pickedDemo.includes(person.name));
    if (members.length < 2) return;
    const id = `g-${Date.now().toString(36)}`;
    store.addChat({
      id,
      name: title,
      kind: "Gruppo",
      preview: members.map((member) => member.name.split(" ")[0]).join(", "),
      time: "ora",
      unread: false,
      src: members[0].src,
      members,
      photo: photo || `tone:${Math.floor(Math.random() * GROUP_TONES.length)}`,
      about: about.trim(),
      messages: [{ from: "system", text: `Hai creato il gruppo «${title}».` }],
    });
    router.replace(`/chat/${id}`);
  }

  const fab = (on, icon, onPress, label) => (
    <Pressable accessibilityLabel={label} disabled={!on} onPress={onPress} style={[styles.fab, { bottom: 22 + insets.bottom, backgroundColor: on ? theme.blue : theme.fill, opacity: on ? 1 : 0.7, transform: [{ scale: on ? 1 : 0.85 }] }]}>
      {icon}
    </Pressable>
  );

  if (step === "members") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SubHead title="Nuovo gruppo" meta={picked.size ? `${picked.size} di 199 selezionati` : "Aggiungi membri"} />
        <View style={[styles.chips, { borderBottomColor: theme.line }]}>
          {chips.map((chip) => (
            <Animated.View key={chip.key} entering={ZoomIn.springify().damping(14)}>
              <Pressable accessibilityLabel={`Rimuovi ${chip.name}`} onPress={() => { tap(); toggle(chip.key); }} style={[styles.chip, { backgroundColor: theme.dark ? "#0a2236" : "#e3f2fe" }]}>
                <Face src={chip.src} name={chip.name} size={32} />
                <T size={14} weight="600">{chip.label}</T>
                <Close size={12} weight="bold" color={theme.text2} />
              </Pressable>
            </Animated.View>
          ))}
          <TextInput
            value={query}
            onChangeText={setQuery}
            onKeyPress={(event) => { if (event.nativeEvent.key === "Backspace" && !query && chips.length) toggle(chips[chips.length - 1].key); }}
            placeholder={chips.length ? "" : "Chi vuoi aggiungere?"}
            placeholderTextColor={theme.text3}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Cerca persone per il gruppo"
            style={{ flexGrow: 1, minWidth: 120, height: 32, color: theme.text, fontSize: 15 }}
          />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 110 }}>
          {online ? (
            <>
              <T size={13} weight="700" color={theme.text2} style={styles.letter}>Su Space</T>
              {livePeople.length ? livePeople.map((person) => (
                <CheckRow key={person.handle} on={picked.has(`live:${person.handle}`)} src={person.src} name={person.name} online={person.online} meta={person.online ? "online" : seenText(person)} metaBlue={person.online} onPress={() => toggle(`live:${person.handle}`)} />
              )) : <Hint>{needle ? "Nessuno con questo nome su Space." : "Ancora nessun altro iscritto."}</Hint>}
            </>
          ) : null}
          {letters.map(([letter, list]) => (
            <Fragment key={letter}>
              <T size={13} weight="700" color={theme.blue} style={styles.letter}>{letter}</T>
              {list.map((person) => <CheckRow key={person.name} on={picked.has(`demo:${person.name}`)} src={person.src} name={person.name} meta={person.meta} onPress={() => toggle(`demo:${person.name}`)} />)}
            </Fragment>
          ))}
        </ScrollView>
        {mixed || hint ? <Hint style={[styles.floatHint, { bottom: 90 + insets.bottom, backgroundColor: theme.bg }]}>{hint || "I contatti demo non possono entrare in un gruppo live. Scegli solo persone su Space o solo contatti demo."}</Hint> : null}
        {fab(enough && !mixed, <ArrowRight size={24} weight="bold" color={enough && !mixed ? "#fff" : theme.text3} />, () => { tap(); setStep("details"); setQuery(""); }, "Avanti")}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SubHead title="Nuovo gruppo" meta={`${chips.length + 1} membri`} onBack={() => setStep("members")} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.details}>
          <Pressable accessibilityLabel="Foto del gruppo" onPress={() => { tap(); setPhotoPick((value) => !value); }} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            {photo ? <GroupAvatar photo={photo} title={name || "?"} size={70} /> : (
              <View style={[styles.photoEmpty, { backgroundColor: theme.dark ? "#0a2236" : "#e3f2fe" }]}><Camera size={28} weight="fill" color={theme.blue} /></View>
            )}
            <View style={[styles.photoPlus, { backgroundColor: theme.blue, borderColor: theme.bg }]}><Plus size={12} weight="bold" color="#fff" /></View>
          </Pressable>
          <TextInput value={name} onChangeText={setName} maxLength={40} autoFocus placeholder="Nome del gruppo" placeholderTextColor={theme.text3} accessibilityLabel="Nome del gruppo" style={[styles.name, { color: theme.text, borderBottomColor: theme.blue }]} />
        </View>
        {photoPick ? (
          <ToneRow
            photo={photo}
            title={name}
            onPick={(value) => { setPhoto(value); setPhotoPick(false); }}
            extra={(
              <>
                <Pressable onPress={uploadPhoto} style={[styles.toneExtra, { backgroundColor: theme.fill }]}><ImageIcon size={16} color={theme.text} /><T size={9} weight="600">Foto</T></Pressable>
                {photo ? <Pressable onPress={() => { tap(); setPhoto(""); setPhotoPick(false); }} style={[styles.toneExtra, { backgroundColor: theme.fill }]}><Close size={16} weight="bold" color={theme.text} /></Pressable> : null}
              </>
            )}
          />
        ) : null}
        <TextInput value={about} onChangeText={setAbout} maxLength={255} multiline placeholder="Descrizione (facoltativa)" placeholderTextColor={theme.text2} accessibilityLabel="Descrizione" style={[styles.about, { backgroundColor: theme.fill, color: theme.text }]} />
        <Hint>Puoi cambiare nome, foto e descrizione più tardi nelle info del gruppo.</Hint>
        <T size={13} weight="700" color={theme.text2} style={styles.letter}>{`${chips.length + 1} membri`}</T>
        <View style={styles.member}>
          <Face src={live?.me?.src || store.profile?.src || AVATAR} name={live?.me?.name || store.profile?.name} size={46} />
          <View style={{ flex: 1 }}><T size={15} weight="600">{live?.me?.name || store.profile?.name || "Tu"}</T><T size={13.5} color={theme.text2}>proprietario</T></View>
        </View>
        {chips.map((chip) => (
          <View key={chip.key} style={styles.member}>
            <Face src={chip.src} name={chip.name} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}><T size={15} weight="600" lines={1}>{chip.name}</T><T size={13.5} color={theme.text2} lines={1}>{chip.meta}</T></View>
          </View>
        ))}
      </ScrollView>
      {hint ? <Hint style={[styles.floatHint, { bottom: 90 + insets.bottom, backgroundColor: theme.bg }]}>{hint}</Hint> : null}
      {fab(ready, busy ? <Spinner color="#fff" size={22} /> : <Check size={24} weight="bold" color={ready ? "#fff" : theme.text3} />, create, "Crea gruppo")}
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
