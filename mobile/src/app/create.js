import { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, { FadeIn, useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { createPost, useSearch } from "../lib/social";
import { myHandle } from "../lib/session";
import { At, Camera, Check, ChevronLeft, ChevronRight, Close, Comment, Heart, ImageIcon, MapPin } from "../ui/icons";
import { CopyGlyph, ReelGlyph } from "../ui/feedIcons";
import { Btn, Name, T, Toggle, tap } from "../ui/kit";
import { Face, MentionSuggest, Spinner, failAlert, useDebounced } from "../ui/feed";
import { showToast } from "../ui/feedEcho";
import { t } from "../lib/i18n";
import { openTab } from "../lib/tabs";

const W = Dimensions.get("window").width;
const MAX = 10;
const THUMB = 72;

function fromAsset(asset) {
  return { uri: asset.uri, type: asset.type === "video" ? "video" : "image", w: asset.width || null, h: asset.height || null, mime: asset.mimeType || undefined };
}

// A video becomes a reel and travels alone; photos make a carousel of up to 10.
function merge(prev, items) {
  const video = items.find((item) => item.type === "video");
  if (video) {
    if (items.length > 1 || prev.length) showToast({ text: t("Un reel contiene un solo video") });
    return [video];
  }
  const base = prev[0]?.type === "video" ? [] : prev;
  const next = [...base, ...items.filter((item) => !base.some((p) => p.uri === item.uri))];
  if (next.length > MAX) showToast({ text: t("Puoi scegliere fino a {n} elementi", { n: MAX }) });
  return next.slice(0, MAX);
}

// New post (web CreateScreen): pick photos or a video, then caption, people, place and settings.
export default function CreateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState("pick");
  const [picked, setPicked] = useState([]);
  const [focus, setFocus] = useState(0);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [tags, setTags] = useState([]);
  const [panel, setPanel] = useState(null);
  const [hideLikes, setHideLikes] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const reel = picked[0]?.type === "video";
  const current = picked[Math.min(focus, picked.length - 1)];

  const add = (assets) => {
    const items = assets.map(fromAsset);
    const next = merge(pickedRef.current, items);
    pickedRef.current = next;
    setPicked(next);
    setFocus(Math.max(0, next.findIndex((item) => item.uri === items[0]?.uri)));
  };

  async function fromLibrary() {
    tap();
    const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, 
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX,
      orderedSelection: true,
      quality: 0.85,
      videoMaxDuration: 90,
    }).catch(() => null);
    if (!result || result.canceled || !result.assets?.length) return;
    add(result.assets);
  }

  async function fromCamera() {
    tap();
    const permission = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
    if (!permission?.granted) {
      Alert.alert(t("Fotocamera non disponibile"), t("Consenti l'accesso alla fotocamera nelle Impostazioni."));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.85, videoMaxDuration: 90 }).catch(() => null);
    if (!result || result.canceled || !result.assets?.length) return;
    add(result.assets);
  }

  // Open the library straight away, like Instagram.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    fromLibrary();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function remove(index) {
    tap();
    setPicked((prev) => prev.filter((_, i) => i !== index));
    setFocus((value) => Math.max(0, value >= index ? value - 1 : value));
  }

  async function publish() {
    if (busy || !picked.length) return;
    tap("medium");
    setBusy(true);
    setProgress(0);
    try {
      await createPost({
        kind: reel ? "reel" : "photo",
        media: picked.map(({ uri, type, w, h, mime }) => ({ uri, type, w, h, mime })),
        text: caption.trim(),
        place: place.trim() || undefined,
        tags: tags.map((person) => person.handle),
        hideLikes,
        commentsOff,
        onProgress: setProgress,
      });
      showToast({ text: reel ? t("Reel condiviso") : t("Post condiviso"), src: reel ? undefined : picked[0].uri });
      // openTab closes this modal itself; a second dismissAll here raced it (POP_TO_TOP warning).
      openTab("home");
    } catch (error) {
      setBusy(false);
      failAlert(error);
    }
  }

  const back = () => {
    if (busy) return;
    tap();
    if (step === "pick") router.back();
    else setStep("pick");
  };
  const title = reel ? t("Nuovo reel") : t("Nuovo post");

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={styles.head}>
        <Pressable accessibilityLabel={step === "pick" ? t("Chiudi") : t("Indietro")} hitSlop={8} onPress={back} style={styles.headBtn}>
          {step === "pick" ? <Close size={26} color={theme.text} /> : <ChevronLeft size={26} weight="bold" color={theme.text} />}
        </Pressable>
        <T size={16} weight="700">{title}</T>
        <Pressable hitSlop={8} disabled={!picked.length || busy} onPress={() => { tap(); if (step === "details") publish(); else setStep("details"); }} style={[styles.headBtn, { alignItems: "flex-end", opacity: picked.length && !busy ? 1 : 0.4 }]}>
          <T size={15} weight="700" color={theme.blue}>{step === "details" ? t("Condividi") : t("Avanti")}</T>
        </Pressable>
      </View>

      {step === "pick" ? (
        <View style={{ flex: 1 }}>
          <View style={{ width: W, height: W, backgroundColor: "#000" }}>
            {current ? (
              current.type === "video" ? <VideoPreview key={current.uri} uri={current.uri} /> : <Image source={{ uri: current.uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            ) : (
              <Pressable onPress={fromLibrary} style={[StyleSheet.absoluteFill, styles.center, { gap: 10 }]}>
                <ImageIcon size={44} color="#fff" weight="light" />
                <T size={16} weight="600" color="#fff">{t("Scegli foto o un video")}</T>
                <T size={13} color="rgba(255,255,255,0.7)">{t("Fino a {n} foto per un carosello", { n: MAX })}</T>
              </Pressable>
            )}
            {reel ? <View pointerEvents="none" style={[styles.chip, { left: 10 }]}><ReelGlyph size={15} weight="fill" color="#fff" /><T size={12.5} weight="700" color="#fff">{t("Reel")}</T></View> : null}
            {picked.length > 1 ? <View pointerEvents="none" style={[styles.chip, { right: 10 }]}><CopyGlyph size={15} weight="fill" color="#fff" /><T size={12.5} weight="700" color="#fff">{focus + 1}/{picked.length}</T></View> : null}
          </View>
          <View style={styles.bar}>
            <T size={16} weight="700">{picked.length ? t("Selezionati · {n}", { n: picked.length }) : t("Nessun elemento")}</T>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={fromCamera} accessibilityLabel={t("Fotocamera")} style={({ pressed }) => [styles.device, { backgroundColor: theme.fill, opacity: pressed ? 0.7 : 1 }]}>
                <Camera size={16} color={theme.text} />
              </Pressable>
              <Pressable onPress={fromLibrary} style={({ pressed }) => [styles.device, { backgroundColor: theme.fill, opacity: pressed ? 0.7 : 1 }]}>
                <ImageIcon size={16} color={theme.text} />
                <T size={13} weight="600">{t("Libreria")}</T>
              </Pressable>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {picked.map((item, index) => (
              <Pressable key={item.uri} onPress={() => { tap(); setFocus(index); }} style={[styles.thumbCell, { backgroundColor: theme.fill, borderColor: index === focus ? theme.blue : "transparent" }]}>
                <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={100} />
                {picked.length > 1 ? <View style={[styles.n, { backgroundColor: theme.blue }]}><T size={11} weight="700" color="#fff">{index + 1}</T></View> : null}
                <Pressable accessibilityLabel={t("Rimuovi")} hitSlop={6} onPress={() => remove(index)} style={styles.remove}><Close size={11} weight="bold" color="#fff" /></Pressable>
              </Pressable>
            ))}
            {!reel && picked.length && picked.length < MAX ? (
              <Pressable accessibilityLabel={t("Aggiungi")} onPress={fromLibrary} style={[styles.thumbCell, styles.center, { backgroundColor: theme.fill }]}>
                <T size={26} weight="300">+</T>
              </Pressable>
            ) : null}
          </ScrollView>
          <View style={[styles.modes, { bottom: insets.bottom + 14 }]}>
            <View style={[styles.mode, styles.modeOn]}><T size={12.5} weight="700" color="#fff" style={styles.modeText}>{t("POST")}</T></View>
            <Pressable onPress={() => { tap(); router.replace("/story/new"); }} style={styles.mode}><T size={12.5} weight="700" color="rgba(255,255,255,0.7)" style={styles.modeText}>{t("STORIA")}</T></Pressable>
            <Pressable onPress={() => { tap(); router.replace("/reel-camera"); }} style={styles.mode}><T size={12.5} weight="700" color="rgba(255,255,255,0.7)" style={styles.modeText}>{t("REEL")}</T></Pressable>
            <Pressable onPress={() => { tap(); router.replace("/compose"); }} style={styles.mode}><T size={12.5} weight="700" color="rgba(255,255,255,0.7)" style={styles.modeText}>{t("PENSIERO")}</T></Pressable>
          </View>
        </View>
      ) : (
        <Details
          picked={picked} reel={reel} caption={caption} setCaption={setCaption}
          tags={tags} setTags={setTags} place={place} setPlace={setPlace} panel={panel} setPanel={setPanel}
          hideLikes={hideLikes} setHideLikes={setHideLikes} commentsOff={commentsOff} setCommentsOff={setCommentsOff}
          busy={busy} onShare={publish}
        />
      )}

      {busy ? <Uploading progress={progress} reel={reel} /> : null}
    </View>
  );
}

function VideoPreview({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} allowsPictureInPicture={false} />;
}

function Uploading({ progress, reel }) {
  const theme = useTheme();
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.scrim }]}>
      <View style={[styles.upload, { backgroundColor: theme.card }]}>
        <Spinner size={28} />
        <T size={15} weight="600">{pct >= 100 ? t("Pubblicazione…") : reel ? t("Caricamento del video…") : t("Caricamento… {n}%", { n: pct })}</T>
        <View style={[styles.track, { backgroundColor: theme.fill }]}>
          <View style={[styles.fill, { width: `${Math.max(4, pct)}%`, backgroundColor: theme.blue }]} />
        </View>
      </View>
    </View>
  );
}

function Details({ picked, reel, caption, setCaption, tags, setTags, place, setPlace, panel, setPanel, hideLikes, setHideLikes, commentsOff, setCommentsOff, busy, onShare }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const pad = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));
  const tagLabel = tags.map((person) => person.handle).join(", ");
  return (
    <Animated.View style={[{ flex: 1 }, pad]}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.cap, { borderBottomColor: theme.line }]}>
          <View style={[styles.thumb, { backgroundColor: theme.fill }]}>
            <Image source={{ uri: picked[0]?.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {picked.length > 1 ? <View style={styles.thumbBadge}><CopyGlyph size={14} weight="fill" color="#fff" /></View> : null}
            {reel ? <View style={styles.thumbBadge}><ReelGlyph size={14} weight="fill" color="#fff" /></View> : null}
          </View>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={2200}
            multiline
            autoFocus
            placeholder={t("Scrivi una didascalia… usa @ per menzionare e # per i tag")}
            placeholderTextColor={theme.text2}
            accessibilityLabel={t("Didascalia")}
            style={[styles.caption, { color: theme.text }]}
          />
        </View>
        <MentionSuggest value={caption} onPick={setCaption} style={{ marginHorizontal: INSET, marginTop: 8 }} />
        <Row icon={At} label={t("Tagga persone")} value={tagLabel} onPress={() => setPanel(panel === "tag" ? null : "tag")} />
        {panel === "tag" ? <TagPeople tags={tags} setTags={setTags} /> : null}
        <Row icon={MapPin} label={t("Aggiungi luogo")} value={panel === "place" ? "" : place} onPress={() => setPanel(panel === "place" ? null : "place")} />
        {panel === "place" ? (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.panel, { borderBottomColor: theme.line }]}>
            <TextInput
              value={place}
              onChangeText={setPlace}
              maxLength={80}
              autoFocus
              placeholder={t("Dove sei? Es. Milano, Bottega Rossi")}
              placeholderTextColor={theme.text2}
              returnKeyType="done"
              onSubmitEditing={() => setPanel(null)}
              style={[styles.field, { color: theme.text, backgroundColor: theme.fill }]}
            />
          </Animated.View>
        ) : null}
        <T size={13} weight="600" color={theme.text2} style={styles.sub}>{t("Impostazioni avanzate")}</T>
        <Row icon={Heart} label={t("Nascondi il numero di Mi piace")} toggle={hideLikes} onPress={() => setHideLikes((value) => !value)} />
        <Row icon={Comment} label={t("Disattiva i commenti")} toggle={commentsOff} onPress={() => setCommentsOff((value) => !value)} />
        <Btn title={t("Condividi")} kind="primary" height={46} size={15} disabled={busy} onPress={onShare} style={styles.share} />
      </ScrollView>
    </Animated.View>
  );
}

// Search people on iywa and tag them (by handle).
function TagPeople({ tags, setTags }) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim().replace(/^@/, ""), 250);
  const { data, loading } = useSearch(q);
  const me = myHandle();
  const results = (data?.people || []).filter((person) => person.handle !== me).slice(0, 12);
  const has = (handle) => tags.some((person) => person.handle === handle);
  const toggle = (person) => {
    tap();
    setTags((prev) => (prev.some((p) => p.handle === person.handle) ? prev.filter((p) => p.handle !== person.handle) : prev.length >= 20 ? prev : [...prev, { handle: person.handle, name: person.name, avatar: person.avatar }]));
  };
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.panel, { borderBottomColor: theme.line }]}>
      {tags.length ? (
        <View style={styles.chips}>
          {tags.map((person) => (
            <Pressable key={person.handle} onPress={() => toggle(person)} style={[styles.tagChip, { backgroundColor: theme.fill }]}>
              <T size={13} weight="600">{person.handle}</T>
              <Close size={11} weight="bold" color={theme.text2} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t("Cerca persone")}
        placeholderTextColor={theme.text2}
        style={[styles.field, { color: theme.text, backgroundColor: theme.fill }]}
      />
      {q && loading && !data ? <View style={[styles.center, { paddingVertical: 12 }]}><Spinner /></View> : null}
      {q && data && !results.length ? <T size={13} color={theme.text2} style={{ paddingVertical: 10 }}>{t("Nessun risultato")}</T> : null}
      {results.map((person) => {
        const on = has(person.handle);
        return (
          <Pressable key={person.handle} onPress={() => toggle(person)} style={({ pressed }) => [styles.person, pressed && { opacity: 0.6 }]}>
            <Face src={person.avatar} name={person.name || person.handle} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Name size={14} verified={person.verified}>{person.handle}</Name>
              <T size={13} color={theme.text2} lines={1}>{person.name}</T>
            </View>
            <View style={[styles.check, { borderColor: on ? theme.blue : theme.line, backgroundColor: on ? theme.blue : "transparent" }]}>
              {on ? <Check size={12} weight="bold" color="#fff" /> : null}
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

function Row({ icon: Icon, label, value, toggle, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.row, { borderBottomColor: theme.line, backgroundColor: pressed ? theme.fill : "transparent" }]}>
      <Icon size={22} color={theme.text} />
      <T size={15} style={{ flex: 1 }}>{label}</T>
      {toggle != null ? <Toggle on={toggle} /> : (
        <>
          {value ? <T size={14} color={theme.text2} lines={1} style={{ maxWidth: "45%" }}>{value}</T> : null}
          <ChevronRight size={16} color={theme.text3} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  head: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  headBtn: { minWidth: 80, paddingHorizontal: 4 },
  chip: { position: "absolute", bottom: 10, height: 32, paddingHorizontal: 12, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.82)", flexDirection: "row", alignItems: "center", gap: 6 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: INSET },
  device: { height: 30, paddingHorizontal: 12, borderRadius: 99, flexDirection: "row", alignItems: "center", gap: 6 },
  thumbs: { gap: 6, paddingHorizontal: INSET, paddingBottom: 10 },
  thumbCell: { width: THUMB, height: THUMB, borderRadius: 8, overflow: "hidden", borderWidth: 2 },
  n: { position: "absolute", left: 4, top: 4, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  remove: { position: "absolute", right: 4, top: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  modes: { position: "absolute", alignSelf: "center", flexDirection: "row", gap: 4, padding: 4, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.9)" },
  mode: { height: 32, paddingHorizontal: 16, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: "rgba(255,255,255,0.18)" },
  modeText: { letterSpacing: 0.5 },
  cap: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 80, borderRadius: 6, overflow: "hidden" },
  thumbBadge: { position: "absolute", top: 4, right: 4 },
  caption: { flex: 1, minHeight: 80, fontSize: 15, lineHeight: 21, textAlignVertical: "top", paddingTop: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  panel: { paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  field: { height: 38, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  tagChip: { height: 30, paddingHorizontal: 10, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  sub: { marginTop: 18, marginBottom: 4, marginHorizontal: INSET },
  share: { marginHorizontal: INSET, marginTop: 24 },
  upload: { width: 240, borderRadius: 16, padding: 20, alignItems: "center", gap: 12 },
  track: { alignSelf: "stretch", height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
});
