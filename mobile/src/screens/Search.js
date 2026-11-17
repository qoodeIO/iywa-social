import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { openTab, useTabParams, useTabReselect } from "../lib/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { compact } from "../data";
import { openGridItem } from "../lib/profile-data";
import { postCard, toggleFollow, useExplore, useSearch, useSuggested } from "../lib/social";
import { myHandle } from "../lib/session";
import { Hash, Search as SearchIcon, SquarePlus, Verified, X } from "../ui/icons-profile";
import { Btn, T, tap } from "../ui/kit";
import { ExploreBlock, ExploreGrid, IgEmpty, PeekCard, SlideTabs, toBlocks } from "../ui/profile-kit";
import { t, tk } from "../lib/i18n";

const TABS = [["top", tk("Per te")], ["accounts", tk("Account")], ["tags", tk("Tag")]];

// Blocked or muted people (the lists may hold names or handles).
function useHidden(prefs) {
  return useMemo(() => new Set([...(prefs.blocked || []), ...(prefs.muted || [])].map((value) => String(value).replace(/^@/, "").toLowerCase())), [prefs.blocked, prefs.muted]);
}
const isHidden = (hidden, person) => hidden.has(String(person?.handle || "").toLowerCase()) || hidden.has(String(person?.name || "").toLowerCase());

// The explore mosaic puts the first post of every five in the tall tile: pull the next reel
// forward into that slot when there is one close by, so reels get the big tiles.
function arrange(posts) {
  const rest = [...posts];
  const out = [];
  while (rest.length) {
    if (out.length % 5 === 0) {
      const at = rest.slice(0, 8).findIndex((post) => post.kind === "reel");
      out.push(rest.splice(at > 0 ? at : 0, 1)[0]);
    } else out.push(rest.shift());
  }
  return out;
}

export default function Search() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const params = useTabParams("search");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [focus, setFocus] = useState(false);
  const [tab, setTab] = useState(0);
  const [peeked, setPeeked] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useTabReselect("search", () => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  const searching = focus || Boolean(query.trim());
  const hidden = useHidden(store.prefs);
  const me = myHandle();

  // Search as you type, a beat after the last key.
  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setTerm("");
      return undefined;
    }
    const id = setTimeout(() => setTerm(value), 250);
    return () => clearTimeout(id);
  }, [query]);

  // A #tag or @handle tapped elsewhere in the app lands here.
  useEffect(() => {
    if (!params.q) return;
    const value = String(params.q).trim();
    if (value.startsWith("#") && value.length > 1) {
      router.push(`/hashtag/${encodeURIComponent(value.slice(1).toLowerCase())}`);
      return;
    }
    setQuery(value);
    setFocus(true);
  }, [params.q, params.at]);

  const explore = useExplore();
  const posts = useMemo(() => arrange(explore.items.map(postCard).filter((post) => post.image && !isHidden(hidden, post.author))), [explore.items, hidden]);
  const blocks = useMemo(() => toBlocks(posts), [posts]);
  const openExplore = useCallback((post) => openGridItem(post, posts, t("Esplora")), [posts]);

  const results = useSearch(term);
  const found = results.data || {};
  const people = (found.people || []).filter((person) => !isHidden(hidden, person));
  const tags = found.tags || [];
  const postHits = useMemo(() => (found.posts || []).map(postCard).filter((post) => post.image && !isHidden(hidden, post.author)), [found.posts, hidden]);
  const suggested = useSuggested();

  function openPerson(person) {
    store.rememberSearch({ key: `p:${person.handle}`, type: "account", label: person.handle, meta: person.name, src: person.avatar || "" });
    Keyboard.dismiss();
    if (person.handle === me) openTab("profile");
    else router.push(`/person/${person.handle}`);
  }

  function openTag(tag) {
    store.rememberSearch({ key: `tag:${tag}`, type: "tag", label: tag });
    Keyboard.dismiss();
    router.push(`/hashtag/${encodeURIComponent(tag)}`);
  }

  function openRecent(entry) {
    if (entry.type === "account") openPerson({ handle: entry.label, name: entry.meta, avatar: entry.src });
    else if (entry.type === "tag") openTag(entry.label);
    else setQuery(entry.label);
  }

  function leave() {
    setQuery("");
    setFocus(false);
    setTab(0);
    inputRef.current?.blur();
  }

  const accountRow = (person, big = false) => {
    const self = person.handle === me;
    const label = person.isFollowing ? t("Segui già") : person.requested ? t("Richiesta inviata") : person.followsMe ? t("Segui anche tu") : t("Segui");
    const sub = [person.name, person.followsMe ? t("Ti segue") : person.followers != null ? t("{n} follower", { n: compact(person.followers) }) : null].filter(Boolean).join(" · ");
    return (
      <View key={person.handle} style={styles.row}>
        <Pressable style={({ pressed }) => [styles.rowOpen, { opacity: pressed ? 0.6 : 1 }]} onPress={() => openPerson(person)}>
          <Face src={person.avatar} name={person.name || person.handle} size={50} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <T size={14} weight="600" lines={1} style={{ flexShrink: 1 }}>{person.handle}</T>
              {person.verified ? <Verified size={14} weight="fill" color={theme.blue} /> : null}
            </View>
            {sub ? <T size={14} color={theme.text2} lines={1}>{sub}</T> : null}
          </View>
        </Pressable>
        {big && !self ? (
          <Btn
            title={label}
            kind={person.isFollowing || person.requested ? "gray" : "primary"}
            height={30}
            style={{ paddingHorizontal: 16 }}
            onPress={() => { tap(); toggleFollow(person).catch(() => {}); }}
          />
        ) : null}
      </View>
    );
  };

  const tagRow = ({ tag, count }) => (
    <Pressable key={tag} style={({ pressed }) => [styles.line, { opacity: pressed ? 0.6 : 1 }]} onPress={() => openTag(tag)}>
      <View style={[styles.round, { borderColor: theme.line }]}><Hash size={22} color={theme.text} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <T size={14} weight="600" lines={1}>#{tag}</T>
        <T size={14} color={theme.text2} lines={1}>{t("{n} post", { n: compact(count) })}</T>
      </View>
    </Pressable>
  );

  let overlay = null;
  if (searching && !query.trim()) {
    const recents = (store.recentSearches || []).filter((entry) => ["account", "tag", "query"].includes(entry.type));
    const suggestions = recents.length ? [] : (suggested.data || []).filter((person) => !isHidden(hidden, person)).slice(0, 8);
    overlay = (
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 30 }}>
        {recents.length ? (
          <>
            <View style={styles.head}>
              <T size={16} weight="700">{t("Recenti")}</T>
              <Pressable hitSlop={8} onPress={() => { tap(); store.forgetSearch(); }}><T size={14} weight="600" color={theme.blue}>{t("Cancella tutto")}</T></Pressable>
            </View>
            {recents.map((entry) => (
              <View key={entry.key} style={styles.row}>
                <Pressable style={({ pressed }) => [styles.rowOpen, { opacity: pressed ? 0.6 : 1 }]} onPress={() => openRecent(entry)}>
                  {entry.type === "account" ? (
                    <Face src={entry.src} name={entry.meta || entry.label} size={50} />
                  ) : (
                    <View style={[styles.round, { borderColor: theme.line }]}>
                      {entry.type === "tag" ? <Hash size={22} color={theme.text} /> : <SearchIcon size={22} color={theme.text} />}
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={14} weight="600" lines={1}>{entry.type === "tag" ? `#${entry.label}` : entry.label}</T>
                    {entry.meta ? <T size={14} color={theme.text2} lines={1}>{entry.meta}</T> : null}
                  </View>
                </Pressable>
                <Pressable accessibilityLabel={t("Rimuovi")} hitSlop={6} style={styles.x} onPress={() => store.forgetSearch(entry.key)}><X size={18} color={theme.text2} /></Pressable>
              </View>
            ))}
          </>
        ) : null}
        {!recents.length ? <View style={styles.head}><T size={16} weight="700">{t("Suggeriti per te")}</T></View> : null}
        {suggestions.map((person) => accountRow(person, true))}
        {!recents.length && !suggestions.length ? (
          suggested.loading ? <ActivityIndicator style={{ marginTop: 24 }} color={theme.text2} /> : <T size={14} color={theme.text2} style={styles.note}>{t("Cerca persone e tag su iywa.")}</T>
        ) : null}
      </ScrollView>
    );
  } else if (query.trim()) {
    const key = TABS[tab][0];
    const waiting = term !== query.trim() || (results.loading && !results.data);
    const none = !waiting && !results.error && !people.length && !tags.length && !postHits.length;
    overlay = (
      <View style={{ flex: 1 }}>
        <SlideTabs tabs={TABS.map(([id, label]) => ({ key: id, label: t(label) }))} active={tab} onChange={setTab} height={42} style={{ marginBottom: 6 }} />
        <ScrollView key={key} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 30 }}>
          {waiting && !results.data ? <ActivityIndicator style={{ marginTop: 24 }} color={theme.text2} /> : null}
          {results.error && !results.data ? (
            <View style={{ alignItems: "center", gap: 10, paddingTop: 30 }}>
              <T size={14} color={theme.text2}>{t("Ricerca non riuscita.")}</T>
              <Btn title={t("Riprova")} height={30} style={{ paddingHorizontal: 16 }} onPress={results.refresh} />
            </View>
          ) : null}
          {none ? <IgEmpty icon={SearchIcon} title={t("Nessun risultato per «{query}»", { query: query.trim() })} text={t("Prova un altro nome o tag.")} /> : null}
          {key === "top" ? (
            <>
              {people.slice(0, 4).map((person) => accountRow(person))}
              {tags.slice(0, 3).map(tagRow)}
              {postHits.length ? <View style={{ marginTop: 10 }}><ExploreGrid posts={postHits} onOpen={(post) => openGridItem(post, postHits, t("Esplora"))} onPeek={setPeeked} /></View> : null}
            </>
          ) : null}
          {key === "accounts" ? (!none && !people.length && !waiting ? <IgEmpty title={t("Nessun account")} /> : people.map((person) => accountRow(person, true))) : null}
          {key === "tags" ? (!none && !tags.length && !waiting ? <IgEmpty icon={Hash} title={t("Nessun tag")} /> : tags.map(tagRow)) : null}
        </ScrollView>
      </View>
    );
  }

  let empty = null;
  if (explore.loading) empty = <ActivityIndicator style={{ marginTop: 60 }} color={theme.text2} />;
  else if (explore.error) {
    empty = (
      <View style={{ alignItems: "center", gap: 10, paddingTop: 60 }}>
        <T size={14} color={theme.text2}>{t("Impossibile caricare Esplora.")}</T>
        <Btn title={t("Riprova")} height={30} style={{ paddingHorizontal: 16 }} onPress={explore.refresh} />
      </View>
    );
  } else {
    empty = (
      <IgEmpty icon={SquarePlus} title={t("Ancora niente da esplorare. Pubblica il primo post!")}>
        <Btn title={t("Crea un post")} kind="primary" height={34} style={{ marginTop: 12, paddingHorizontal: 20 }} onPress={() => router.push("/create")} />
      </IgEmpty>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 6 }}>
      <SearchBar
        inputRef={inputRef}
        value={query}
        searching={searching}
        onChange={setQuery}
        onFocus={() => setFocus(true)}
        onSubmit={() => { if (query.trim()) store.rememberSearch({ key: `q:${query.trim().toLowerCase()}`, type: "query", label: query.trim() }); }}
        onClear={() => { setQuery(""); inputRef.current?.focus(); }}
        onCancel={leave}
      />
      <View style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          data={blocks}
          keyExtractor={(block) => block.key}
          renderItem={({ item }) => <ExploreBlock block={item} onOpen={openExplore} onPeek={setPeeked} />}
          ListEmptyComponent={empty}
          ListFooterComponent={explore.moreLoading ? <ActivityIndicator style={{ marginVertical: 18 }} color={theme.text2} /> : null}
          onEndReached={() => { if (!explore.done) explore.more(); }}
          onEndReachedThreshold={1.2}
          refreshing={explore.refreshing}
          onRefresh={explore.refresh}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
        />
        {overlay ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>{overlay}</View> : null}
      </View>
      <PeekCard post={peeked} />
    </View>
  );
}

// Profile picture, or the initial on a grey circle when there is none.
function Face({ src, name, size }) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill };
  if (src) return <Image source={{ uri: src }} style={box} contentFit="cover" transition={120} recyclingKey={src} />;
  return (
    <View style={[box, { alignItems: "center", justifyContent: "center" }]}>
      <T size={size * 0.4} weight="600" color={theme.text2}>{String(name || "?").trim().charAt(0).toUpperCase() || "?"}</T>
    </View>
  );
}

function SearchBar({ inputRef, value, searching, onChange, onFocus, onSubmit, onClear, onCancel }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: searching ? 1 : 0, useNativeDriver: false, damping: 24, stiffness: 260 }).start();
  }, [searching, anim]);
  return (
    <View style={styles.bar}>
      <View style={[styles.field, { backgroundColor: theme.fill }]}>
        <SearchIcon size={17} color={theme.text2} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onSubmitEditing={onSubmit}
          placeholder={t("Cerca")}
          placeholderTextColor={theme.text2}
          accessibilityLabel={t("Cerca persone o tag")}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={{ flex: 1, height: "100%", color: theme.text, fontSize: 15 }}
        />
        {value ? (
          <Pressable accessibilityLabel={t("Cancella")} hitSlop={8} onPress={onClear} style={[styles.clear, { backgroundColor: theme.text3 }]}>
            <X size={10} weight="bold" color={theme.bg} />
          </Pressable>
        ) : null}
      </View>
      <Animated.View style={{ overflow: "hidden", maxWidth: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }), marginLeft: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }), opacity: anim }}>
        <Pressable onPress={onCancel} hitSlop={6} disabled={!searching}>
          <T size={15} weight="500" lines={1}>{t("Annulla")}</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET, paddingBottom: 8 },
  field: { flex: 1, height: 36, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  clear: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 6, paddingHorizontal: INSET },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: INSET },
  rowOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7, paddingHorizontal: INSET },
  round: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  x: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  note: { paddingHorizontal: INSET, paddingTop: 8 },
});
