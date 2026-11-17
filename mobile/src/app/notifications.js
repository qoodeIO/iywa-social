import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { ago, answerRequest, cachedPost, markNotificationsRead, toggleFollow, useNotifications, usePost, useRequests, useSuggested } from "../lib/social";
import { errorText } from "../lib/api";
import { Bell, ChevronRight, Feather } from "../ui/icons";
import { NOTE_KINDS, localNote, noteText, openNote } from "../ui/notify";
import { Face, openPerson } from "../ui/thoughts";
import { showToast } from "../ui/feedEcho";
import { Btn, Empty, Header, T, tap } from "../ui/kit";
import { t, tk } from "../lib/i18n";

const DAY = 86_400_000;
const FILTERS = [["all", tk("Tutte")], ["mention", tk("Menzioni")], ["comment", tk("Commenti")], ["like", tk("Mi piace")], ["follow", tk("Follow")]];
const FILTER_TYPES = {
  mention: ["mention", "story_mention", "tag"],
  comment: ["comment", "reply", "review"],
  like: ["like", "comment_like", "story_like", "repost"],
  follow: ["follow", "request", "accepted"],
};

function hiddenActor(prefs, note) {
  const a = note.actor || {};
  const people = new Set([...(prefs?.blocked || []), ...(prefs?.muted || [])].map((x) => String(x).replace(/^@/, "")));
  return people.has(a.handle) || people.has(a.name);
}

// Notifications: follow requests, then Today / This week / Earlier.
export default function Notifications() {
  const theme = useTheme();
  const store = useStore();
  const { items, data, loading, refreshing, moreLoading, done, error, refresh, more } = useNotifications();
  const requests = useRequests();
  const suggested = useSuggested();
  const [filter, setFilter] = useState("all");
  // Unread ids are frozen when the list first arrives, so the highlight stays while you read.
  const unread = useRef(null);
  const [, setFrozen] = useState(0);

  useEffect(() => {
    if (unread.current || loading) return;
    unread.current = new Set([
      ...items.filter((note) => !note.read).map((note) => note.id),
      ...(store.notifications || []).filter((note) => !note.read).map((note) => note.id),
    ]);
    setFrozen((n) => n + 1);
    markNotificationsRead();
    store.markNotificationsRead?.();
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => [...items, ...(store.notifications || []).map(localNote)]
    .filter((note) => !hiddenActor(store.prefs, note))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [items, store.notifications, store.prefs]);
  const list = filter === "all" ? all : all.filter((note) => FILTER_TYPES[filter].includes(note.type));
  const now = Date.now();
  const sections = [
    [t("Oggi"), list.filter((note) => now - note.createdAt < DAY)],
    [t("Questa settimana"), list.filter((note) => now - note.createdAt >= DAY && now - note.createdAt < 7 * DAY)],
    [t("Precedenti"), list.filter((note) => now - note.createdAt >= 7 * DAY)],
  ].filter(([, rows]) => rows.length).map(([title, rows]) => ({ title, data: rows }));

  const pending = data?.requests || requests.data?.length || 0;
  const askers = requests.data || [];
  const fresh = unread.current || new Set();
  const people = (suggested.data || []).filter((person) => !person.isFollowing && !person.requested).slice(0, 5);

  const header = (
    <View>
      {filter === "all" && pending > 0 ? (
        <Pressable onPress={() => router.push("/people/requests")} style={({ pressed }) => [styles.requests, { borderBottomColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
          <View style={styles.stack}>
            {askers[1] ? <Face person={askers[1]} size={32} style={[styles.stackFace, { borderColor: theme.bg, left: 12, top: 10 }]} /> : null}
            <Face person={askers[0]} size={askers[1] ? 32 : 44} style={askers[1] ? [styles.stackFace, { borderColor: theme.bg }] : null} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={14} weight="600">{t("Richieste di follow")}</T>
            <T size={14} color={theme.text2} lines={1}>
              {askers[0] ? (pending > 1 ? t("{name} e altri {n}", { name: askers[0].handle, n: pending - 1 }) : askers[0].handle) : t("{n} in attesa", { n: pending })}
            </T>
          </View>
          <View style={[styles.blueDot, { backgroundColor: theme.blue }]} />
          <ChevronRight size={16} color={theme.text3} />
        </Pressable>
      ) : null}
    </View>
  );

  let empty = null;
  if (loading) empty = <ActivityIndicator style={{ marginTop: 40 }} color={theme.text2} />;
  else if (error && !all.length) {
    empty = (
      <Empty icon={Bell} title={t("Impossibile caricare le notifiche")} text={errorText(error, t)}>
        <Btn title={t("Riprova")} onPress={refresh} height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} />
      </Empty>
    );
  } else empty = <Empty icon={Bell} title={t("Ancora niente qui")} text={t("Quando qualcuno mette mi piace, commenta, ti menziona o inizia a seguirti, lo vedrai qui.")} />;

  const footer = (
    <View style={{ paddingBottom: 30 }}>
      {moreLoading ? <ActivityIndicator style={{ marginVertical: 16 }} color={theme.text2} /> : null}
      {filter === "all" && !loading && (done || !all.length) && people.length ? (
        <View>
          <T size={16} weight="700" style={styles.group}>{t("Suggeriti per te")}</T>
          {people.map((person) => (
            <View key={person.handle} style={styles.row}>
              <Pressable onPress={() => openPerson(person.handle)}><Face person={person} size={44} /></Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => openPerson(person.handle)}>
                <T size={14} weight="600" lines={1}>{person.handle}</T>
                {person.name ? <T size={13.5} color={theme.text2} lines={1}>{person.name}</T> : null}
              </Pressable>
              <FollowButton person={person} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Notifiche")} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([id, label]) => {
            const on = filter === id;
            const count = id === "all" ? 0 : all.filter((note) => fresh.has(note.id) && FILTER_TYPES[id].includes(note.type)).length;
            return (
              <Pressable key={id} onPress={() => { tap(); setFilter(id); }} style={({ pressed }) => [styles.filter, { backgroundColor: on ? theme.text : "transparent", borderColor: on ? theme.text : theme.line, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
                <T size={14} weight="600" color={on ? theme.bg : theme.text}>{t(label)}</T>
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
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => <T size={16} weight="700" style={styles.group}>{section.title}</T>}
        renderSectionFooter={() => <View style={[styles.groupEnd, { backgroundColor: theme.line }]} />}
        renderItem={({ item }) => <NoteRow note={item} fresh={fresh.has(item.id)} />}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => { if (!done && !loading) more(); }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); requests.refresh(); }} tintColor={theme.text2} />}
      />
    </View>
  );
}

function FollowButton({ person, small }) {
  const theme = useTheme();
  // The note carries the relation as it was; follow-back state is kept here after a tap.
  const [state, setState] = useState({ isFollowing: Boolean(person.isFollowing), requested: Boolean(person.requested) });
  const [busy, setBusy] = useState(false);
  const on = state.isFollowing || state.requested;
  async function press() {
    if (busy) return;
    tap();
    setBusy(true);
    try {
      const user = await toggleFollow({ handle: person.handle, ...state });
      setState({ isFollowing: Boolean(user?.isFollowing), requested: Boolean(user?.requested) });
    } catch (error) {
      showToast({ text: errorText(error, t) });
    } finally {
      setBusy(false);
    }
  }
  const label = state.isFollowing ? t("Segui già") : state.requested ? t("Richiesta inviata") : small ? t("Ricambia") : t("Segui");
  return (
    <Pressable onPress={press} style={({ pressed }) => [styles.smallBtn, { backgroundColor: on ? theme.btn : theme.blue, opacity: pressed || busy ? 0.75 : 1 }]}>
      <T size={14} weight="600" color={on ? theme.text : "#fff"}>{label}</T>
    </Pressable>
  );
}

function RequestButtons({ handle }) {
  const theme = useTheme();
  const [answer, setAnswer] = useState(null);
  async function reply(accept) {
    tap();
    setAnswer(accept ? "ok" : "no");
    try {
      await answerRequest(handle, accept);
    } catch (error) {
      setAnswer(null);
      showToast({ text: errorText(error, t) });
    }
  }
  if (answer) return <T size={13.5} color={theme.text2}>{answer === "ok" ? t("Accettata") : t("Rimossa")}</T>;
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <Pressable onPress={() => reply(true)} style={({ pressed }) => [styles.smallBtn, { paddingHorizontal: 12, backgroundColor: theme.blue, opacity: pressed ? 0.75 : 1 }]}>
        <T size={14} weight="600" color="#fff">{t("Conferma")}</T>
      </Pressable>
      <Pressable onPress={() => reply(false)} style={({ pressed }) => [styles.smallBtn, { paddingHorizontal: 12, backgroundColor: theme.btn, opacity: pressed ? 0.75 : 1 }]}>
        <T size={14} weight="600">{t("Elimina")}</T>
      </Pressable>
    </View>
  );
}

// Thumbnail of the post a note is about: from the cache, else loaded once.
function PostThumb({ id, onPress }) {
  const theme = useTheme();
  const cached = cachedPost(id);
  const { data } = usePost(cached ? null : id);
  const post = cached || data?.post;
  const media = post?.media?.[0];
  const src = media ? (media.type === "video" ? media.poster || null : media.url) : null;
  if (post?.kind === "thought" && !src) {
    return <Pressable onPress={onPress} style={[styles.thumb, styles.center, { backgroundColor: theme.fill }]}><Feather size={20} weight="fill" color={theme.text} /></Pressable>;
  }
  if (!post) return <View style={[styles.thumb, { backgroundColor: theme.fill }]} />;
  return (
    <Pressable onPress={onPress}>
      {src ? <Image source={{ uri: src }} style={[styles.thumb, { backgroundColor: theme.fill }]} transition={120} recyclingKey={src} /> : <View style={[styles.thumb, { backgroundColor: theme.fill }]} />}
    </Pressable>
  );
}

const NoteRow = memo(function NoteRow({ note, fresh }) {
  const theme = useTheme();
  const kind = NOTE_KINDS[note.type] || NOTE_KINDS.like;
  const target = note.target || {};
  const actor = note.actor || {};
  const Icon = kind.icon;
  const open = () => (note.type === "request" ? router.push("/people/requests") : openNote(note));
  const story = target.kind === "story";
  let action = null;
  if (note.type === "follow") action = <FollowButton person={{ ...note, handle: actor.handle }} small />;
  else if (note.type === "request") action = <RequestButtons handle={actor.handle} />;
  else if ((target.kind === "post" || target.kind === "thought") && target.id) action = <PostThumb id={target.id} onPress={open} />;
  return (
    <View style={[styles.row, fresh && { backgroundColor: theme.blue + "12" }]}>
      <Pressable onPress={() => (note.local ? open() : openPerson(actor.handle))} style={story ? [styles.ring, { borderColor: "#ff2d55" }] : null}>
        <Face person={actor} size={44} />
        <View style={[styles.kind, { backgroundColor: kind.tone, borderColor: theme.bg }]}><Icon size={10} weight="fill" color="#fff" /></View>
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={open}>
        <T size={14} lines={3} style={{ lineHeight: 19 }}>
          <T size={14} weight="600">{actor.handle || actor.name}</T> {noteText(note)}
          <T size={13} color={theme.text2}>{"  "}{ago(note.createdAt)}</T>
        </T>
      </Pressable>
      {action}
    </View>
  );
});

const styles = StyleSheet.create({
  filters: { gap: 6, paddingHorizontal: INSET, paddingTop: 2, paddingBottom: 10 },
  filter: { height: 32, paddingHorizontal: 13, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 5 },
  filterCount: { minWidth: 17, height: 17, paddingHorizontal: 5, borderRadius: 9, backgroundColor: "#ff3040", alignItems: "center", justifyContent: "center" },
  requests: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  stack: { width: 44, height: 44 },
  stackFace: { position: "absolute", borderWidth: 2 },
  blueDot: { width: 8, height: 8, borderRadius: 4 },
  group: { marginTop: 14, marginBottom: 6, paddingHorizontal: INSET },
  groupEnd: { height: StyleSheet.hairlineWidth, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: INSET },
  ring: { borderWidth: 2, borderRadius: 26, padding: 2 },
  kind: { position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  thumb: { width: 44, height: 44, borderRadius: 4 },
  center: { alignItems: "center", justifyContent: "center" },
  smallBtn: { height: 30, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
