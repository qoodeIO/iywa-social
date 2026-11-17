import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { t } from "../../lib/i18n";
import { useLive } from "../../live/LiveStore";
import { usePeople } from "../../live/people";
import { EmptyState, Face, Hint, SubHead, Toast, useChatTheme, useFlash } from "../../ui/chat";
import { ChevronRight, Search, Users, Verified } from "../../ui/chatIcons";
import { T, tap } from "../../ui/kit";
import { INSET } from "../../theme";

// Start a 1:1 chat: search everyone on iywa, or pick from who I follow and suggestions.
export default function NewMessage() {
  const theme = useChatTheme();
  const live = useLive();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [hint, flash] = useFlash();
  const people = usePeople(query);
  const online = live?.status === "open";

  const data = [];
  if (people.searching) {
    for (const person of people.results) data.push({ type: "person", key: `r:${person.handle}`, person });
  } else {
    if (people.following.length) data.push({ type: "section", key: "s-following", title: t("Persone che segui") });
    for (const person of people.following) data.push({ type: "person", key: `f:${person.handle}`, person });
    if (people.suggested.length) data.push({ type: "section", key: "s-suggested", title: t("Suggeriti") });
    for (const person of people.suggested) data.push({ type: "person", key: `s:${person.handle}`, person });
  }

  function startChat(person) {
    if (busy) return;
    tap();
    if (!online) {
      flash(t("Connessione… riprova tra un attimo."), 2200);
      return;
    }
    setBusy(person.handle);
    live.openDm(person.handle)
      .then((id) => router.replace(`/chat/${id}`))
      .catch((error) => flash(error?.message === "no-user"
        ? t("{name} non ha ancora aperto i messaggi su iywa.", { name: person.name })
        : t("Impossibile aprire la chat. Riprova."), 2600))
      .finally(() => setBusy(null));
  }

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
      {!online ? <Hint>{t("Connessione…")}</Hint> : null}
    </View>
  );

  const empty = people.loading ? (
    <ActivityIndicator style={{ marginTop: 40 }} color={theme.text2} />
  ) : people.error ? (
    <Pressable onPress={() => { tap(); people.refresh(); }} style={{ alignItems: "center", marginTop: 32, gap: 6 }}>
      <T size={14} color={theme.text2}>{t("Impossibile caricare le persone.")}</T>
      <T size={14} weight="600" color={theme.blue}>{t("Riprova")}</T>
    </Pressable>
  ) : people.searching ? (
    <EmptyState icon={Search} title={t("Nessun account trovato")} text={t("Prova con un altro nome o nome utente.")} />
  ) : (
    <EmptyState icon={Search} title={t("Cerca qualcuno")} text={t("Scrivi un nome o un nome utente per iniziare una chat.")} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={t("Nuovo messaggio")} />
      <View style={[styles.to, { borderBottomColor: theme.line }]}>
        <T size={15} weight="600">{t("A:")}</T>
        <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={t("Cerca…")} placeholderTextColor={theme.text2} autoCorrect={false} autoCapitalize="none" accessibilityLabel={t("Cerca persone")} style={{ flex: 1, height: 34, color: theme.text, fontSize: 15 }} />
      </View>
      <FlatList
        data={data}
        keyExtractor={(cell) => cell.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={head}
        ListEmptyComponent={empty}
        ListFooterComponent={people.moreLoading ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.text2} /> : null}
        onEndReached={people.more}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={people.refreshing} onRefresh={people.refresh} tintColor={theme.text2} />}
        renderItem={({ item: cell }) => (cell.type === "section" ? (
          <T size={15} weight="700" style={styles.section}>{cell.title}</T>
        ) : (
          <Pressable disabled={Boolean(busy)} onPress={() => startChat(cell.person)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }, busy && busy !== cell.person.handle && { opacity: 0.5 }]}>
            <Face src={cell.person.src} name={cell.person.name} size={48} online={cell.person.online} dot={13} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <T size={14.5} weight="600" lines={1} style={{ flexShrink: 1 }}>{cell.person.name}</T>
                {cell.person.verified ? <Verified size={14} weight="fill" color={theme.blue} /> : null}
              </View>
              <T size={13.5} color={cell.person.online ? theme.blue : theme.text2} lines={1}>{cell.person.meta}</T>
            </View>
            {busy === cell.person.handle ? <ActivityIndicator color={theme.text2} /> : null}
          </Pressable>
        ))}
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
