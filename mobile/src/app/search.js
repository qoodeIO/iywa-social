import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { EXPLORE_TOPICS, SHOPS, compact, euro, personByName } from "../data";
import { CITIES, SEARCH_PEOPLE, explorePool, hashtagsOf, openGridItem } from "../lib/profile-data";
import { Bag, ChevronLeft, Hash, MapPin, Search as SearchIcon, Verified, X } from "../ui/icons-profile";
import { Btn, T, tap } from "../ui/kit";
import { ExploreBlock, ExploreGrid, IgEmpty, PeekCard, SlideTabs, toBlocks } from "../ui/profile-kit";

const CARD = (Dimensions.get("window").width - INSET * 2 - 10) / 2;

const TABS = [["top", "Per te"], ["accounts", "Account"], ["shop", "Shop"], ["tags", "Tag"], ["places", "Luoghi"]];

export default function Search() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const params = useLocalSearchParams();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [topic, setTopic] = useState("all");
  const [tab, setTab] = useState(0);
  const [scope, setScope] = useState(null);
  const [limit, setLimit] = useState(30);
  const [peeked, setPeeked] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const needle = query.trim().toLowerCase().replace(/^[@#]/, "");
  const searching = focus || Boolean(query.trim());
  const follows = store.follows;

  // A #tag or @handle tapped elsewhere in the app lands here.
  useEffect(() => {
    if (!params.q) return;
    const value = String(params.q);
    if (value.startsWith("#")) {
      setScope({ type: "tag", value: value.slice(1).toLowerCase() });
      setQuery("");
    } else {
      setScope(null);
      setQuery(value);
    }
  }, [params.q, params.t]);

  const pool = useMemo(() => explorePool({ library: store.library || [], prefs: store.prefs }), [store.library, store.prefs]);

  // "Per te": a stable shuffle that changes on refresh, repeated so the grid never ends.
  const feed = useMemo(() => {
    const base = topic === "all" ? pool : pool.filter((post) => post.tag === topic || hashtagsOf(post.text).includes(topic.toLowerCase()));
    const rotated = base.map((post, index) => ({ post, rank: ((index + 1) * 7919 + seed * 104729) % 9973 })).sort((a, b) => a.rank - b.rank).map((entry) => entry.post);
    const loops = Math.max(1, Math.ceil(limit / Math.max(1, rotated.length)));
    const out = [];
    for (let loop = 0; loop < loops; loop += 1) out.push(...(loop % 2 ? [...rotated].reverse() : rotated));
    return out;
  }, [pool, topic, seed, limit]);
  const blocks = useMemo(() => toBlocks(feed, limit), [feed, limit]);

  const hidden = new Set([...(store.prefs.blocked || []), ...(store.prefs.muted || [])]);
  const people = SEARCH_PEOPLE.filter((person) => !hidden.has(person.name));
  const accountHits = needle ? people.filter((person) => `${person.name} ${person.handle} ${person.craft} ${person.city}`.toLowerCase().includes(needle)) : [];
  const tagCounts = useMemo(() => {
    const counts = new Map();
    for (const post of pool) for (const tag of new Set([...hashtagsOf(post.text), ...(post.tag ? [post.tag.toLowerCase()] : [])])) counts.set(tag, (counts.get(tag) || 0) + 1);
    return counts;
  }, [pool]);
  const tagHits = needle ? [...tagCounts.entries()].filter(([tag]) => tag.includes(needle)).sort((a, b) => b[1] - a[1]) : [];
  const placeHits = needle ? [...new Set([...CITIES, ...people.map((person) => person.city)])].filter((city) => city.toLowerCase().includes(needle)) : [];
  const postHits = needle ? pool.filter((post) => `${post.text || ""} ${post.name || ""} ${post.handle || ""} ${post.tag || ""} ${post.place || ""}`.toLowerCase().includes(needle)) : [];
  const placeCount = (city) => pool.filter((post) => post.place === city || personByName(post.name)?.city === city).length;
  const productHits = needle
    ? Object.entries(SHOPS).flatMap(([owner, shop]) => shop.products.map((product) => ({ owner, shop, product })))
      .filter(({ shop, product }) => `${product.name} ${product.category} ${product.description} ${shop.title} ${shop.city}`.toLowerCase().includes(needle))
    : [];

  const openPost = useCallback((post) => openGridItem(post), []);

  function openPerson(person) {
    store.rememberSearch({ key: `p:${person.handle}`, type: "account", label: person.handle, meta: person.name, src: person.src });
    router.push(`/person/${person.handle}`);
  }

  function openScope(next) {
    store.rememberSearch({ key: `${next.type}:${next.value}`, type: next.type, label: next.value });
    Keyboard.dismiss();
    setFocus(false);
    setScope(next);
  }

  function leave() {
    setQuery("");
    setFocus(false);
    setTab(0);
    inputRef.current?.blur();
  }

  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setSeed((value) => value + 1);
      setLimit(30);
      setRefreshing(false);
    }, 700);
  }

  function pickTopic(item) {
    setTopic(item);
    setLimit(30);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function openRecent(entry) {
    if (entry.type === "account") {
      const person = people.find((item) => item.handle === entry.label);
      if (person) openPerson(person);
      return;
    }
    if (entry.type === "tag" || entry.type === "place") {
      openScope({ type: entry.type, value: entry.label });
      return;
    }
    setQuery(entry.label);
  }

  const accountRow = (person, big = false) => {
    const on = follows.includes(person.name);
    const friend = SEARCH_PEOPLE.find((item) => item.name !== person.name && follows.includes(item.name));
    return (
      <View key={person.handle} style={styles.row}>
        <Pressable style={({ pressed }) => [styles.rowOpen, { opacity: pressed ? 0.6 : 1 }]} onPress={() => openPerson(person)}>
          <Image source={{ uri: person.src }} style={[styles.avatar, { backgroundColor: theme.fill }]} contentFit="cover" transition={120} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <T size={14} weight="600" lines={1} style={{ flexShrink: 1 }}>{person.handle}</T>
              {person.verified ? <Verified size={14} weight="fill" color={theme.blue} /> : null}
            </View>
            <T size={14} color={theme.text2} lines={1}>{person.name} · {friend ? `Seguito da ${friend.handle}` : `${compact(person.followers)} follower`}</T>
          </View>
        </Pressable>
        {big ? <Btn title={on ? "Segui già" : "Segui"} kind={on ? "gray" : "primary"} height={30} style={{ paddingHorizontal: 16 }} onPress={() => store.toggleFollow(person.name)} /> : null}
      </View>
    );
  };

  const line = (key, Icon, title, meta, onPress) => (
    <Pressable key={key} style={({ pressed }) => [styles.line, { opacity: pressed ? 0.6 : 1 }]} onPress={onPress}>
      <View style={[styles.round, { borderColor: theme.line }]}><Icon size={22} color={theme.text} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <T size={14} weight="600" lines={1}>{title}</T>
        <T size={14} color={theme.text2} lines={1}>{meta}</T>
      </View>
    </Pressable>
  );

  let overlay = null;
  if (scope) {
    const matches = scope.type === "tag"
      ? pool.filter((post) => hashtagsOf(post.text).includes(scope.value) || post.tag?.toLowerCase() === scope.value)
      : pool.filter((post) => post.place === scope.value || personByName(post.name)?.city === scope.value);
    const cover = matches[0]?.image;
    const followTag = follows.includes(`#${scope.value}`);
    overlay = (
      <ScrollView key={`scope-${scope.type}-${scope.value}`} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.scopeHead}>
          {scope.type === "tag" ? (
            <View style={[styles.scopeFace, { backgroundColor: theme.fill }]}>
              {cover ? <Image source={{ uri: cover }} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} contentFit="cover" /> : null}
              {cover ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)" }]} /> : null}
              <Hash size={34} weight="bold" color={cover ? "#fff" : theme.text} />
            </View>
          ) : (
            <LinearGradient colors={["#ff7a59", "#e1306c", "#833ab4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scopeFace}>
              <MapPin size={34} weight="fill" color="#fff" />
            </LinearGradient>
          )}
          <View style={{ alignItems: "flex-start", gap: 3, flex: 1 }}>
            <T size={20} weight="700" style={{ letterSpacing: -0.4 }}>{scope.type === "tag" ? `#${scope.value}` : scope.value}</T>
            <T size={14} color={theme.text2}>{matches.length} post</T>
            {scope.type === "tag" ? (
              <Btn title={followTag ? "Segui già" : "Segui"} kind={followTag ? "gray" : "primary"} height={30} style={{ marginTop: 6, paddingHorizontal: 26 }} onPress={() => store.toggleFollow(`#${scope.value}`)} />
            ) : <T size={13} color={theme.text2}>Italia</T>}
          </View>
        </View>
        <View style={[styles.scopeTabs, { borderBottomColor: theme.line }]}>
          <View style={[styles.scopeTab, { borderBottomWidth: 1, borderBottomColor: theme.text }]}><T size={14} weight="600">Più popolari</T></View>
          <Pressable style={styles.scopeTab} onPress={() => setSeed((value) => value + 1)}><T size={14} weight="600" color={theme.text2}>Recenti</T></Pressable>
        </View>
        {matches.length ? <ExploreGrid posts={matches} onOpen={openPost} onPeek={setPeeked} limit={60} /> : <IgEmpty icon={Hash} title="Ancora nessun post" />}
      </ScrollView>
    );
  } else if (searching && !needle) {
    const recents = store.recentSearches || [];
    overlay = (
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 30 }}>
        {recents.length ? (
          <>
            <View style={styles.head}>
              <T size={16} weight="700">Recenti</T>
              <Pressable hitSlop={8} onPress={() => { tap(); store.forgetSearch(); }}><T size={14} weight="600" color={theme.blue}>Cancella tutto</T></Pressable>
            </View>
            {recents.map((entry) => (
              <View key={entry.key} style={styles.row}>
                <Pressable style={({ pressed }) => [styles.rowOpen, { opacity: pressed ? 0.6 : 1 }]} onPress={() => openRecent(entry)}>
                  {entry.type === "account" ? (
                    <Image source={{ uri: entry.src }} style={[styles.avatar, { backgroundColor: theme.fill }]} contentFit="cover" />
                  ) : (
                    <View style={[styles.round, { borderColor: theme.line }]}>
                      {entry.type === "tag" ? <Hash size={22} color={theme.text} /> : entry.type === "place" ? <MapPin size={22} color={theme.text} /> : <SearchIcon size={22} color={theme.text} />}
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={14} weight="600" lines={1}>{entry.type === "tag" ? `#${entry.label}` : entry.label}</T>
                    {entry.meta ? <T size={14} color={theme.text2} lines={1}>{entry.meta}</T> : entry.type === "place" ? <T size={14} color={theme.text2}>Luogo</T> : null}
                  </View>
                </Pressable>
                <Pressable accessibilityLabel="Rimuovi" hitSlop={6} style={styles.x} onPress={() => store.forgetSearch(entry.key)}><X size={18} color={theme.text2} /></Pressable>
              </View>
            ))}
          </>
        ) : null}
        <View style={styles.head}><T size={16} weight="700">Suggeriti per te</T></View>
        {people.filter((person) => !follows.includes(person.name)).slice(0, 6).map((person) => accountRow(person, true))}
      </ScrollView>
    );
  } else if (needle) {
    const key = TABS[tab][0];
    const none = !accountHits.length && !tagHits.length && !placeHits.length && !postHits.length && !productHits.length;
    overlay = (
      <View style={{ flex: 1 }}>
        <SlideTabs tabs={TABS.map(([id, label]) => ({ key: id, label }))} active={tab} onChange={setTab} height={42} style={{ marginBottom: 6 }} />
        <ScrollView key={key} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 30 }}>
          {none ? <IgEmpty icon={SearchIcon} title={`Nessun risultato per «${query.trim()}»`} text="Prova un altro nome, luogo o tag." /> : null}
          {key === "top" ? (
            <>
              {accountHits.slice(0, 3).map((person) => accountRow(person))}
              {tagHits.slice(0, 2).map(([tag, count]) => line(tag, Hash, `#${tag}`, `${count} post`, () => openScope({ type: "tag", value: tag })))}
              {placeHits.slice(0, 1).map((city) => line(city, MapPin, city, `${placeCount(city)} post`, () => openScope({ type: "place", value: city })))}
              {postHits.length ? <View style={{ marginTop: 10 }}><ExploreGrid posts={postHits} onOpen={openPost} onPeek={setPeeked} limit={30} /></View> : null}
            </>
          ) : null}
          {key === "accounts" ? accountHits.map((person) => accountRow(person, true)) : null}
          {key === "shop" ? (
            productHits.length ? (
              <View style={styles.shopGrid}>
                {productHits.map(({ owner, shop, product }) => (
                  <Pressable key={`${owner}-${product.id}`} style={({ pressed }) => [styles.shopCard, { transform: [{ scale: pressed ? 0.97 : 1 }] }]} onPress={() => router.push(`/product/${encodeURIComponent(owner)}/${product.id}`)}>
                    <Image source={{ uri: product.images[0] }} recyclingKey={product.images[0]} style={[styles.shopPic, { backgroundColor: theme.fill }]} contentFit="cover" transition={120} />
                    <T size={14} weight="600" lines={1}>{product.name}</T>
                    <T size={14} weight="700" lines={1}>{euro(product.price)} · {shop.title}</T>
                  </Pressable>
                ))}
              </View>
            ) : <IgEmpty icon={Bag} title="Nessun prodotto" />
          ) : null}
          {key === "tags" ? tagHits.map(([tag, count]) => line(tag, Hash, `#${tag}`, `${count} post`, () => openScope({ type: "tag", value: tag }))) : null}
          {key === "places" ? placeHits.map((city) => line(city, MapPin, city, `${placeCount(city)} post · Italia`, () => openScope({ type: "place", value: city }))) : null}
        </ScrollView>
      </View>
    );
  }

  const header = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
      {["all", ...EXPLORE_TOPICS].map((item) => {
        const on = topic === item;
        return (
          <Pressable key={item} onPress={() => { tap(); pickTopic(item); }} style={({ pressed }) => [styles.topic, { borderColor: on ? theme.text : theme.line, backgroundColor: on ? theme.text : "transparent", transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <T size={14} weight="600" color={on ? theme.bg : theme.text}>{item === "all" ? "Per te" : item}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 6 }}>
      <SearchBar
        inputRef={inputRef}
        value={scope ? (scope.type === "tag" ? `#${scope.value}` : scope.value) : query}
        scope={scope}
        searching={searching}
        onBack={() => setScope(null)}
        onChange={(value) => { setScope(null); setQuery(value); }}
        onFocus={() => {
          if (scope) {
            setQuery(scope.type === "tag" ? `#${scope.value}` : scope.value);
            setScope(null);
          }
          setFocus(true);
        }}
        onSubmit={() => { if (query.trim()) store.rememberSearch({ key: `q:${query.trim().toLowerCase()}`, type: "query", label: query.trim() }); }}
        onClear={() => { setQuery(""); inputRef.current?.focus(); }}
        onCancel={leave}
      />
      <View style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          data={blocks}
          keyExtractor={(block) => block.key}
          renderItem={({ item }) => <ExploreBlock block={item} onOpen={openPost} onPeek={setPeeked} />}
          ListHeaderComponent={header}
          onEndReached={() => setLimit((value) => Math.min(value + 15, 240))}
          onEndReachedThreshold={1.2}
          refreshing={refreshing}
          onRefresh={refresh}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
          extraData={topic}
        />
        {overlay ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>{overlay}</View> : null}
      </View>
      <PeekCard post={peeked} />
    </View>
  );
}

function SearchBar({ inputRef, value, scope, searching, onBack, onChange, onFocus, onSubmit, onClear, onCancel }) {
  const theme = useTheme();
  const show = searching && !scope;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: show ? 1 : 0, useNativeDriver: false, damping: 24, stiffness: 260 }).start();
  }, [show, anim]);
  return (
    <View style={styles.bar}>
      {scope ? (
        <Pressable accessibilityLabel="Indietro" hitSlop={8} onPress={onBack} style={{ marginLeft: -6, width: 28, height: 36, alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} weight="bold" color={theme.text} />
        </Pressable>
      ) : null}
      <View style={[styles.field, { backgroundColor: theme.fill }]}>
        <SearchIcon size={17} color={theme.text2} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onSubmitEditing={onSubmit}
          placeholder="Cerca"
          placeholderTextColor={theme.text2}
          accessibilityLabel="Cerca persone, tag o luoghi"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={{ flex: 1, height: "100%", color: theme.text, fontSize: 15 }}
        />
        {value && !scope ? (
          <Pressable accessibilityLabel="Cancella" hitSlop={8} onPress={onClear} style={[styles.clear, { backgroundColor: theme.text3 }]}>
            <X size={10} weight="bold" color={theme.bg} />
          </Pressable>
        ) : null}
      </View>
      <Animated.View style={{ overflow: "hidden", maxWidth: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }), marginLeft: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }), opacity: anim }}>
        <Pressable onPress={onCancel} hitSlop={6} disabled={!show}>
          <T size={15} weight="500" lines={1}>Annulla</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET, paddingBottom: 8 },
  field: { flex: 1, height: 36, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  clear: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  topics: { gap: 8, paddingHorizontal: INSET, paddingTop: 2, paddingBottom: 10 },
  topic: { height: 32, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 6, paddingHorizontal: INSET },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: INSET },
  rowOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7, paddingHorizontal: INSET },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  round: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  x: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  scopeHead: { flexDirection: "row", alignItems: "center", gap: 18, paddingTop: 8, paddingBottom: 14, paddingHorizontal: INSET },
  scopeFace: { width: 84, height: 84, borderRadius: 42, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  scopeTabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 2 },
  scopeTab: { flex: 1, height: 42, alignItems: "center", justifyContent: "center" },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 12, paddingHorizontal: INSET, paddingTop: 10 },
  shopCard: { width: CARD, gap: 3 },
  shopPic: { width: "100%", aspectRatio: 1, borderRadius: 14, marginBottom: 5 },
});
