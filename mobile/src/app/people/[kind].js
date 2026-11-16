import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { avatarFor } from "../../data";
import { CONTACTS, DIRECTORY, MEET, openPersonByName } from "../../lib/profile-data";
import { Search } from "../../ui/icons-profile";
import { Btn, Header, T } from "../../ui/kit";
import { SlideTabs } from "../../ui/profile-kit";

// Your followers and the people you follow (web PeopleScreen).
export default function People() {
  const theme = useTheme();
  const store = useStore();
  const { kind } = useLocalSearchParams();
  const [tab, setTab] = useState(kind === "following" ? 1 : 0);
  const [query, setQuery] = useState("");
  const hidden = new Set([...(store.prefs.blocked || []), ...(store.prefs.muted || [])]);
  const people = useMemo(() => [
    ...CONTACTS,
    ...store.follows
      .filter((name) => !name.startsWith("#") && !CONTACTS.some((person) => person.name === name))
      .map((name) => {
        const known = DIRECTORY.find((person) => person.name === name) || MEET.find((person) => person.name === name);
        return { name, meta: known ? (known.meta || `${known.craft} · ${known.city}`) : "", src: known?.src || avatarFor(name) };
      }),
  ], [store.follows]);
  const needle = query.trim().toLowerCase();
  const list = (tab === 0 ? people : people.filter((person) => store.follows.includes(person.name)))
    .filter((person) => !hidden.has(person.name))
    .filter((person) => !needle || `${person.name} ${person.meta}`.toLowerCase().includes(needle));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={String(store.profile.handle).replace(/^@/, "")} />
      <SlideTabs tabs={[{ key: "followers", label: "Follower" }, { key: "following", label: "Seguiti" }]} active={tab} onChange={setTab} height={44} size={14.5} />
      <View style={[styles.search, { backgroundColor: theme.fill }]}>
        <Search size={16} color={theme.text2} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Cerca" placeholderTextColor={theme.text2} accessibilityLabel="Cerca persone" autoCorrect={false} autoCapitalize="none" style={{ flex: 1, height: "100%", color: theme.text, fontSize: 15 }} />
      </View>
      <FlashList
        data={list}
        keyExtractor={(person) => person.name}
        extraData={[store.follows, tab]}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<T size={14} color={theme.text2} style={{ textAlign: "center", padding: 28 }}>Nessuno qui.</T>}
        renderItem={({ item: person }) => {
          const on = store.follows.includes(person.name);
          return (
            <View style={styles.row}>
              <Pressable onPress={() => openPersonByName(person.name, store.profile.name)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Image source={{ uri: person.src }} recyclingKey={person.src} style={[styles.avatar, { backgroundColor: theme.fill }]} contentFit="cover" transition={120} />
                <View style={{ flex: 1 }}>
                  <T size={14} weight="600" lines={1}>{person.name}</T>
                  {person.meta ? <T size={13.5} color={theme.text2} lines={1}>{person.meta}</T> : null}
                </View>
              </Pressable>
              <Btn
                title={on ? "Segui già" : tab === 0 ? "Ricambia" : "Segui"}
                kind={on ? "gray" : "primary"}
                height={30}
                style={{ paddingHorizontal: 16 }}
                onPress={() => store.toggleFollow(person.name)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 36, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginHorizontal: INSET, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: INSET },
  avatar: { width: 44, height: 44, borderRadius: 22 },
});
