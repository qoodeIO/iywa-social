import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CONTACTS } from "../../data";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { useLive } from "../../live/LiveStore";
import { personHidden, seenText } from "../../live/format";
import { EmptyState, Face, Hint, SubHead, Toast, useChatTheme, useFlash } from "../../ui/chat";
import { ChevronRight, Search, Users } from "../../ui/chatIcons";
import { T, tap } from "../../ui/kit";
import { INSET } from "../../theme";

export default function NewMessage() {
  const theme = useChatTheme();
  const store = useStore();
  const live = useLive();
  const [query, setQuery] = useState("");
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

  function startChat(person) {
    tap();
    const id = store.ensureChat(person);
    router.replace(`/chat/${id}`);
  }

  function startLiveChat(person) {
    if (busy) return;
    tap();
    setBusy(true);
    live.openDm(person.handle)
      .then((id) => router.replace(`/chat/${id}`))
      .catch(() => flash(t("Chat live non raggiungibile. Riprova."), 2200))
      .finally(() => setBusy(false));
  }

  // "On Space" shows only when the hub has answered: offline, the page is the demo contacts, like the web without a server.
  const head = (
    <View>
      <Pressable onPress={() => { tap(); router.replace("/chat/group"); }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}>
        <View style={[styles.round, { backgroundColor: theme.fill }]}><Users size={22} color={theme.text} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={14.5} weight="600">{t("Crea una chat di gruppo")}</T>
          <T size={13.5} color={theme.text2}>{t("Chatta e chiama insieme")}</T>
        </View>
        <ChevronRight size={16} color={theme.text2} />
      </Pressable>
      {online ? (
        <>
          <T size={15} weight="700" style={styles.section}>{t("Su Space")}</T>
          {livePeople.length ? livePeople.map((person) => (
            <Pressable key={person.handle} disabled={busy} onPress={() => startLiveChat(person)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }, busy && { opacity: 0.5 }]}>
              <Face src={person.src} name={person.name} size={46} online={person.online} dot={13} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={14.5} weight="600" lines={1}>{person.name}</T>
                <T size={13.5} color={theme.text2} lines={1}>@{person.handle} · {seenText(person)}</T>
              </View>
            </Pressable>
          )) : <Hint>{needle ? t("Nessuno con questo nome su Space.") : t("Ancora nessun altro iscritto. Accedi con un secondo account su un altro telefono per provare chat e chiamate dal vivo.")}</Hint>}
          <T size={15} weight="700" style={styles.section}>{t("Suggeriti")}</T>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={t("Nuovo messaggio")} />
      <View style={[styles.to, { borderBottomColor: theme.line }]}>
        <T size={15} weight="600">{t("A:")}</T>
        <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={t("Cerca…")} placeholderTextColor={theme.text2} autoCorrect={false} autoCapitalize="none" accessibilityLabel={t("Cerca persone")} style={{ flex: 1, height: 34, color: theme.text, fontSize: 15 }} />
      </View>
      <FlatList
        data={people}
        keyExtractor={(person) => person.name}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={head}
        renderItem={({ item: person }) => (
          <Pressable onPress={() => startChat(person)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}>
            <Face src={person.src} name={person.name} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={14.5} weight="600" lines={1}>{person.name}</T>
              <T size={13.5} color={theme.text2} lines={1}>{person.meta}</T>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!livePeople.length ? <EmptyState icon={Search} title={t("Nessun account trovato")} /> : null}
        contentContainerStyle={{ paddingBottom: 30 }}
      />
      <Toast text={hint} />
    </View>
  );
}

const styles = StyleSheet.create({
  to: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingVertical: 4, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: INSET },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  section: { marginTop: 14, marginHorizontal: INSET, marginBottom: 4 },
});
