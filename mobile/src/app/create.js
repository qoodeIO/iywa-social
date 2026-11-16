import { memo, useCallback, useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { CONTACTS } from "../data";
import { At, Camera, Check, ChevronLeft, ChevronRight, Close, Comment, Heart, ImageIcon, MapPin } from "../ui/icons";
import { CopyGlyph } from "../ui/feedIcons";
import { T, Toggle, tap } from "../ui/kit";
import { Filtered, MentionSuggest, STORY_CAMERA } from "../ui/feed";
import { DEMO_GALLERY, POST_FILTERS, STORY_PLACES } from "../ui/feedData";
import { publishPost, showToast } from "../ui/feedEcho";
import { keepAll } from "../lib/media-store";

const W = Dimensions.get("window").width;
const CELL = (W - 6) / 4;

// New post (web CreateScreen): pick photos, edit with filters, then caption, tags, place and settings.
export default function CreateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [gallery, setGallery] = useState(DEMO_GALLERY);
  const [step, setStep] = useState("pick");
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState([DEMO_GALLERY[1]]);
  const [focus, setFocus] = useState(DEMO_GALLERY[1]);
  const [aspect, setAspect] = useState("4:5");
  const [filter, setFilter] = useState("normal");
  const [slide, setSlide] = useState(0);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [tags, setTags] = useState([]);
  const [panel, setPanel] = useState(null);
  const [hideLikes, setHideLikes] = useState(false);
  const [noComments, setNoComments] = useState(false);

  const toggle = useCallback((src) => {
    tap();
    setFocus(src);
    if (!multi) {
      setPicked([src]);
      return;
    }
    setPicked((prev) => {
      if (prev.includes(src)) return prev.length > 1 ? prev.filter((item) => item !== src) : prev;
      return prev.length >= 10 ? prev : [...prev, src];
    });
  }, [multi]);

  async function fromDevice() {
    tap();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      orderedSelection: true,
      quality: 0.85,
    }).catch(() => null);
    if (!result || result.canceled || !result.assets?.length) return;
    const uris = await keepAll(result.assets.map((asset) => asset.uri).slice(0, 10));
    setGallery((prev) => [...uris, ...prev.filter((src) => !uris.includes(src))]);
    setFocus(uris[0]);
    if (uris.length > 1) setMulti(true);
    setPicked((prev) => (multi || uris.length > 1 ? [...(multi ? prev : []), ...uris].slice(0, 10) : [uris[0]]));
  }

  function publish() {
    tap("medium");
    const item = {
      id: `made-${Date.now()}`,
      kind: "post",
      image: picked[0],
      images: picked,
      aspect,
      filter,
      text: caption.trim(),
      location: place,
      tags,
      hideLikes,
      noComments,
      name: store.profile.name,
      handle: place || store.profile.handle,
      avatar: store.profile.src,
      src: store.profile.src,
      likes: "0",
      comments: "0",
      saves: "0",
      time: "Now",
      created: Date.now(),
      mine: true,
      thread: [],
    };
    publishPost(store, item);
    showToast({ text: "Post condiviso", src: item.image });
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
  }

  const back = () => {
    tap();
    if (step === "pick") router.back();
    else setStep(step === "details" ? "edit" : "pick");
  };
  const title = step === "edit" ? "Modifica" : "Nuovo post";
  const stageH = aspect === "1:1" ? W : Math.round(W * 1.25);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={styles.head}>
        <Pressable accessibilityLabel={step === "pick" ? "Chiudi" : "Indietro"} hitSlop={8} onPress={back} style={styles.headBtn}>
          {step === "pick" ? <Close size={26} color={theme.text} /> : <ChevronLeft size={26} weight="bold" color={theme.text} />}
        </Pressable>
        <T size={16} weight="700">{title}</T>
        <Pressable hitSlop={8} disabled={!picked.length} onPress={() => { tap(); if (step === "details") publish(); else setStep(step === "pick" ? "edit" : "details"); }} style={[styles.headBtn, { alignItems: "flex-end", opacity: picked.length ? 1 : 0.4 }]}>
          <T size={15} weight="700" color={theme.blue}>{step === "details" ? "Condividi" : "Avanti"}</T>
        </Pressable>
      </View>

      {step === "pick" ? (
        <View style={{ flex: 1 }}>
          <View style={{ width: W, height: W, backgroundColor: "#000" }}>
            <Image source={{ uri: focus }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
            {aspect === "4:5" ? (
              <>
                <View pointerEvents="none" style={[styles.mask, { left: 0 }]} />
                <View pointerEvents="none" style={[styles.mask, { right: 0 }]} />
              </>
            ) : null}
            <Pressable accessibilityLabel="Formato" onPress={() => { tap(); setAspect((value) => (value === "4:5" ? "1:1" : "4:5")); }} style={[styles.chip, { left: 10 }]}>
              <T size={12.5} weight="700" color="#fff">{aspect}</T>
            </Pressable>
            <Pressable onPress={() => { tap(); setMulti((value) => !value); if (multi) setPicked([focus]); }} style={[styles.chip, { right: 10 }, multi && { backgroundColor: "#0095f6" }]}>
              <CopyGlyph size={15} weight={multi ? "fill" : "regular"} color="#fff" />
              <T size={12.5} weight="700" color="#fff">Seleziona più</T>
            </Pressable>
          </View>
          <View style={styles.bar}>
            <T size={16} weight="700">Recenti</T>
            <Pressable onPress={fromDevice} style={({ pressed }) => [styles.device, { backgroundColor: theme.fill, opacity: pressed ? 0.7 : 1 }]}>
              <ImageIcon size={16} color={theme.text} />
              <T size={13} weight="600">Libreria</T>
            </Pressable>
          </View>
          <FlashList
            data={["camera", ...gallery]}
            numColumns={4}
            keyExtractor={(item, index) => `${index}-${item}`}
            extraData={`${focus}|${picked.join(",")}|${multi}`}
            contentContainerStyle={{ paddingBottom: insets.bottom + 70 }}
            renderItem={({ item, index }) => (item === "camera" ? (
              <Pressable accessibilityLabel="Fotocamera" onPress={() => { tap(); router.replace(STORY_CAMERA); }} style={[styles.cell, styles.cam, { backgroundColor: theme.fill }]}>
                <Camera size={28} color={theme.text} />
              </Pressable>
            ) : (
              <GalleryCell src={item} index={index} focus={focus === item} n={picked.indexOf(item)} multi={multi} onPress={toggle} />
            ))}
          />
          <View style={[styles.modes, { bottom: insets.bottom + 14 }]}>
            <View style={[styles.mode, styles.modeOn]}><T size={12.5} weight="700" color="#fff" style={styles.modeText}>POST</T></View>
            <Pressable onPress={() => { tap(); router.replace(STORY_CAMERA); }} style={styles.mode}><T size={12.5} weight="700" color="rgba(255,255,255,0.7)" style={styles.modeText}>STORIA</T></Pressable>
            <Pressable onPress={() => { tap(); router.replace("/reel-camera"); }} style={styles.mode}><T size={12.5} weight="700" color="rgba(255,255,255,0.7)" style={styles.modeText}>REEL</T></Pressable>
            <Pressable onPress={() => { tap(); router.replace("/compose"); }} style={styles.mode}><T size={12.5} weight="700" color="rgba(255,255,255,0.7)" style={styles.modeText}>PENSIERO</T></Pressable>
          </View>
        </View>
      ) : null}

      {step === "edit" ? (
        <View style={{ flex: 1 }}>
          <View style={{ width: W, height: stageH, maxHeight: W * 1.1, backgroundColor: "#000" }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32} onScroll={(event) => setSlide(Math.round(event.nativeEvent.contentOffset.x / W))}>
              {picked.map((src) => <Filtered key={src} src={src} filter={filter} style={{ width: W, height: Math.min(stageH, W * 1.1) }} />)}
            </ScrollView>
            {picked.length > 1 ? (
              <View pointerEvents="none" style={styles.stageDots}>
                {picked.map((src, index) => <View key={src} style={[styles.stageDot, { backgroundColor: index === slide ? "#fff" : "rgba(255,255,255,0.45)" }]} />)}
              </View>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={{ flexGrow: 0, marginTop: "auto", marginBottom: insets.bottom + 20 }}>
            {POST_FILTERS.map((item) => {
              const on = filter === item.id;
              return (
                <Pressable key={item.id} onPress={() => { tap(); setFilter(item.id); }} style={styles.filterBtn}>
                  <T size={12} weight="600" color={on ? theme.text : theme.text2}>{item.label}</T>
                  <View style={[styles.filterThumbWrap, on && { borderColor: theme.text, transform: [{ scale: 1.06 }] }]}>
                    <Filtered src={picked[slide] || picked[0]} filter={item.id} style={styles.filterThumb} transition={0} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {step === "details" ? (
        <Details
          picked={picked} filter={filter} caption={caption} setCaption={setCaption}
          tags={tags} setTags={setTags} place={place} setPlace={setPlace} panel={panel} setPanel={setPanel}
          hideLikes={hideLikes} setHideLikes={setHideLikes} noComments={noComments} setNoComments={setNoComments}
          onShare={publish}
        />
      ) : null}
    </View>
  );
}

const GalleryCell = memo(function GalleryCell({ src, index, focus, n, multi, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => onPress(src)} style={[styles.cell, { marginLeft: index % 4 ? 2 : 0, backgroundColor: theme.fill }]}>
      <Image source={{ uri: src }} style={[StyleSheet.absoluteFill, { opacity: focus ? 0.55 : 1 }]} contentFit="cover" transition={120} recyclingKey={src} />
      {multi ? (
        <View style={[styles.n, n >= 0 && styles.nOn]}>{n >= 0 ? <T size={12} weight="700" color="#fff">{n + 1}</T> : null}</View>
      ) : null}
    </Pressable>
  );
});

function Details({ picked, filter, caption, setCaption, tags, setTags, place, setPlace, panel, setPanel, hideLikes, setHideLikes, noComments, setNoComments, onShare }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const pad = useAnimatedStyle(() => ({ paddingBottom: keyboard.height.value }));
  const tagLabel = useMemo(() => tags.map((name) => name.split(" ")[0]).join(", "), [tags]);
  return (
    <Animated.View style={[{ flex: 1 }, pad]}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.cap, { borderBottomColor: theme.line }]}>
          <View style={styles.thumb}>
            <Filtered src={picked[0]} filter={filter} style={StyleSheet.absoluteFill} />
            {picked.length > 1 ? <View style={styles.thumbBadge}><CopyGlyph size={14} weight="fill" color="#fff" /></View> : null}
          </View>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={2200}
            multiline
            autoFocus
            placeholder="Scrivi una didascalia… usa @ per menzionare e # per i tag"
            placeholderTextColor={theme.text2}
            accessibilityLabel="Didascalia"
            style={[styles.caption, { color: theme.text }]}
          />
        </View>
        <MentionSuggest value={caption} onPick={setCaption} style={{ marginHorizontal: INSET, marginTop: 8 }} />
        <Row icon={At} label="Tagga persone" value={tagLabel} onPress={() => setPanel(panel === "tag" ? null : "tag")} />
        {panel === "tag" ? (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.pick, { borderBottomColor: theme.line }]}>
            {CONTACTS.map((person) => {
              const on = tags.includes(person.name);
              return (
                <Pressable key={person.name} style={styles.pickCell} onPress={() => { tap(); setTags((prev) => (on ? prev.filter((name) => name !== person.name) : [...prev, person.name])); }}>
                  <View>
                    <Image source={{ uri: person.src }} style={[styles.pickFace, on && { transform: [{ scale: 0.9 }] }]} transition={120} />
                    {on ? <View style={styles.pickCheck}><Check size={11} weight="bold" color="#fff" /></View> : null}
                  </View>
                  <T size={11.5} lines={1}>{person.name.split(" ")[0]}</T>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
        <Row icon={MapPin} label="Aggiungi luogo" value={place} onPress={() => setPanel(panel === "place" ? null : "place")} />
        {panel === "place" ? (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.places, { borderBottomColor: theme.line }]}>
            {STORY_PLACES.map((name) => {
              const on = place === name;
              return (
                <Pressable key={name} onPress={() => { tap(); setPlace(on ? "" : name); setPanel(null); }} style={[styles.placeChip, { borderColor: on ? theme.text : theme.line, backgroundColor: on ? theme.text : "transparent" }]}>
                  <T size={14} weight="600" color={on ? theme.bg : theme.text}>{name}</T>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
        <T size={13} weight="600" color={theme.text2} style={styles.sub}>Impostazioni avanzate</T>
        <Row icon={Heart} label="Nascondi il numero di Mi piace" toggle={hideLikes} onPress={() => setHideLikes((value) => !value)} />
        <Row icon={Comment} label="Disattiva i commenti" toggle={noComments} onPress={() => setNoComments((value) => !value)} />
        <Pressable onPress={onShare} style={({ pressed }) => [styles.share, { backgroundColor: theme.blue, opacity: pressed ? 0.8 : 1 }]}>
          <T size={15} weight="700" color="#fff">Condividi</T>
        </Pressable>
      </ScrollView>
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
  head: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  headBtn: { minWidth: 80, paddingHorizontal: 4 },
  mask: { position: "absolute", top: 0, bottom: 0, width: "10%", backgroundColor: "rgba(0,0,0,0.45)" },
  chip: { position: "absolute", bottom: 10, height: 32, paddingHorizontal: 12, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.82)", flexDirection: "row", alignItems: "center", gap: 6 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: INSET },
  device: { height: 30, paddingHorizontal: 12, borderRadius: 99, flexDirection: "row", alignItems: "center", gap: 6 },
  cell: { width: CELL, height: CELL, marginTop: 2, overflow: "hidden" },
  cam: { alignItems: "center", justifyContent: "center" },
  n: { position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  nOn: { backgroundColor: "#0095f6", borderColor: "#0095f6" },
  modes: { position: "absolute", alignSelf: "center", flexDirection: "row", gap: 4, padding: 4, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.9)" },
  mode: { height: 32, paddingHorizontal: 16, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: "rgba(255,255,255,0.18)" },
  modeText: { letterSpacing: 0.5 },
  stageDots: { position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 },
  stageDot: { width: 6, height: 6, borderRadius: 3 },
  filters: { gap: 12, paddingHorizontal: INSET, paddingTop: 16, alignItems: "center" },
  filterBtn: { alignItems: "center", gap: 8 },
  filterThumbWrap: { borderRadius: 6, borderWidth: 2, borderColor: "transparent", overflow: "hidden" },
  filterThumb: { width: 76, height: 76 },
  cap: { flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 80, borderRadius: 6, overflow: "hidden" },
  thumbBadge: { position: "absolute", top: 4, right: 4 },
  caption: { flex: 1, minHeight: 80, fontSize: 15, lineHeight: 21, textAlignVertical: "top", paddingTop: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  pick: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, paddingVertical: 12, paddingHorizontal: INSET - 4, borderBottomWidth: StyleSheet.hairlineWidth },
  pickCell: { width: (W - (INSET - 4) * 2) / 5, alignItems: "center", gap: 4 },
  pickFace: { width: 50, height: 50, borderRadius: 25 },
  pickCheck: { position: "absolute", top: 0, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  places: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  placeChip: { height: 34, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sub: { marginTop: 18, marginBottom: 4, marginHorizontal: INSET },
  share: { height: 46, borderRadius: 10, marginHorizontal: INSET, marginTop: 24, alignItems: "center", justifyContent: "center" },
});
