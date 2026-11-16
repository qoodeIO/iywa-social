import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { ChevronRight, ClearIcon, Search, Trash } from "../../ui/icons";
import { Avatar, Header, T, tap } from "../../ui/kit";
import { Card, Kicker, Row, SETTING_GROUPS, SettingIcon, settingValue } from "../../ui/settings";
import { t } from "../../lib/i18n";

// Some rows open screens that already exist elsewhere in the app.
const ROUTES = { orders: "/shop/orders", payments: "/payments", edit: "/edit-profile" };

export default function Settings() {
  const theme = useTheme();
  const store = useStore();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = SETTING_GROUPS
    .map((group) => ({ ...group, rows: group.rows.filter((row) => !needle || `${t(row.label)} ${t(row.meta)}`.toLowerCase().includes(needle)) }))
    .filter((group) => group.rows.length);
  const open = (id) => router.push(ROUTES[id] || `/settings/${id}`);

  function reset() {
    Alert.alert(t("Azzerare i dati?"), t("Carrello, preferiti, like, messaggi e impostazioni tornano come all'inizio."), [
      { text: t("Annulla"), style: "cancel" },
      { text: t("Azzera"), style: "destructive", onPress: () => store.reset() },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Impostazioni e privacy")} border />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <View style={[styles.search, { backgroundColor: theme.fill }]}>
          <Search size={17} color={theme.text2} weight="bold" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t("Cerca nelle impostazioni")} placeholderTextColor={theme.text2} style={{ flex: 1, fontSize: 15.5, color: theme.text }} returnKeyType="search" clearButtonMode="never" />
          {query ? <Pressable hitSlop={8} onPress={() => setQuery("")}><ClearIcon size={18} weight="fill" color={theme.text2} /></Pressable> : null}
        </View>

        {!needle ? (
          <Card style={{ marginTop: 14 }}>
            <Pressable onPress={() => { tap(); open("edit"); }} style={({ pressed }) => [styles.me, pressed ? { backgroundColor: theme.fill } : null]}>
              <Avatar src={store.profile.src} size={54} />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={17} weight="700">{store.profile.name}</T>
                <T size={13.5} color={theme.text2}>{store.profile.handle}</T>
              </View>
              <ChevronRight size={14} weight="bold" color={theme.text3} />
            </Pressable>
          </Card>
        ) : null}

        {groups.map((group) => (
          <View key={group.title}>
            <Kicker>{t(group.title)}</Kicker>
            <Card>
              {group.rows.map((row, index) => (
                <Row key={row.id} first={index === 0} icon={<SettingIcon id={row.id} />} label={t(row.label)} meta={t(row.meta)} value={settingValue(row.id, store)} onPress={() => open(row.id)} />
              ))}
            </Card>
          </View>
        ))}

        {groups.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60, gap: 6 }}>
            <Search size={40} color={theme.text3} weight="light" />
            <T size={17} weight="700">{t("Nessun risultato")}</T>
            <T size={14} color={theme.text2}>{t("Nessuna impostazione con questo nome.")}</T>
          </View>
        ) : null}

        {!needle ? (
          <>
            <Card style={{ marginTop: 26 }}>
              <Pressable onPress={() => { tap(); open("login"); }} style={({ pressed }) => [styles.center, pressed ? { backgroundColor: theme.fill } : null]}>
                <T size={15.5} weight="600" color={theme.blue}>{t("Esci")}</T>
              </Pressable>
            </Card>
            <Card style={{ marginTop: 12 }}>
              <Pressable onPress={reset} style={({ pressed }) => [styles.center, { flexDirection: "row", gap: 8 }, pressed ? { backgroundColor: theme.fill } : null]}>
                <Trash size={18} color={theme.red} />
                <T size={15.5} color={theme.red}>{t("Azzera i dati della demo")}</T>
              </Pressable>
            </Card>
            <T size={12} color={theme.text2} style={{ textAlign: "center", marginTop: 22 }}>
              <T size={12} weight="700" color={theme.text2}>Space</T>{t(" · versione {version}", { version: Constants.expoConfig?.version })}
            </T>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: INSET, marginTop: 12, height: 40, borderRadius: 12, paddingHorizontal: 12 },
  me: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  center: { height: 50, alignItems: "center", justifyContent: "center" },
});
