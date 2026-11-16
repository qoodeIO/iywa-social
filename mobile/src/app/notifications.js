import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { INSET, useTheme } from "../theme";
import { ALL_NOTIFICATIONS, ALL_THOUGHTS, useStore } from "../lib/store";
import { MEET, PEOPLE, STORY_DECKS, avatarFor } from "../data";
import { Bell, ChevronRight, Feather } from "../ui/icons";
import { NOTE_KINDS, openNote, openPersonByName } from "../ui/notify";
import { Empty, Header, T, tap } from "../ui/kit";
import { Rich } from "../ui/feed";
import { findPost, noteAgo, personHidden } from "../ui/feedData";

const FILTERS = [["all", "Tutte"], ["mention", "Menzioni"], ["comment", "Commenti"], ["like", "Mi piace"], ["follow", "Follow"], ["tag", "Tag"]];

// Web NotesScreen: filters, follow requests, New / Today / This week / Earlier, suggestions.
export default function Notifications() {
  const theme = useTheme();
  const store = useStore();
  const [filter, setFilter] = useState("all");
  // Unread ids are frozen when the screen opens, so "Nuove" stays put while you read.
  const [unreadIds] = useState(() => new Set((store.notifications || []).filter((note) => !note.read).map((note) => note.id)));
  const markRead = store.markNotificationsRead;
  useEffect(() => { markRead(); }, [markRead]);

  const all = useMemo(() => [...(store.notifications || []), ...ALL_NOTIFICATIONS]
    .filter((note) => !personHidden(store.prefs, note.name))
    .sort((a, b) => b.at - a.at), [store.notifications, store.prefs]);
  const list = all.filter((note) => filter === "all" || note.type === filter || (filter === "comment" && note.type === "reply"));
  const now = Date.now();
  const sections = [
    ["Nuove", list.filter((note) => unreadIds.has(note.id))],
    ["Oggi", list.filter((note) => !unreadIds.has(note.id) && now - note.at < 86_400_000)],
    ["Questa settimana", list.filter((note) => !unreadIds.has(note.id) && now - note.at >= 86_400_000 && now - note.at < 7 * 86_400_000)],
    ["Precedenti", list.filter((note) => !unreadIds.has(note.id) && now - note.at >= 7 * 86_400_000)],
  ].filter(([, data]) => data.length).map(([title, data]) => ({ title, data }));
  const suggestions = MEET.filter((person) => !store.follows.includes(person.name)).slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Notifiche" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([id, label]) => {
            const on = filter === id;
            const count = id === "all" ? 0 : all.filter((note) => unreadIds.has(note.id) && (note.type === id || (id === "comment" && note.type === "reply"))).length;
            return (
              <Pressable key={id} onPress={() => { tap(); setFilter(id); }} style={({ pressed }) => [styles.filter, { backgroundColor: on ? theme.text : "transparent", borderColor: on ? theme.text : theme.line, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
                <T size={14} weight="600" color={on ? theme.bg : theme.text}>{label}</T>
                {count ? <View style={styles.filterCount}><T size={10.5} weight="700" color="#fff">{count}</T></View> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(note) => note.id}
        stickySectionHeadersEnabled={false}
        initialNumToRender={14}
        ListHeaderComponent={filter === "all" ? (
          <Pressable style={({ pressed }) => [styles.requests, { borderBottomColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
            <View style={styles.stack}>
              <Image source={{ uri: PEOPLE[3].src }} style={[styles.stackFace, { borderColor: theme.bg }]} />
              <Image source={{ uri: PEOPLE[1].src }} style={[styles.stackFace, { borderColor: theme.bg, left: 12, top: 10 }]} />
            </View>
            <View style={{ flex: 1 }}>
              <T size={14} weight="600">Richieste di follow</T>
              <T size={14} color={theme.text2}>Nico Serra e altri 2</T>
            </View>
            <View style={[styles.blueDot, { backgroundColor: theme.blue }]} />
            <ChevronRight size={16} color={theme.text3} />
          </Pressable>
        ) : null}
        renderSectionHeader={({ section }) => <T size={16} weight="700" style={styles.group}>{section.title}</T>}
        renderSectionFooter={() => <View style={[styles.groupEnd, { backgroundColor: theme.line }]} />}
        renderItem={({ item, index }) => <NoteRow note={item} fresh={unreadIds.has(item.id)} following={store.follows.includes(item.name)} onFollow={store.toggleFollow} index={index} />}
        ListEmptyComponent={<Empty icon={Bell} title="Ancora niente qui" text="Quando qualcuno ti menziona o ti tagga, lo vedrai qui." />}
        ListFooterComponent={filter === "all" && suggestions.length ? (
          <View style={{ paddingBottom: 20 }}>
            <T size={16} weight="700" style={styles.group}>Suggeriti per te</T>
            {suggestions.map((person) => (
              <View key={person.name} style={styles.row}>
                <Pressable onPress={() => openPersonByName(person.name)}><Image source={{ uri: person.src }} style={styles.face} transition={120} /></Pressable>
                <T size={14} style={{ flex: 1 }} lines={2}><T size={14} weight="600">{person.name}</T> <T size={14} color={theme.text2}>{person.meta}</T></T>
                <Pressable onPress={() => { tap(); store.toggleFollow(person.name); }} style={({ pressed }) => [styles.smallBtn, { backgroundColor: theme.blue, opacity: pressed ? 0.75 : 1 }]}>
                  <T size={14} weight="600" color="#fff">Segui</T>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      />
    </View>
  );
}

const NoteRow = memo(function NoteRow({ note, fresh, following, onFollow }) {
  const theme = useTheme();
  const store = useStore();
  const kind = NOTE_KINDS[note.type] || NOTE_KINDS.like;
  const target = note.target || {};
  const post = target.kind === "post" ? findPost(target.id, store.library) : null;
  const thought = target.kind === "thought" ? ALL_THOUGHTS.find((item) => item.id === target.id) : null;
  const deck = target.kind === "story" ? STORY_DECKS.find((entry) => entry.id === target.id) : null;
  const thumb = post?.image || thought?.images?.[0] || deck?.frames?.[0]?.image;
  const Icon = kind.icon;
  return (
    <View style={[styles.row, fresh && { backgroundColor: theme.blue + "12" }]}>
      <Pressable onPress={() => openPersonByName(note.name)} style={note.type === "story" ? [styles.ring, { borderColor: "#ff2d55" }] : null}>
        <Image source={{ uri: note.src || avatarFor(note.name) }} style={styles.face} transition={120} />
        <View style={[styles.kind, { backgroundColor: kind.tone, borderColor: theme.bg }]}><Icon size={10} weight="fill" color="#fff" /></View>
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => openNote(note)}>
        <Rich text={note.text} prefix={<T size={14} weight="600">{note.name} </T>} />
        <T size={13} color={theme.text2} style={{ marginTop: 1 }}>{noteAgo(note.at)}</T>
      </Pressable>
      {note.type === "follow" ? (
        <Pressable onPress={() => { tap(); onFollow(note.name); }} style={({ pressed }) => [styles.smallBtn, { backgroundColor: following ? theme.btn : theme.blue, opacity: pressed ? 0.75 : 1 }]}>
          <T size={14} weight="600" color={following ? theme.text : "#fff"}>{following ? "Segui già" : "Ricambia"}</T>
        </Pressable>
      ) : thumb ? (
        <Pressable onPress={() => openNote(note)}><Image source={{ uri: thumb }} style={styles.thumb} transition={120} recyclingKey={thumb} /></Pressable>
      ) : thought ? (
        <Pressable onPress={() => openNote(note)} style={[styles.thumb, styles.quote, { backgroundColor: theme.fill }]}><Feather size={20} weight="fill" color={theme.text} /></Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  filters: { gap: 6, paddingHorizontal: INSET, paddingTop: 2, paddingBottom: 10 },
  filter: { height: 32, paddingHorizontal: 13, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 5 },
  filterCount: { minWidth: 17, height: 17, paddingHorizontal: 5, borderRadius: 9, backgroundColor: "#ff3040", alignItems: "center", justifyContent: "center" },
  requests: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  stack: { width: 44, height: 44 },
  stackFace: { position: "absolute", width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  blueDot: { width: 8, height: 8, borderRadius: 4 },
  group: { marginTop: 14, marginBottom: 6, paddingHorizontal: INSET },
  groupEnd: { height: StyleSheet.hairlineWidth, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: INSET },
  ring: { borderWidth: 2, borderRadius: 26, padding: 2 },
  face: { width: 44, height: 44, borderRadius: 22 },
  kind: { position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  thumb: { width: 44, height: 44, borderRadius: 4 },
  quote: { alignItems: "center", justifyContent: "center" },
  smallBtn: { height: 30, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
