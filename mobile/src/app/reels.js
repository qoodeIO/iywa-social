// Reels: vertical, full-height pager. Port of the web's ReelScreen (src/App.jsx).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { AVATAR, REELS, avatarFor, personByName } from "../data";
import { tap } from "../ui/kit";
import ReelSlide from "../ui/reels-slide";
import { DarkSheet, REEL_EMOJI, REEL_SPEEDS, Toast, myReels, openReelCamera, reelHidden, reelPoster, useToast } from "../ui/reels-kit";
import { ArrowUpRight, Bookmark, Camera, Check, EyeOff, Hash, Heart, Info, LinkIcon, SoundOff, SoundOn, SquarePlay, SquarePlus, X } from "../ui/reels-icons";

export default function Reels() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const params = useLocalSearchParams();
  const list = useRef(null);
  const [size, setSize] = useState(null);
  const [index, setIndex] = useState(0);
  const [feed, setFeed] = useState("foryou");
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(Boolean(store.prefs.captions));
  const [hidden, setHidden] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState("");
  const [sentTo, setSentTo] = useState([]);
  const [muteHint, setMuteHint] = useState(0);
  const [clean, setClean] = useState(false);
  const [toast, note] = useToast(1400);

  const comments = store.postComments || {};
  const mine = useMemo(() => myReels(store).map((item) => ({
    ...item,
    avatar: item.avatar || AVATAR,
    caption: item.caption || item.text,
    likes: item.likes || "0",
    comments: String((comments[item.id] || []).length),
    saves: item.saves || "0",
    thread: item.thread || [],
  })), [store.library, comments]); // eslint-disable-line react-hooks/exhaustive-deps

  const archived = store.archived || [];
  const all = useMemo(() => [...mine, ...REELS]
    .filter((reel) => !reelHidden(store.prefs, reel) && !archived.includes(reel.id) && !hidden.includes(reel.id))
    .filter((reel) => feed === "foryou" || reel.mine || store.follows.includes(reel.name)),
  [mine, store.prefs, archived, hidden, feed, store.follows]);
  const reel = all[index];

  // Latest state for the stable action handler the slides share.
  const live = useRef({});
  live.current = { store, all, index, size, note };

  useEffect(() => {
    setSheet(null);
    setDraft("");
  }, [index]);

  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
    setIndex(0);
  }, [feed, mine.length]);

  // Shared link or profile grid: open on a given reel.
  useEffect(() => {
    if (!params.id || !size) return;
    const at = all.findIndex((item) => item.id === params.id);
    if (at >= 0) {
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: at * size.h, animated: false }));
      setIndex(at);
    }
    router.setParams({ id: undefined });
  }, [params.id, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const goNext = useCallback(() => {
    const { index: at, size: box } = live.current;
    if (box) list.current?.scrollToOffset({ offset: (at + 1) * box.h, animated: true });
  }, []);

  const act = useCallback((kind, item, value) => {
    const { store: s, note: say } = live.current;
    if (kind === "like") s.toggleLike(item.id);
    else if (kind === "save") {
      const on = s.saves.includes(item.id);
      s.toggleSave(item.id);
      say(on ? t("Rimosso dai salvati") : t("Salvato"));
    } else if (kind === "follow") s.toggleFollow(item.name);
    else if (kind === "comments") setSheet("comments");
    else if (kind === "share") {
      setSentTo([]);
      setSheet("share");
    } else if (kind === "more") setSheet("more");
    else if (kind === "audio") say(`♫ ${item.music ? item.music.title : (item.audio ? t(item.audio) : t("Audio originale"))}`);
    else if (kind === "mute") {
      setMuted((on) => !on);
      setMuteHint(Date.now());
    } else if (kind === "boost") setClean(Boolean(value));
    else if (kind === "person") {
      if (item.mine) router.push("/profile");
      else {
        const person = personByName(item.name);
        if (person?.handle) router.push(`/person/${person.handle}`);
      }
    }
  }, []);

  const onScroll = useCallback((event) => {
    const box = live.current.size;
    if (!box) return;
    const next = Math.round(event.nativeEvent.contentOffset.y / Math.max(box.h, 1));
    setIndex((current) => (current === next ? current : next));
  }, []);

  const notes = reel ? [
    ...(reel.thread || []).map((item, i) => ({ ...item, id: `t-${i}`, src: item.name === store.profile.name ? store.profile.src || AVATAR : avatarFor(item.name) })),
    ...(comments[reel.id] || []).map((text, i) => ({ id: `m-${i}`, name: store.profile.name, text, src: store.profile.src || AVATAR, mine: true })),
  ] : [];
  const people = store.chats.slice(0, 8);

  function sendTo(chat) {
    if (!reel || sentTo.includes(chat.id)) return;
    tap();
    setSentTo((prev) => [...prev, chat.id]);
    const text = `Reel · ${reel.name}: ${reel.caption || ""}`.trim();
    const image = reelPoster(reel);
    store.sendMessage(chat.id, image ? { image, text } : { text });
  }

  function postComment() {
    const text = draft.trim();
    if (!text || !reel) return;
    const blocked = (store.prefs.hiddenWords || []).some((word) => word && text.toLowerCase().includes(String(word).toLowerCase()));
    if (blocked) return;
    store.addComment(reel.id, text);
    setDraft("");
  }

  const link = reel ? Linking.createURL("/reels", { queryParams: { id: reel.id } }) : "";
  const height = size?.h || 0;
  const showCounts = store.prefs.likeCounts !== false;
  const headHidden = clean || sheet === "comments";

  const renderItem = ({ item, index: i }) => (
    <ReelSlide
      reel={item}
      width={size.w}
      height={size.h}
      top={insets.top}
      active={i === index && focused}
      near={Math.abs(i - index) <= 1}
      muted={muted}
      rate={rate}
      captions={captions}
      sheetOpen={Boolean(sheet) && i === index}
      commentsOpen={sheet === "comments" && i === index}
      mine={Boolean(item.mine)}
      liked={store.likes.includes(item.id)}
      saved={store.saves.includes(item.id)}
      following={store.follows.includes(item.name)}
      showCounts={showCounts}
      act={act}
    />
  );

  return (
    <View style={styles.root} onLayout={(event) => { const { width, height: h } = event.nativeEvent.layout; setSize((prev) => (prev && prev.w === width && prev.h === h ? prev : { w: width, h })); }}>
      {focused ? <StatusBar style="light" /> : null}
      {size ? (
        <FlatList
          ref={list}
          data={all}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={[index, focused, muted, rate, captions, sheet, store.likes, store.saves, store.follows, showCounts, size]}
          pagingEnabled
          disableIntervalMomentum
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          scrollsToTop={false}
          bounces={false}
          overScrollMode="never"
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!sheet}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={(
            <View style={[styles.empty, { height }]}>
              <View style={styles.emptyIcon}><SquarePlay size={30} color="#fff" /></View>
              <Text style={styles.emptyTitle}>{feed === "following" ? t("Nessun reel da chi segui") : t("Ancora nessun reel")}</Text>
              <Pressable onPress={() => { tap(); openReelCamera(); }} style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={styles.primaryText}>{t("Crea un reel")}</Text>
              </Pressable>
            </View>
          )}
        />
      ) : null}

      <View pointerEvents={headHidden ? "none" : "box-none"} style={[styles.head, { top: insets.top + 4, opacity: headHidden ? 0 : 1 }]}>
        <Text style={[styles.title, styles.shadow]}>{t("Reels")}</Text>
        <View style={styles.feeds}>
          {[["foryou", t("Per te")], ["following", t("Seguiti")]].map(([id, label]) => (
            <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: feed === id }} hitSlop={8} onPress={() => { tap(); setFeed(id); }}>
              <Text style={[styles.feedText, styles.shadow, { color: feed === id ? "#fff" : "rgba(255,255,255,0.65)" }]}>{label}</Text>
              {feed === id ? <View style={styles.feedLine} /> : null}
            </Pressable>
          ))}
        </View>
        <View style={styles.headRight}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Crea reel")} hitSlop={6} onPress={() => { tap(); openReelCamera(); }} style={({ pressed }) => [styles.cam, { opacity: pressed ? 0.6 : 1 }]}>
            <Camera size={26} color="#fff" />
          </Pressable>
        </View>
      </View>

      {muteHint ? <MuteHint key={muteHint} muted={muted} /> : null}
      <Toast text={toast} bottom={110} />

      <DarkSheet open={sheet === "comments" && Boolean(reel)} clear keyboard height="60%" title={t("Commenti")} onClose={() => setSheet(null)} bottomPad={10}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.notes} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {notes.length ? notes.map((item) => {
            const key = `${reel?.id}:${item.id}`;
            const on = (store.commentLikes || []).includes(key);
            return (
              <View key={item.id} style={styles.note}>
                <Image source={{ uri: item.src || undefined }} style={styles.noteAvatar} contentFit="cover" transition={120} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.noteName}>{item.name}<Text style={styles.noteTime}>{"  "}{item.mine ? t("ora") : t("{n} h", { n: 2 })}</Text></Text>
                  <Text style={styles.noteText}>{item.text}</Text>
                  <Pressable hitSlop={6} onPress={() => setDraft(`@${item.name.split(" ")[0]} `)}>
                    <Text style={styles.reply}>{t("Rispondi")}</Text>
                  </Pressable>
                </View>
                <Pressable accessibilityLabel={t("Mi piace al commento")} hitSlop={10} onPress={() => { tap(); store.toggleCommentLike?.(key); }} style={{ alignSelf: "center" }}>
                  <Heart size={15} weight={on ? "fill" : "regular"} color={on ? "#ff3040" : "rgba(255,255,255,0.55)"} />
                </Pressable>
              </View>
            );
          }) : <Text style={styles.none}>{t("Ancora nessun commento. Inizia tu.")}</Text>}
        </ScrollView>
        <View style={styles.emojiRow}>
          {REEL_EMOJI.map((char) => (
            <Pressable key={char} hitSlop={4} onPress={() => setDraft((value) => `${value}${char}`)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.3 : 1 }] })}>
              <Text style={{ fontSize: 24 }}>{char}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.compose}>
          <Image source={{ uri: store.profile.src || AVATAR }} style={styles.composeAvatar} contentFit="cover" />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={reel ? t("Commenta per {name}…", { name: reel.name.split(" ")[0] }) : ""}
            placeholderTextColor="rgba(255,255,255,0.5)"
            accessibilityLabel={t("Aggiungi un commento")}
            style={styles.input}
            keyboardAppearance="dark"
            returnKeyType="send"
            onSubmitEditing={postComment}
            submitBehavior="submit"
          />
          {draft.trim() ? (
            <Pressable hitSlop={8} onPress={postComment}>
              <Text style={styles.post}>{t("Pubblica")}</Text>
            </Pressable>
          ) : null}
        </View>
      </DarkSheet>

      <DarkSheet open={sheet === "share" && Boolean(reel)} title={t("Condividi")} onClose={() => setSheet(null)}>
        {people.length ? (
          <View style={styles.people}>
            {people.map((chat) => {
              const done = sentTo.includes(chat.id);
              return (
                <Pressable key={chat.id} onPress={() => sendTo(chat)} style={styles.person}>
                  <View style={styles.face}>
                    <Image source={{ uri: chat.src || avatarFor(chat.name) || undefined }} style={styles.faceImg} contentFit="cover" transition={120} />
                    {done ? <View style={styles.faceDone}><Check size={26} weight="bold" color="#fff" /></View> : null}
                  </View>
                  <Text numberOfLines={1} style={styles.personName}>{String(chat.name).split(" ")[0]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : <Text style={styles.none}>{t("Ancora nessuno a cui inviarlo.")}</Text>}
        <View style={styles.shareRow}>
          <ShareBtn icon={LinkIcon} label={t("Copia link")} onPress={() => { Clipboard.setStringAsync(link).catch(() => {}); note(t("Link copiato")); }} />
          <ShareBtn icon={SquarePlus} label={t("Aggiungi alla storia")} onPress={() => {
            store.publish({ id: `made-${Date.now()}`, kind: "story", image: reelPoster(reel), text: "", stickers: [{ type: "tag", name: reel.name, x: 50, y: 82, s: 1, r: 0 }], time: "Now", at: Date.now(), mine: true, src: store.profile.src || AVATAR, avatar: store.profile.src || AVATAR, name: t("Tu") });
            setSheet(null);
            note(t("Aggiunto alla tua storia"));
          }} />
          <ShareBtn icon={ArrowUpRight} label={t("Condividi su…")} onPress={() => { Share.share({ title: reel.name, message: `${reel.caption || ""} ${link}`.trim(), url: link }).catch(() => {}); }} />
        </View>
      </DarkSheet>

      <DarkSheet open={sheet === "more" && Boolean(reel)} onClose={() => setSheet(null)}>
        <View style={styles.speeds}>
          <Text style={styles.speedLabel}>{t("Velocità")}</Text>
          {REEL_SPEEDS.map((value) => (
            <Pressable key={value} onPress={() => { tap(); setRate(value); }} style={[styles.speed, rate === value ? styles.speedOn : null]}>
              <Text style={[styles.speedText, { color: rate === value ? "#111" : "#fff" }]}>{value}×</Text>
            </Pressable>
          ))}
        </View>
        <Line icon={Hash} label={captions ? t("Nascondi sottotitoli") : t("Mostra sottotitoli")} onPress={() => { setCaptions((value) => !value); setSheet(null); }} />
        <Line icon={Bookmark} label={reel && store.saves.includes(reel.id) ? t("Rimuovi dai salvati") : t("Salva")} onPress={() => { store.toggleSave(reel.id); setSheet(null); }} />
        <Line icon={EyeOff} label={t("Non mi interessa")} onPress={() => { setHidden((prev) => [...prev, reel.id]); setSheet(null); note(t("Ne vedrai meno così")); }} />
        {reel?.mine ? (
          <Line icon={X} warn label={t("Elimina")} onPress={() => { store.dropPost(reel.id); setSheet(null); }} />
        ) : (
          <Line icon={Info} warn label={t("Segnala")} onPress={() => { setSheet(null); note(t("Segnalato")); goNext(); }} />
        )}
      </DarkSheet>
    </View>
  );
}

function ShareBtn({ icon: Icon, label, onPress }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={styles.shareIcon}><Icon size={22} color="#fff" /></View>
      <Text numberOfLines={2} style={styles.shareLabel}>{label}</Text>
    </Pressable>
  );
}

function Line({ icon: Icon, label, warn, onPress }) {
  const color = warn ? "#ff3040" : "#fff";
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.line, { backgroundColor: pressed ? "rgba(255,255,255,0.06)" : "transparent" }]}>
      <Icon size={22} color={color} />
      <Text style={[styles.lineText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function MuteHint({ muted }) {
  const alpha = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    alpha.value = withSequence(withTiming(1, { duration: 175 }), withTiming(0, { duration: 525 }));
    scale.value = withSequence(withTiming(1, { duration: 175 }), withTiming(1.25, { duration: 525 }));
  }, [alpha, scale]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.muteHint, style]}>
      {muted ? <SoundOff size={28} weight="fill" color="#fff" /> : <SoundOn size={28} weight="fill" color="#fff" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  shadow: { textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  head: { position: "absolute", zIndex: 6, left: 0, right: 0, height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 10 },
  title: { flex: 1, color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: -0.66 },
  feeds: { flexDirection: "row", gap: 16 },
  feedText: { fontSize: 15, fontWeight: "700" },
  feedLine: { position: "absolute", left: "25%", right: "25%", bottom: -6, height: 2.5, borderRadius: 99, backgroundColor: "#fff" },
  headRight: { flex: 1, alignItems: "flex-end" },
  cam: { width: 40, height: 40, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center" },
  primary: { height: 34, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  muteHint: { position: "absolute", zIndex: 7, top: "50%", left: "50%", width: 64, height: 64, marginTop: -32, marginLeft: -32, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  notes: { paddingHorizontal: 16, paddingVertical: 8 },
  note: { flexDirection: "row", gap: 12, paddingVertical: 9 },
  noteAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#333" },
  noteName: { color: "#fff", fontSize: 13, fontWeight: "600" },
  noteTime: { color: "rgba(255,255,255,0.5)", fontWeight: "400" },
  noteText: { color: "#fff", fontSize: 14, lineHeight: 19, marginTop: 2, marginBottom: 4 },
  reply: { color: "rgba(255,255,255,0.55)", fontSize: 12.5, fontWeight: "600" },
  none: { paddingVertical: 28, paddingHorizontal: 16, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14 },
  emojiRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)" },
  compose: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 6, paddingHorizontal: 16 },
  composeAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#333" },
  input: { flex: 1, minWidth: 0, height: 40, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 14.5 },
  post: { color: "#0095f6", fontSize: 14.5, fontWeight: "700" },
  people: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6 },
  person: { width: "25%", alignItems: "center", gap: 6 },
  face: { width: 60, height: 60 },
  faceImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#333" },
  faceDone: { ...StyleSheet.absoluteFill, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,149,246,0.75)" },
  personName: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  shareRow: { flexDirection: "row", gap: 8, paddingTop: 12, paddingHorizontal: 14, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)" },
  shareBtn: { flex: 1, alignItems: "center", gap: 6 },
  shareIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  shareLabel: { color: "#fff", fontSize: 12, textAlign: "center" },
  speeds: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 12 },
  speedLabel: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  speed: { height: 32, paddingHorizontal: 12, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  speedOn: { backgroundColor: "#fff" },
  speedText: { fontSize: 13.5, fontWeight: "600" },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  lineText: { fontSize: 15 },
});
