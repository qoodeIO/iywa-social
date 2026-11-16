// Profiles: your own (web Profile) and someone else's (web PersonScreen), with the business
// card, the professional dashboard, the shop grid, sticky tabs and swipe between boards.
import { memo, useCallback, useMemo, useState } from "react";
import { Dimensions, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, FadeInDown, FadeOutUp } from "react-native-reanimated";
import { GestureDetector, ScrollView as GHScrollView, usePanGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR, EXPLORE, POSTS, REELS, SHOPS, compact, euro, personByName, stockLabel } from "../data";
import { CONTACTS, MEET, SEARCH_PEOPLE, daysLabel, openGridItem, openState, useCountUp } from "../lib/profile-data";
import { mineDeck, useHighlightDecks, useStoryDecks } from "../lib/stories";
import {
  Archive, AtSign, Bag, Camera, Carousel, ChevronDown, Directions, Feather, Heart, LayoutGrid, LinkIcon, Mail, MapPin,
  MessageCircle, Phone, Pin, Play, Plus, Send, SquarePlay, UserMinus, UserPlus, X,
} from "./icons-profile";
import { Btn, T, tap } from "./kit";
import { ActionSheet, IgEmpty, SlideTabs, useToast } from "./profile-kit";
import { RichText, ThoughtEntry, composeThought, thoughtRows } from "./thoughts";

const W = Dimensions.get("window").width;
const TILE = (W - 4) / 3;

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------
export function useShop(name) {
  const store = useStore();
  if (!name || name === store.profile.name) {
    if (store.accountType !== "business" || store.business?.shop === false) return null;
    return { ...store.business, mine: true, owner: { name: store.profile.name, handle: String(store.profile.handle || "").replace(/^@/, ""), src: store.profile.src }, products: store.myProducts };
  }
  const shop = SHOPS[name];
  if (!shop) return null;
  const person = personByName(name);
  return { ...shop, owner: { name, handle: person?.handle || name, src: person?.src } };
}

export function BusinessCard({ shop }) {
  const theme = useTheme();
  const [note, setNote] = useState("");
  const state = openState(shop.hours);
  const place = `${shop.address}, ${shop.city}`;
  const maps = Platform.OS === "ios" ? `http://maps.apple.com/?q=${encodeURIComponent(place)}` : `https://maps.google.com/?q=${encodeURIComponent(place)}`;
  function flash(text) {
    setNote(text);
    setTimeout(() => setNote(""), 1600);
  }
  function open(url, copy, label) {
    Linking.openURL(url).catch(() => {
      Clipboard.setStringAsync(copy).catch(() => {});
      flash(label);
    });
  }
  return (
    <View style={{ gap: 3, paddingTop: 2, paddingHorizontal: INSET }}>
      <Pressable onPress={() => Linking.openURL(maps).catch(() => {})} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <MapPin size={14} weight="fill" color={theme.text2} />
        <T size={14} weight="500" lines={1} style={{ flexShrink: 1 }}>{place}</T>
      </Pressable>
      {state ? (
        <T size={14} color={theme.text2}>
          <T size={14} weight="600" color={state.open ? "#1cd14f" : theme.text2}>{state.open ? "Aperto ora" : "Chiuso"}</T>
          {" · "}{daysLabel(shop.hours.days)} {shop.hours.open}–{shop.hours.close}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: 6, paddingTop: 12 }}>
        <Btn title="Chiama" icon={Phone} size={14} height={32} flex={1} onPress={() => open(`tel:${String(shop.phone).replace(/\s/g, "")}`, shop.phone, "Numero copiato")} />
        <Btn title="Indicazioni" icon={Directions} size={14} height={32} flex={1} onPress={() => Linking.openURL(maps).catch(() => {})} />
        <Btn title="Email" icon={Mail} size={14} height={32} flex={1} onPress={() => open(`mailto:${shop.email}`, shop.email, "Email copiata")} />
      </View>
      {note ? <T size={12.5} color={theme.text2} style={{ textAlign: "center", marginTop: 6 }}>{note}</T> : null}
    </View>
  );
}

export function BusinessInsights() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.dash, { backgroundColor: theme.btn }]}>
      <Pressable accessibilityState={{ expanded: open }} onPress={() => { tap(); setOpen((value) => !value); }} style={styles.dashRow}>
        <View style={{ flex: 1 }}>
          <T size={14} weight="600">Dashboard professionale</T>
          <T size={12.5} color={theme.text2}>12,4k account raggiunti negli ultimi 30 giorni</T>
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}><ChevronDown size={14} weight="bold" color={theme.text2} /></View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          {[["Account raggiunti", "12.412", "+18%"], ["Visite al profilo", "486", "+9%"], ["Richieste dello shop nel Direct", "37", "+24%"]].map(([label, value, delta]) => (
            <View key={label} style={[styles.stat, { borderTopColor: theme.line }]}>
              <T size={13.5} style={{ flex: 1 }}>{label}</T>
              <T size={13.5} weight="700">{value}</T>
              <T size={12} weight="600" color="#1cd14f">{delta}</T>
            </View>
          ))}
          <T size={11.5} color={theme.text3} style={{ marginTop: 4 }}>Dati di esempio per l'anteprima.</T>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function ShopGrid({ shop, onOpen, onAdd }) {
  const theme = useTheme();
  const [cat, setCat] = useState("all");
  const cats = [...new Set(shop.products.map((product) => product.category).filter(Boolean))];
  const list = shop.products.filter((product) => cat === "all" || product.category === cat);
  const width = (W - INSET * 2 - 10) / 2;
  return (
    <View>
      {cats.length > 1 ? (
        <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10, paddingBottom: 4, paddingHorizontal: INSET }}>
          {["all", ...cats].map((item) => {
            const on = cat === item;
            return (
              <Pressable key={item} onPress={() => { tap(); setCat(item); }} style={[styles.cat, { backgroundColor: on ? theme.text : "transparent", borderColor: on ? theme.text : theme.line }]}>
                <T size={13} weight="600" color={on ? theme.bg : theme.text}>{item === "all" ? "Tutti" : item}</T>
              </Pressable>
            );
          })}
        </GHScrollView>
      ) : null}
      <View style={styles.shopGrid}>
        {shop.mine && onAdd ? (
          <Pressable onPress={onAdd} style={({ pressed }) => [styles.shopAdd, { width, height: width, borderColor: "rgba(0,149,246,0.55)", backgroundColor: "rgba(0,149,246,0.06)", transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <View style={[styles.shopAddIcon, { backgroundColor: theme.blue }]}><Plus size={22} color="#fff" /></View>
            <T size={14} weight="600">Aggiungi prodotto</T>
            <T size={13} color={theme.text2}>Foto, prezzo, pezzi</T>
          </Pressable>
        ) : null}
        {list.map((product) => {
          const stock = stockLabel(product);
          return (
            <Pressable key={product.id} onPress={() => onOpen(product)} style={({ pressed }) => [{ width, gap: 3 }, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <View style={[styles.shopPic, { backgroundColor: theme.fill }]}>
                <Image source={{ uri: product.images[0] }} recyclingKey={product.images[0]} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                {product.images.length > 1 ? <View style={styles.badge}><Carousel size={18} weight="fill" color="#fff" /></View> : null}
                {stock.tone !== "ok" ? (
                  <View style={[styles.flag, { backgroundColor: stock.tone === "low" ? "rgba(255,159,10,0.92)" : stock.tone === "order" ? "rgba(94,92,230,0.92)" : stock.tone === "out" ? "rgba(60,60,67,0.85)" : "rgba(0,0,0,0.6)" }]}>
                    <T size={11} weight="700" color="#fff">{stock.text}</T>
                  </View>
                ) : null}
              </View>
              <T size={14} weight="600" lines={1}>{product.name}</T>
              <T size={14} weight="700" lines={1}>{euro(product.price)}</T>
            </Pressable>
          );
        })}
      </View>
      {!list.length && !shop.mine ? <IgEmpty icon={Bag} title="Ancora nessun prodotto" /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Grid rows (virtualized by FlashList)
// ---------------------------------------------------------------------------
const GridRow = memo(function GridRow({ items, tall, pinned, kindMark, reelMark, onOpen, onPeek }) {
  const theme = useTheme();
  const height = tall ? TILE * (16 / 9) : TILE * (4 / 3);
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
      {items.map((post) => (
        <Pressable
          key={post.id}
          accessibilityLabel={`Apri ${post.kind || "post"}, ${post.name}`}
          onPress={() => onOpen(post)}
          onLongPress={onPeek ? () => { tap("medium"); onPeek(post); } : undefined}
          delayLongPress={380}
          style={({ pressed }) => ({ width: TILE, height, backgroundColor: theme.fill, opacity: pressed ? 0.85 : 1 })}
        >
          <Image source={{ uri: post.image || post.src }} recyclingKey={post.image || post.src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          {pinned?.includes(post.id) ? <View style={[styles.badge, { transform: [{ rotate: "45deg" }] }]}><Pin size={17} weight="fill" color="#fff" /></View> : null}
          {!pinned?.includes(post.id) && kindMark && post.kind === "reel" ? <View style={styles.badge}><SquarePlay size={17} weight="fill" color="#fff" /></View> : null}
          {!kindMark && !reelMark && post.images?.length > 1 ? <View style={styles.badge}><Carousel size={18} weight="fill" color="#fff" /></View> : null}
          {reelMark ? (
            <View style={styles.mark}>
              <Play size={12} weight="fill" color="#fff" />
              <T size={12} weight="600" color="#fff" style={styles.shadow}>{post.likes || "0"}</T>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
});

function rowsOf(list, tall, extra = {}) {
  const rows = [];
  for (let i = 0; i < list.length; i += 3) rows.push({ type: tall ? "tallrow" : "row", key: `r-${i}-${list[i].id}`, items: list.slice(i, i + 3), tall, ...extra });
  return rows;
}

// Swipe left or right on the boards to change tab, like the web pager.
function useBoardSwipe(onSwipe) {
  return usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-12, 12],
    onDeactivate: (event) => {
      "worklet";
      if (Math.abs(event.translationX) > 70 || Math.abs(event.velocityX) > 650) scheduleOnRN(onSwipe, event.translationX < 0 ? 1 : -1);
    },
  });
}

function ProfileList({ header, tabs, board, setBoard, items, renderBoard }) {
  const theme = useTheme();
  const swipe = useCallback((dir) => setBoard((value) => Math.max(0, Math.min(tabs.length - 1, value + dir))), [setBoard, tabs.length]);
  const pan = useBoardSwipe(swipe);
  const data = useMemo(() => [{ type: "head", key: "head" }, { type: "tabs", key: "tabs" }, ...items], [items]);
  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>
        <FlashList
          data={data}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.type}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          extraData={header}
          renderItem={({ item }) => {
            if (item.type === "head") return header;
            if (item.type === "tabs") return <SlideTabs tabs={tabs} active={board} onChange={setBoard} height={46} iconSize={24} dim="text3" style={{ backgroundColor: theme.bg }} />;
            return renderBoard(item);
          }}
        />
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Your profile
// ---------------------------------------------------------------------------
export function MyProfile() {
  const theme = useTheme();
  const store = useStore();
  const profile = store.profile;
  const [board, setBoard] = useState(0);
  const [discover, setDiscover] = useState(false);
  const [dismissed, setDismissed] = useState([]);
  const [peek, setPeek] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, say] = useToast();
  const decks = useStoryDecks();
  const highlights = useHighlightDecks();
  const myDeck = mineDeck(decks);
  const pinned = store.pinned || [];
  const archived = store.archived || [];
  const shop = useShop(null);
  const library = store.library || [];

  const grid = useMemo(() => {
    const list = [...library.filter((item) => item.kind === "post" && (item.image || item.images?.[0])).map((item) => ({ ...item, image: item.image || item.images[0] })), ...POSTS.filter((item) => item.mine && item.image)].filter((item) => !archived.includes(item.id));
    return [...list].sort((x, y) => Number(pinned.includes(y.id)) - Number(pinned.includes(x.id)));
  }, [library, archived, pinned]);
  const reels = useMemo(() => [
    ...library.filter((item) => item.kind === "reel").map((item) => ({ ...item, image: item.image || item.src || item.poster })),
    ...REELS.filter((item) => item.name === profile.name || item.name === "Giulia Neri").map((item) => ({ ...item, image: item.image || item.src, kind: "reel" })),
  ].filter((item) => !archived.includes(item.id) && item.image), [library, archived, profile.name]);
  const tagged = POSTS.filter((item) => item.tagged);
  const boards = shop ? ["posts", "reels", "shop", "thoughts", "tagged"] : ["posts", "reels", "thoughts", "tagged"];
  const tabs = [
    { key: "posts", label: "Post", icon: LayoutGrid },
    { key: "reels", label: "Reels", icon: SquarePlay },
    ...(shop ? [{ key: "shop", label: "Shop", icon: Bag }] : []),
    { key: "thoughts", label: "Pensieri", icon: Feather },
    { key: "tagged", label: "Tag", icon: AtSign },
  ];
  const current = boards[Math.min(board, boards.length - 1)];
  const posts = useCountUp(grid.length);
  const followers = useCountUp(CONTACTS.length * 137 + 4);
  const following = useCountUp(store.follows.length);
  const suggestions = MEET.filter((person) => !store.follows.includes(person.name) && !dismissed.includes(person.name) && !(store.prefs.blocked || []).includes(person.name));
  const unseen = myDeck ? myDeck.frames.some((frame) => !store.seenStories.includes(frame.id)) : false;
  const rows = useMemo(() => thoughtRows(store, { mine: true }), [store.myThoughts, store.thoughtReplies, store.reposts, store.repostAt, store.profile, store.prefs]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    if (current === "shop") return [{ type: "shop", key: "shop" }];
    if (current === "thoughts") return rows.length ? rows.map((row) => ({ type: "thought", key: row.key, row })) : [{ type: "empty", key: "empty-thoughts" }];
    const list = current === "posts" ? grid : current === "reels" ? reels : tagged;
    return list.length ? rowsOf(list, current === "reels", { board: current }) : [{ type: "empty", key: `empty-${current}` }];
  }, [current, grid, reels, tagged, rows]);

  const openTile = useCallback((post) => openGridItem(post.kind === "reel" ? { ...post, reelId: post.reelId || post.id } : post), []);

  const header = (
    <View>
      <View style={styles.head}>
        <View>
          <Pressable onPress={() => { setNoteDraft(profile.note || ""); setNoteOpen(true); }} style={[styles.note, { backgroundColor: theme.fill }]}>
            {profile.note ? <T size={11.5} lines={2}>{profile.note}</T> : <T size={11.5} color={theme.text2}>Nota…</T>}
            <View style={[styles.noteTail, { backgroundColor: theme.fill }]} />
          </Pressable>
          <Pressable
            accessibilityLabel={myDeck ? "Apri la tua storia" : "Aggiungi alla storia"}
            onPress={() => (myDeck ? router.push(`/story/${myDeck.id}`) : router.push("/story/new"))}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            {myDeck ? (
              unseen ? (
                <LinearGradient colors={["#ffb800", "#ff2d55", "#c013d1"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.ring}>
                  <Image source={{ uri: profile.src || AVATAR }} style={[styles.ringFace, { borderColor: theme.bg }]} />
                </LinearGradient>
              ) : (
                <View style={[styles.ring, { backgroundColor: theme.line }]}><Image source={{ uri: profile.src || AVATAR }} style={[styles.ringFace, { borderColor: theme.bg }]} /></View>
              )
            ) : <Image source={{ uri: profile.src || AVATAR }} style={styles.face} contentFit="cover" />}
          </Pressable>
          <Pressable accessibilityLabel="Nuova storia" hitSlop={6} onPress={() => router.push("/story/new")} style={[styles.add, { backgroundColor: theme.text, borderColor: theme.bg }]}>
            <Plus size={12} weight="bold" color={theme.bg} />
          </Pressable>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <T size={15} weight="600" lines={1} style={{ flexShrink: 1 }}>{profile.name}</T>
            {profile.pronouns ? <T size={13} color={theme.text2}>{profile.pronouns}</T> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 22 }}>
            <StatButton value={compact(posts)} label="post" onPress={() => setBoard(0)} />
            <StatButton value={compact(followers)} label="follower" onPress={() => router.push("/people/followers")} />
            <StatButton value={compact(following)} label="seguiti" onPress={() => router.push("/people/following")} />
          </View>
        </View>
      </View>
      <View style={{ paddingTop: 10, paddingHorizontal: INSET }}>
        {profile.category ? <T size={14} color={theme.text2}>{profile.category}</T> : null}
        {profile.bio ? <RichText text={profile.bio} size={14} style={{ marginTop: 2, lineHeight: 19 }} /> : null}
        {profile.link ? (
          <Pressable onPress={() => Linking.openURL(profile.link.startsWith("http") ? profile.link : `https://${profile.link}`).catch(() => {})} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
            <View style={{ transform: [{ rotate: "-45deg" }] }}><LinkIcon size={15} weight="bold" color={theme.scheme === "dark" ? "#4f8ff7" : "#00376b"} /></View>
            <T size={14} weight="600" color={theme.scheme === "dark" ? "#4f8ff7" : "#00376b"}>{profile.link.replace(/^https?:\/\//, "")}</T>
          </Pressable>
        ) : null}
      </View>
      {shop ? (
        <View style={{ paddingTop: 6 }}>
          <BusinessCard shop={shop} />
          <BusinessInsights />
        </View>
      ) : null}
      <View style={styles.buttons}>
        <Btn title="Modifica profilo" flex={1} height={32} onPress={() => router.push("/edit-profile")} />
        <Btn title="Condividi profilo" flex={1} height={32} onPress={() => router.push("/qr")} />
        <Pressable accessibilityLabel="Scopri persone" accessibilityState={{ selected: discover }} onPress={() => { tap(); setDiscover((value) => !value); }} style={({ pressed }) => [styles.square, { backgroundColor: discover ? theme.text : theme.btn, opacity: pressed ? 0.7 : 1 }]}>
          <UserPlus size={17} weight={discover ? "fill" : "regular"} color={discover ? theme.bg : theme.text} />
        </Pressable>
      </View>
      {discover ? (
        <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(200)}>
          <View style={styles.discoverHead}>
            <T size={14} weight="600">Scopri persone</T>
            <Pressable onPress={() => say("Altri suggerimenti a breve")}><T size={14} color={theme.scheme === "dark" ? "#4f8ff7" : "#00376b"}>Vedi tutti</T></Pressable>
          </View>
          <GHScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={{ gap: 8, paddingHorizontal: INSET, paddingBottom: 8 }}>
            {suggestions.map((person) => (
              <View key={person.name} style={[styles.suggest, { borderColor: theme.line }]}>
                <Pressable accessibilityLabel="Ignora" hitSlop={6} style={styles.suggestX} onPress={() => setDismissed((prev) => [...prev, person.name])}><X size={14} color={theme.text2} /></Pressable>
                <Image source={{ uri: person.src }} style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: theme.fill }} contentFit="cover" />
                <T size={13.5} weight="600" lines={1} style={{ marginTop: 8 }}>{person.name}</T>
                <T size={12} color={theme.text2} lines={1}>{person.meta}</T>
                <Btn title="Segui" kind="primary" height={30} style={{ alignSelf: "stretch", marginTop: 10 }} onPress={() => store.toggleFollow(person.name)} />
              </View>
            ))}
            {suggestions.length === 0 ? <T size={13} color={theme.text2} style={{ paddingVertical: 20 }}>Segui già tutti i suggeriti.</T> : null}
          </GHScrollView>
        </Animated.View>
      ) : null}
      <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
        <Pressable onPress={() => router.push("/story/highlight")} style={({ pressed }) => [styles.highlight, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <View style={[styles.hlRing, { borderColor: theme.line, alignItems: "center", justifyContent: "center" }]}><Plus size={26} weight="light" color={theme.text} /></View>
          <T size={12} lines={1}>Nuovo</T>
        </Pressable>
        {highlights.map((item) => (
          <Pressable key={item.id} onPress={() => router.push(`/story/${item.id}`)} style={({ pressed }) => [styles.highlight, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
            <View style={[styles.hlRing, { borderColor: theme.line }]}><Image source={{ uri: item.src }} style={{ width: "100%", height: "100%", borderRadius: 33 }} contentFit="cover" /></View>
            <T size={12} lines={1}>{item.name}</T>
          </Pressable>
        ))}
      </GHScrollView>
    </View>
  );

  function renderBoard(item) {
    if (item.type === "row" || item.type === "tallrow") {
      return <GridRow items={item.items} tall={item.tall} pinned={item.board === "posts" ? pinned : null} kindMark={item.board === "posts"} reelMark={item.board === "reels"} onOpen={openTile} onPeek={(post) => setPeek({ post, board: item.board })} />;
    }
    if (item.type === "thought") return <ThoughtEntry thought={item.row.thought} repostedBy={item.row.repost ? "Hai ripubblicato" : undefined} />;
    if (item.type === "shop") return <ShopGrid shop={shop} onOpen={(product) => router.push(`/product/me/${product.id}`)} onAdd={() => router.push("/product-edit/new")} />;
    if (current === "thoughts") {
      return (
        <IgEmpty icon={Feather} title="Condividi il tuo primo pensiero" text="Una frase, una domanda, un sondaggio.">
          <Btn title="Scrivi un pensiero" kind="primary" height={30} style={{ marginTop: 8, paddingHorizontal: 16 }} onPress={() => composeThought()} />
        </IgEmpty>
      );
    }
    if (current === "tagged") return <IgEmpty icon={AtSign} title="Foto e video in cui sei taggato" text="Quando qualcuno ti tagga, appariranno qui." />;
    return <IgEmpty icon={current === "reels" ? SquarePlay : Camera} title={current === "reels" ? "Condividi il tuo primo reel" : "Condividi il tuo primo post"} text="Apparirà sul tuo profilo." />;
  }

  const peekPost = peek?.post;
  const liked = peekPost ? store.likes.includes(peekPost.id) : false;
  return (
    <View style={{ flex: 1 }}>
      <ProfileList header={header} tabs={tabs} board={Math.min(board, boards.length - 1)} setBoard={setBoard} items={items} renderBoard={renderBoard} />
      <Modal visible={Boolean(peekPost)} transparent animationType="fade" onRequestClose={() => setPeek(null)} statusBarTranslucent>
        <Pressable style={styles.peekBack} onPress={() => setPeek(null)}>
          {peekPost ? (
            <Animated.View entering={FadeIn.duration(180)} style={[styles.peek, { backgroundColor: theme.scheme === "dark" ? "#262626" : "#fff" }]}>
              <Pressable>
                <View style={styles.peekHead}>
                  <Image source={{ uri: peekPost.avatar || profile.src || AVATAR }} style={{ width: 30, height: 30, borderRadius: 15 }} />
                  <T size={14} weight="600">{String(peekPost.handle || profile.handle || peekPost.name).replace(/^@/, "")}</T>
                </View>
                <Image source={{ uri: peekPost.image || peekPost.src }} style={{ width: "100%", aspectRatio: 4 / 5 }} contentFit="cover" />
                <View style={[styles.peekActions, { borderTopColor: theme.line }]}>
                  <PeekAction icon={Heart} label="Mi piace" on={liked} onPress={() => store.toggleLike(peekPost.id)} />
                  <PeekAction icon={MessageCircle} label="Apri" onPress={() => { setPeek(null); openTile(peekPost); }} />
                  {peek.board === "posts" ? (
                    <PeekAction icon={Pin} label={pinned.includes(peekPost.id) ? "Togli" : "Fissa"} on={pinned.includes(peekPost.id)} tone="text" onPress={() => { store.togglePin(peekPost.id); say(pinned.includes(peekPost.id) ? "Rimosso dai fissati" : "Fissato sul profilo"); setPeek(null); }} />
                  ) : null}
                  <PeekAction icon={Archive} label="Archivia" onPress={() => { store.toggleArchive(peekPost.id); setPeek(null); say("Archiviato"); }} />
                </View>
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
      <NoteSheet
        open={noteOpen}
        draft={noteDraft}
        setDraft={setNoteDraft}
        src={profile.src || AVATAR}
        hasNote={Boolean(profile.note)}
        onClose={() => setNoteOpen(false)}
        onDelete={() => { store.setProfile({ note: "" }); setNoteOpen(false); }}
        onShare={() => { store.setProfile({ note: noteDraft.trim() }); setNoteOpen(false); say("Nota condivisa"); }}
      />
      {toast}
    </View>
  );
}

function NoteSheet({ open, draft, setDraft, src, hasNote, onClose, onDelete, onShare }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} onPress={onClose} />
        <View style={[styles.noteSheet, { backgroundColor: theme.scheme === "dark" ? "#1c1c1e" : theme.bg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grab, { backgroundColor: theme.line }]} />
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={[styles.noteBubble, { backgroundColor: theme.fill }]}><T size={13} color={draft ? theme.text : theme.text2}>{draft || "Condividi un pensiero…"}</T></View>
            <Image source={{ uri: src }} style={{ width: 64, height: 64, borderRadius: 32, marginTop: 6 }} />
          </View>
          <TextInput
            value={draft}
            maxLength={60}
            autoFocus
            placeholder="Condividi un pensiero…"
            placeholderTextColor={theme.text2}
            accessibilityLabel="Nota"
            onChangeText={setDraft}
            onSubmitEditing={() => draft.trim() && onShare()}
            returnKeyType="done"
            style={[styles.noteInput, { backgroundColor: theme.fill, color: theme.text }]}
          />
          <T size={12.5} color={theme.text2} style={{ textAlign: "center", marginTop: 8 }}>La nota è visibile per 24 ore a chi ti segue e segui. · {60 - draft.length}</T>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            {hasNote ? <Btn title="Elimina" flex={1} height={40} onPress={onDelete} /> : null}
            <Btn title="Condividi" kind="primary" flex={1} height={40} disabled={!draft.trim()} onPress={onShare} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StatButton({ value, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
      <T size={16.5} weight="700" style={{ fontVariant: ["tabular-nums"], lineHeight: 20 }}>{value}</T>
      <T size={13.5}>{label}</T>
    </Pressable>
  );
}

function PeekAction({ icon: Icon, label, on, tone, onPress }) {
  const theme = useTheme();
  const color = on && tone !== "text" ? theme.red : theme.text;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.peekAction, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <Icon size={22} weight={on ? "fill" : "regular"} color={color} />
      <T size={11.5} color={color}>{label}</T>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Someone else's profile
// ---------------------------------------------------------------------------
export function PersonProfile({ person, menu, setMenu }) {
  const theme = useTheme();
  const store = useStore();
  const [board, setBoard] = useState(0);
  const following = store.follows.includes(person.name);
  const posts = useMemo(() => [...EXPLORE, ...POSTS.filter((post) => post.image)].filter((post) => post.name === person.name), [person.name]);
  const reels = useMemo(() => REELS.filter((reel) => reel.name === person.name).map((reel) => ({ ...reel, id: reel.id, reelId: reel.id, image: reel.src, kind: "reel", text: reel.caption })), [person.name]);
  const shownFollowers = useCountUp((person.followers || 0) + (following ? 1 : 0));
  const shownPosts = useCountUp(posts.length + reels.length);
  const mutual = SEARCH_PEOPLE.filter((item) => item.name !== person.name && store.follows.includes(item.name)).slice(0, 2);
  const shop = useShop(person.name);
  const boards = ["grid", ...(shop ? ["shop"] : []), "reels", "thoughts"];
  const tabs = [
    { key: "grid", label: "Post", icon: LayoutGrid },
    ...(shop ? [{ key: "shop", label: "Shop", icon: Bag }] : []),
    { key: "reels", label: "Reels", icon: SquarePlay },
    { key: "thoughts", label: "Pensieri", icon: Feather },
  ];
  const current = boards[Math.min(board, boards.length - 1)];
  const rows = useMemo(() => thoughtRows(store, { name: person.name }), [person.name, store.myThoughts, store.thoughtReplies, store.prefs]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    if (current === "shop") return [{ type: "shop", key: "shop" }];
    if (current === "thoughts") return rows.length ? rows.map((row) => ({ type: "thought", key: row.key, row })) : [{ type: "empty", key: "empty-thoughts" }];
    const list = current === "grid" ? posts : reels;
    return list.length ? rowsOf(list, current === "reels", { board: current }) : [{ type: "empty", key: `empty-${current}` }];
  }, [current, posts, reels, rows]);

  function message() {
    const id = store.ensureChat({ name: person.name, src: person.src });
    router.push(`/chat/${id}`);
  }

  const header = (
    <View>
      <View style={styles.psTop}>
        <LinearGradient colors={["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.psFace}>
          <Image source={{ uri: person.src }} style={[styles.psFaceImg, { borderColor: theme.bg }]} contentFit="cover" />
        </LinearGradient>
        <View style={{ flex: 1, flexDirection: "row" }}>
          {[[shownPosts, "post"], [compact(shownFollowers), "follower"], [compact(person.following || 0), "seguiti"]].map(([value, label]) => (
            <View key={label} style={{ flex: 1, alignItems: "center" }}>
              <T size={17} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{value}</T>
              <T size={13}>{label}</T>
            </View>
          ))}
        </View>
      </View>
      <View style={{ alignItems: "flex-start", gap: 2, paddingTop: 12, paddingHorizontal: INSET }}>
        <T size={14} weight="600">{shop ? shop.title : person.name}</T>
        <T size={14} color={theme.text2}>{shop ? shop.category : person.craft}</T>
        {person.bio ? <RichText text={person.bio} size={14} style={{ lineHeight: 19 }} /> : null}
        {shop ? null : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <MapPin size={13} weight="fill" color={theme.text2} />
            <T size={13} color={theme.text2}>{person.city}, Italia</T>
          </View>
        )}
        {mutual.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <View style={{ flexDirection: "row" }}>
              {mutual.map((item, index) => <Image key={item.handle} source={{ uri: item.src }} style={[styles.mutual, { borderColor: theme.bg, marginLeft: index ? -7 : 0 }]} />)}
            </View>
            <T size={12.5} color={theme.text2} style={{ flexShrink: 1 }}>
              Seguito da <T size={12.5} weight="600">{mutual[0].handle}</T>{mutual[1] ? <> e <T size={12.5} weight="600">{mutual[1].handle}</T></> : null}
            </T>
          </View>
        ) : null}
      </View>
      {shop ? <View style={{ paddingTop: 6 }}><BusinessCard shop={shop} /></View> : null}
      <View style={styles.psActions}>
        <Pressable onPress={() => { tap(); store.toggleFollow(person.name); }} style={({ pressed }) => [styles.psBtn, { backgroundColor: following ? theme.btn : theme.blue, opacity: pressed ? 0.7 : 1 }]}>
          <T size={14} weight="600" color={following ? theme.text : "#fff"}>{following ? "Segui già" : "Segui"}</T>
          {following ? <ChevronDown size={14} weight="bold" color={theme.text} /> : null}
        </Pressable>
        <Pressable onPress={() => { tap(); message(); }} style={({ pressed }) => [styles.psBtn, { backgroundColor: theme.btn, opacity: pressed ? 0.7 : 1 }]}>
          <T size={14} weight="600">Messaggio</T>
        </Pressable>
        <Pressable accessibilityLabel="Suggeriti" onPress={() => tap()} style={({ pressed }) => [styles.psBtn, { flex: 0, width: 34, backgroundColor: theme.btn, opacity: pressed ? 0.7 : 1 }]}>
          <UserPlus size={14} weight="bold" color={theme.text} />
        </Pressable>
      </View>
    </View>
  );

  function renderBoard(item) {
    if (item.type === "row" || item.type === "tallrow") return <GridRow items={item.items} tall={item.tall} reelMark={item.board === "reels"} onOpen={openGridItem} />;
    if (item.type === "thought") return <ThoughtEntry thought={item.row.thought} />;
    if (item.type === "shop") return <ShopGrid shop={shop} onOpen={(product) => router.push(`/product/${encodeURIComponent(person.name)}/${product.id}`)} />;
    if (current === "thoughts") return <IgEmpty icon={Feather} title="Ancora nessun pensiero" />;
    return <IgEmpty icon={current === "grid" ? Camera : SquarePlay} title={current === "grid" ? "Ancora nessun post" : "Ancora nessun reel"} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ProfileList header={header} tabs={tabs} board={Math.min(board, boards.length - 1)} setBoard={setBoard} items={items} renderBoard={renderBoard} />
      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        items={[
          { icon: LinkIcon, label: "Copia URL del profilo", onPress: () => { Clipboard.setStringAsync(`https://space.app/${person.handle}`).catch(() => {}); setMenu(false); } },
          { icon: Send, label: "Invia messaggio", onPress: () => { setMenu(false); message(); } },
          following ? { icon: UserMinus, label: "Non seguire più", onPress: () => { store.toggleFollow(person.name); setMenu(false); } } : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: 22, paddingTop: 26, paddingHorizontal: INSET },
  note: { position: "absolute", zIndex: 2, left: -6, top: -26, maxWidth: 120, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
  noteTail: { position: "absolute", left: 18, bottom: -5, width: 10, height: 10, borderRadius: 5 },
  face: { width: 90, height: 90, borderRadius: 45 },
  ring: { width: 90, height: 90, borderRadius: 45, padding: 4 },
  ringFace: { width: "100%", height: "100%", borderRadius: 45, borderWidth: 3 },
  add: { position: "absolute", right: -1, bottom: -1, width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  buttons: { flexDirection: "row", gap: 6, paddingTop: 14, paddingBottom: 4, paddingHorizontal: INSET },
  square: { width: 34, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  discoverHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingBottom: 8, paddingHorizontal: INSET },
  suggest: { width: 150, alignItems: "center", paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  suggestX: { position: "absolute", top: 6, right: 6, width: 24, height: 24, alignItems: "center", justifyContent: "center", zIndex: 2 },
  highlights: { gap: 16, paddingTop: 12, paddingBottom: 14, paddingHorizontal: INSET },
  highlight: { width: 66, alignItems: "center", gap: 6 },
  hlRing: { width: 66, height: 66, borderRadius: 33, padding: 3, borderWidth: 1 },
  dash: { marginTop: 10, marginHorizontal: INSET, borderRadius: 10, overflow: "hidden" },
  dashRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  cat: { height: 30, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  shopGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 12, paddingTop: 10, paddingHorizontal: INSET },
  shopPic: { width: "100%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", marginBottom: 5 },
  shopAdd: { alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", gap: 3 },
  shopAddIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  flag: { position: "absolute", left: 8, top: 8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  badge: { position: "absolute", top: 6, right: 6, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  mark: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  shadow: { textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  peekBack: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)" },
  peek: { width: "100%", maxWidth: 340, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } },
  peekHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  peekActions: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  peekAction: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 12 },
  noteBubble: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, maxWidth: 220 },
  noteSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: INSET, paddingTop: 8 },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 6 },
  noteInput: { marginTop: 14, height: 44, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  psTop: { flexDirection: "row", alignItems: "center", gap: 24, paddingTop: 8, paddingHorizontal: INSET },
  psFace: { width: 86, height: 86, borderRadius: 43, padding: 3 },
  psFaceImg: { width: "100%", height: "100%", borderRadius: 43, borderWidth: 3 },
  mutual: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  psActions: { flexDirection: "row", gap: 6, paddingTop: 14, paddingBottom: 12, paddingHorizontal: INSET },
  psBtn: { flex: 1, height: 34, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
});
