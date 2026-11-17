import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router } from "expo-router";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import * as LegacyFS from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import {
  BRUSHES, CREATE_GRADIENTS, MAX_CLIP, STORY_EMOJI, STORY_FILTERS, STORY_KIT, TEXT_FONTS, TEXT_SWATCHES, filterOf, gradientPng,
} from "../../lib/stories";
import { createStory, useSearch, useShop } from "../../lib/social";
import { useMe } from "../../lib/session";
import { errorText, uploadMedia } from "../../lib/api";
import { euro } from "../../data";
import { At, Bag, ChevronLeft, Close, Download, Hash, Heart, MapPin, More, Search, Star } from "../../ui/icons";
import {
  BarChart, Checked, Eraser, Flash, FlashOff, Grid4, Hand, HelpCircle, Highlighter, LinkIcon, MessageCircle, Pencil, Ring,
  Images, Rows, Scribble, Smile, SoundOff, SoundOn, Sparkle, StickerIcon, SwitchCamera, TextIcon, Timer, Undo,
} from "../../ui/storyIcons";
import { Avatar, T, tap } from "../../ui/kit";
import { DrawingLayer, LoopClip, StickerFace, StoryMedia, StrokePath, textBox, textStyle } from "../../ui/story";
import { keepMedia } from "../../lib/media-store";
import { t, tk } from "../../lib/i18n";

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const KIT_ICONS = { place: MapPin, tag: At, product: Bag, hash: Hash, emoji: Smile, poll: BarChart, ask: MessageCircle, quiz: HelpCircle, slider: Heart, link: LinkIcon };
// The server keeps up to 20 stickers and about 20 KB of overlay data per story.
const MAX_STICKERS = 20;
const MAX_EXTRA = 19000;
const BRUSH_ICONS = { pen: Pencil, marker: Highlighter, neon: Sparkle, eraser: Eraser };
let uid = 0;
const nextUid = () => `s${Date.now().toString(36)}${(uid += 1)}`;

export default function StoryCamera() {
  const { width: W, height: H } = useWindowDimensions();
  const u = W / 390;
  const insets = useSafeAreaInsets();
  const me = useMe();
  const camRef = useRef(null);
  const holdRef = useRef({ timer: 0, y: 0, zoom: 1, clip: false, recording: false });
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [camOn, setCamOn] = useState(false);
  const [camMode, setCamMode] = useState("picture");
  const [facing, setFacing] = useState("front");
  const [mode, setMode] = useState("story");
  const [flash, setFlash] = useState(false);
  const [timer, setTimer] = useState(0);
  const [handsFree, setHandsFree] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [recording, setRecording] = useState(0);
  const [recSeconds, setRecSeconds] = useState(0);
  const [blink, setBlink] = useState(0);
  const [layout, setLayout] = useState(2);
  const [cells, setCells] = useState([]);
  const [gradient, setGradient] = useState(0);
  const [media, setMedia] = useState(null);
  const [filter, setFilter] = useState("normal");
  const [filterHint, setFilterHint] = useState(0);
  const [muted, setMuted] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [tool, setTool] = useState(null);
  const [find, setFind] = useState("");
  const [editor, setEditor] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [hot, setHot] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);
  // The newest photo in the phone's library, for the gallery button (only if access was already given).
  const [lastShot, setLastShot] = useState(null);

  function note(text) {
    setToast({ text, at: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  }

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam();
  }, [camPerm, requestCam]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await MediaLibrary.getPermissionsAsync();
        if (!perm.granted) return;
        const page = await MediaLibrary.getAssetsAsync({ first: 1, mediaType: ["photo", "video"], sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
        if (alive && page.assets[0]?.uri) setLastShot(page.assets[0].uri);
      } catch { /* no library access */ }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => {
      const secs = (Date.now() - recording) / 1000;
      setRecSeconds(secs);
    }, 100);
    return () => clearInterval(id);
  }, [recording]);

  const canShoot = Boolean(camPerm?.granted) && camOn;

  async function frameFromCamera() {
    if (!canShoot || !camRef.current) return null;
    try {
      const shot = await camRef.current.takePictureAsync({ quality: 0.85, shutterSound: false });
      // The iOS simulator has no camera and returns a 200×200 placeholder: treat it as no camera.
      if (!shot?.uri || (shot.width <= 200 && shot.height <= 200)) return null;
      return await keepMedia(shot.uri, "story");
    } catch {
      return null;
    }
  }

  function takePhoto() {
    tap();
    const front = flash && facing === "front";
    setBlink(Date.now());
    const run = async () => {
      const src = await frameFromCamera();
      // No camera (simulator, or access denied): pick from the gallery instead of a stock photo.
      if (!src) {
        fromLibrary();
        return;
      }
      if (mode === "layout") {
        const next = [...cells, src];
        if (next.length >= layout) {
          setCells([]);
          openEditor({ type: "layout", cells: next, layout });
        } else setCells(next);
        return;
      }
      openEditor({ type: "image", src });
    };
    if (front) setTimeout(run, 220);
    else run();
  }

  function shoot() {
    if (mode === "create") {
      openEditor({ type: "gradient", gradient: CREATE_GRADIENTS[gradient] });
      setEditor({ open: Date.now(), text: "", color: "#ffffff", font: "classic", bg: "" });
      return;
    }
    if (handsFree && mode === "story") {
      if (holdRef.current.recording) stopClip();
      else startClip();
      return;
    }
    if (timer) {
      let left = timer;
      setCountdown(left);
      const id = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(id);
          setCountdown(0);
          takePhoto();
        } else {
          setCountdown(left);
          tap();
        }
      }, 1000);
      return;
    }
    takePhoto();
  }

  async function startClip() {
    if (!canShoot || !camRef.current) {
      note(t("Video non disponibile qui"));
      return;
    }
    if (!micPerm?.granted) {
      const answer = await requestMic();
      if (!answer?.granted) {
        note(t("Serve il microfono per il video"));
        return;
      }
    }
    holdRef.current.recording = true;
    setCamMode("video");
    setRecording(Date.now());
    setRecSeconds(0);
    tap("medium");
    // The camera switches output before recording can start.
    setTimeout(async () => {
      if (!holdRef.current.recording) {
        setCamMode("picture");
        return;
      }
      try {
        const clip = await camRef.current?.recordAsync({ maxDuration: MAX_CLIP });
        if (clip?.uri) openEditor({ type: "video", src: await keepMedia(clip.uri, "story") });
      } catch {
        note(t("Video non disponibile qui"));
      } finally {
        holdRef.current.recording = false;
        setRecording(0);
        setCamMode("picture");
      }
    }, 450);
  }

  function stopClip() {
    holdRef.current.recording = false;
    setRecording(0);
    try { camRef.current?.stopRecording(); } catch { /* not recording */ }
  }

  // Shutter: tap = photo, hold = video, slide up while holding = zoom.
  const shutter = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      if (mode !== "story" || handsFree || countdown) return;
      holdRef.current.y = e.nativeEvent.pageY;
      holdRef.current.zoom = zoom;
      holdRef.current.clip = false;
      clearTimeout(holdRef.current.timer);
      holdRef.current.timer = setTimeout(() => {
        holdRef.current.clip = true;
        startClip();
      }, 320);
    },
    onResponderMove: (e) => {
      if (!holdRef.current.recording) return;
      const lift = Math.max(0, holdRef.current.y - e.nativeEvent.pageY);
      setZoom(Math.min(4, Math.max(1, holdRef.current.zoom + lift / 90)));
    },
    onResponderRelease: () => {
      clearTimeout(holdRef.current.timer);
      if (countdown) return;
      if (holdRef.current.clip) {
        holdRef.current.clip = false;
        if (holdRef.current.recording) stopClip();
        return;
      }
      shoot();
    },
  };

  function openEditor(next) {
    setMedia(next);
    setFilter("normal");
    setStickers([]);
    setTool(null);
    setZoom(1);
    setMuted(false);
  }

  async function fromLibrary() {
    tap();
    const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, 
      mediaTypes: mode === "layout" ? ["images"] : ["images", "videos"],
      quality: 0.88,
      videoMaxDuration: MAX_CLIP,
    }).catch(() => null);
    const picked = result && !result.canceled ? result.assets?.[0] : null;
    if (!picked) return;
    const asset = { ...picked, uri: await keepMedia(picked.uri, "story") };
    if (asset.type === "video") {
      openEditor({ type: "video", src: asset.uri });
      return;
    }
    if (mode === "layout") {
      const next = [...cells, asset.uri];
      if (next.length >= layout) {
        setCells([]);
        openEditor({ type: "layout", cells: next, layout });
      } else setCells(next);
      return;
    }
    openEditor({ type: "image", src: asset.uri });
  }

  function leaveEditor() {
    setMedia(null);
    setStickers([]);
    setTool(null);
    setEditor(null);
    setSheet(null);
  }

  function addSticker(sticker) {
    tap();
    if (stickers.length >= MAX_STICKERS) {
      note(t("Massimo {n} sticker per storia", { n: MAX_STICKERS }));
      setTool(null);
      return;
    }
    setStickers((prev) => {
      const many = ["emoji", "tag", "hash", "place", "link", "text", "draw", "product"].includes(sticker.type);
      const rest = many ? prev : prev.filter((item) => item.type !== sticker.type);
      return [...rest, { s: 1, r: 0, x: 50, y: 40 + ((rest.length % 4) * 6), ...sticker, uid: nextUid(), fresh: Date.now() }];
    });
    setTool(null);
    setFind("");
  }

  function saveText() {
    const draft = editor;
    setEditor(null);
    Keyboard.dismiss();
    if (!draft) return;
    const text = draft.text.trim();
    if (draft.uid) {
      setStickers((prev) => (text
        ? prev.map((item) => (item.uid === draft.uid ? { ...item, text, color: draft.color, font: draft.font, bg: draft.bg } : item))
        : prev.filter((item) => item.uid !== draft.uid)));
      return;
    }
    if (text) addSticker({ type: "text", text, color: draft.color, font: draft.font, bg: draft.bg, y: 46 });
  }

  function nextFilter(direction) {
    const index = STORY_FILTERS.findIndex((item) => item.id === filter);
    const next = STORY_FILTERS[(index + direction + STORY_FILTERS.length) % STORY_FILTERS.length];
    setFilter(next.id);
    setFilterHint(Date.now());
    tap();
  }

  async function saveToDevice() {
    const uri = media?.type === "image" || media?.type === "video" ? media.src : media?.type === "layout" ? media.cells[0] : null;
    if (!uri || !/^file:/.test(uri)) {
      note(t("Non si può salvare questa storia"));
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        note(t("Permesso negato"));
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      note(t("Salvata"));
    } catch {
      note(t("Non si può salvare questa storia"));
    }
  }

  // What the server stores with the picture: the overlay (stickers, drawings, text) and the look
  // (filter, collage, gradient, mute). The viewer draws them on top, so nothing is flattened here.
  function overlay(closeFriends) {
    let list = stickers.map(({ uid: _uid, fresh: _fresh, ...rest }) => rest);
    // Typed text and mentions also go in `text`, so mentioned people get notified.
    const text = list.flatMap((item) => (item.type === "text" ? [item.text] : item.type === "tag" && item.handle ? [`@${item.handle}`] : [])).join(" ").slice(0, 300);
    const size = (items) => JSON.stringify({ text, stickers: items, closeFriends, style: { filter, muted, gradient: media.gradient, cells: media.cells, layout: media.layout } }).length;
    if (size(list) > MAX_EXTRA) {
      // Long drawings: whole-unit coordinates are plenty on a 1000-unit canvas.
      list = list.map((item) => (item.type === "draw" ? { ...item, paths: item.paths.map((path) => ({ ...path, d: path.d.replace(/(\d+)\.\d+/g, "$1") })) } : item));
    }
    let dropped = false;
    if (size(list) > MAX_EXTRA) {
      list = list.filter((item) => item.type !== "draw");
      dropped = true;
    }
    return { text, stickers: list, dropped };
  }

  async function publish(closeFriends) {
    if (!media || sending) return;
    setSheet(null);
    setSending(true);
    tap("medium");
    try {
      const style = { filter };
      let uri = "";
      let type = "image";
      if (media.type === "video") {
        uri = media.src;
        type = "video";
        style.muted = muted;
      } else if (media.type === "image") {
        uri = media.src;
      } else if (media.type === "layout") {
        // A collage: every photo is uploaded, the first one is the story's picture.
        const cells = [];
        for (const cell of media.cells) cells.push(await uploadMedia(cell));
        style.cells = cells;
        style.layout = media.layout;
        uri = cells[0];
      } else if (media.type === "gradient") {
        const file = `${LegacyFS.cacheDirectory}story-${Date.now()}.png`;
        await LegacyFS.writeAsStringAsync(file, gradientPng(media.gradient), { encoding: LegacyFS.EncodingType.Base64 });
        uri = file;
        style.gradient = media.gradient;
      }
      const { text, stickers: list, dropped } = overlay(closeFriends);
      await createStory({ uri, type, text, stickers: list, closeFriends, style });
      if (dropped) note(t("Il disegno era troppo grande ed è stato tolto"));
      fly.value = withTiming(1, { duration: 540, easing: Easing.bezier(0.5, 0, 0.2, 1) }, () => runOnJS(finish)());
    } catch (error) {
      setSending(false);
      note(errorText(error, t));
    }
  }

  // The finished story flies into "La tua storia" in the rail, then the camera closes.
  const fly = useSharedValue(0);
  const flyStyle = useAnimatedStyle(() => {
    const k = fly.value;
    const tx = (10 + 40 - W / 2) * k;
    const ty = (insets.top + 100 - H / 2) * k;
    return {
      opacity: k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45,
      borderRadius: k * W,
      transform: [{ translateX: tx }, { translateY: ty }, { scale: 1 - k * 0.83 }],
    };
  });

  function finish() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  const busyUi = Boolean(tool || editor || dragging || sheet || sending);
  const trash = { x: W / 2, y: H - (insets.bottom + 44 + 28) };

  // ---------------------------------------------------------------- capture
  if (!media) {
    const ringTotal = 2 * Math.PI * 46;
    const tip = mode === "story"
      ? (handsFree ? t("Tocca per iniziare e fermare") : t("Tocca per la foto, tieni premuto per il video"))
      : mode === "layout" ? t("Ancora {n}", { n: layout - cells.length }) : t("Tocca ovunque per scrivere");
    const permDenied = camPerm && !camPerm.granted;
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ statusBarHidden: true }} />
        {mode === "create" ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={shoot}>
            <LinearGradient colors={CREATE_GRADIENTS[gradient]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
              <T size={26 * u} weight="700" color="rgba(255,255,255,0.85)">{t("Tocca per scrivere")}</T>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={StyleSheet.absoluteFill}>
            {camPerm?.granted ? (
              <CameraView
                ref={camRef}
                style={[StyleSheet.absoluteFill, { opacity: camOn ? 1 : 0 }]}
                facing={facing}
                mode={camMode}
                mirror={facing === "front"}
                zoom={Math.min(1, (zoom - 1) / 6)}
                enableTorch={flash && facing === "back"}
                onCameraReady={() => setCamOn(true)}
                onMountError={() => setCamOn(false)}
              />
            ) : null}
            {permDenied ? (
              <View style={styles.permBox}>
                <T size={15} weight="700" color="#fff" style={{ textAlign: "center" }}>{t("Consenti l'accesso alla fotocamera")}</T>
                <T size={13} color="rgba(255,255,255,0.75)" style={{ textAlign: "center" }}>{t("Oppure scegli una foto dalla galleria.")}</T>
                {camPerm.canAskAgain ? (
                  <Pressable style={styles.permBtn} onPress={requestCam}><T size={14} weight="700" color="#111">{t("Consenti")}</T></Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
        {mode === "layout" ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: "row", flexWrap: "wrap", gap: 2 }]}>
            {Array.from({ length: layout }, (_, i) => (
              <View key={i} style={{ width: layout === 4 ? (W - 2) / 2 : W, height: (H - 2) / 2, overflow: "hidden", backgroundColor: i === cells.length || cells[i] ? "transparent" : "rgba(0,0,0,0.35)", borderWidth: i === cells.length ? 2 : 1, borderColor: i === cells.length ? "#fff" : "rgba(255,255,255,0.35)" }}>
                {cells[i] ? <Image source={{ uri: cells[i] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
              </View>
            ))}
          </View>
        ) : null}
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.38)", "transparent"]} locations={[0, 0.16]} style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.5)"]} locations={[0.72, 1]} style={StyleSheet.absoluteFill} />
        {blink ? <FlashBlink key={blink} front={flash && facing === "front"} /> : null}
        {countdown ? <CountPop key={countdown} value={countdown} u={u} /> : null}
        {zoom > 1.01 ? <View style={[styles.badge, { bottom: insets.bottom + 200 }]}><T size={13} weight="700" color="#fff">{zoom.toFixed(1)}×</T></View> : null}
        {recording ? (
          <View style={[styles.badge, { top: insets.top + 12, flexDirection: "row", gap: 6, alignItems: "center" }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff3040" }} />
            <T size={13} weight="700" color="#fff">{`0:${String(Math.floor(recSeconds)).padStart(2, "0")}`}</T>
          </View>
        ) : null}

        {!recording ? (
          <>
            <View style={[styles.top, { top: insets.top + 8 }]}>
              <GlassBtn label={t("Chiudi")} onPress={finish}><Close size={22} color="#fff" /></GlassBtn>
              <GlassBtn label={t("Flash")} on={flash} onPress={() => setFlash((value) => !value)}>
                {flash ? <Flash size={22} weight="fill" color="#111" /> : <FlashOff size={22} color="#fff" />}
              </GlassBtn>
            </View>

            <View style={[styles.rail, { top: insets.top + 70 }]}>
              <RailBtn icon={TextIcon} label={t("Crea")} on={mode === "create"} onPress={() => setMode(mode === "create" ? "story" : "create")} />
              <RailBtn icon={layout === 2 ? Rows : Grid4} label={t("Layout")} on={mode === "layout"} onPress={() => { setMode(mode === "layout" ? "story" : "layout"); setCells([]); }} />
              {mode === "create" ? (
                <Pressable style={styles.railRow} onPress={() => { tap(); setGradient((value) => (value + 1) % CREATE_GRADIENTS.length); }}>
                  <LinearGradient colors={CREATE_GRADIENTS[(gradient + 1) % CREATE_GRADIENTS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.railSub, { borderWidth: 2, borderColor: "#fff" }]} />
                  <T size={13.5} weight="600" color="#fff" style={styles.shadow}>{t("Colore")}</T>
                </Pressable>
              ) : null}
              {mode === "layout" ? (
                <Pressable style={styles.railRow} onPress={() => { tap(); setLayout((value) => (value === 2 ? 4 : 2)); setCells([]); }}>
                  <View style={[styles.railSub, styles.glass]}>{layout === 2 ? <Grid4 size={18} color="#fff" /> : <Rows size={18} color="#fff" />}</View>
                  <T size={13.5} weight="600" color="#fff" style={styles.shadow}>{layout === 2 ? "4" : "2"}</T>
                </Pressable>
              ) : null}
              <RailBtn icon={Hand} label={t("Mani libere")} on={handsFree} onPress={() => setHandsFree((value) => !value)} />
              <RailBtn icon={Timer} label={t("Timer")} on={Boolean(timer)} badge={timer || null} onPress={() => setTimer((value) => (value === 0 ? 3 : value === 3 ? 10 : 0))} />
            </View>
          </>
        ) : null}

        <View style={[styles.bottom, { bottom: insets.bottom + 64 }]}>
          <View style={{ flex: 1, alignItems: "flex-start", opacity: recording ? 0 : 1 }}>
            <Pressable style={({ pressed }) => [styles.roll, { transform: [{ scale: pressed ? 0.9 : 1 }] }]} accessibilityLabel={t("Galleria")} onPress={fromLibrary} disabled={Boolean(recording)}>
              {lastShot ? <Image source={{ uri: lastShot }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <View style={styles.rollEmpty}><Images size={22} color="#fff" /></View>}
            </Pressable>
          </View>
          <View {...shutter} accessibilityRole="button" accessibilityLabel={t("Scatta, tieni premuto per il video")} style={[styles.shutter, { transform: [{ scale: recording ? 1.22 : 1 }] }]}>
            <Svg width={84} height={84} viewBox="0 0 100 100" style={[StyleSheet.absoluteFill, { transform: [{ rotate: "-90deg" }] }]}>
              <Circle cx="50" cy="50" r="46" fill="none" stroke={recording ? "rgba(255,255,255,0.35)" : "#fff"} strokeWidth={5} />
              {recording ? <Circle cx="50" cy="50" r="46" fill="none" stroke="#ff3040" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${ringTotal}`} strokeDashoffset={ringTotal * (1 - Math.min(1, recSeconds / MAX_CLIP))} /> : null}
            </Svg>
            <View style={{ width: 68, height: 68, borderRadius: handsFree && recording ? 10 : 34, backgroundColor: recording || handsFree ? "#ff3040" : "#fff", transform: [{ scale: recording ? 0.5 : 1 }] }} />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end", opacity: recording ? 0 : 1 }}>
            <GlassBtn label={t("Gira fotocamera")} onPress={() => { if (camPerm?.granted) setFacing((value) => (value === "back" ? "front" : "back")); }}>
              <SpinIcon turn={facing}><SwitchCamera size={22} color="#fff" /></SpinIcon>
            </GlassBtn>
          </View>
        </View>
        {!recording ? (
          <>
            <View style={[styles.modes, { bottom: insets.bottom + 22 }]}>
              {[["create", tk("CREA")], ["story", tk("STORIA")], ["layout", tk("LAYOUT")]].map(([id, label]) => (
                <Pressable key={id} hitSlop={8} onPress={() => { tap(); setMode(id); setCells([]); }}>
                  <T size={13} weight="700" color={mode === id ? "#fff" : "rgba(255,255,255,0.55)"} style={{ letterSpacing: 0.8, transform: [{ scale: mode === id ? 1.06 : 1 }] }}>{t(label)}</T>
                </Pressable>
              ))}
            </View>
            <T size={12.5} color="rgba(255,255,255,0.8)" style={[styles.tip, styles.shadow, { bottom: insets.bottom + 164 }]}>{tip}</T>
          </>
        ) : null}
        {toast ? <Toast key={toast.at} text={toast.text} bottom={insets.bottom + 84} /> : null}
      </View>
    );
  }

  // ---------------------------------------------------------------- editor
  const filterNow = filterOf(filter);
  const draws = stickers.filter((item) => item.type === "draw");
  const movable = stickers.filter((item) => item.type !== "draw");

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ statusBarHidden: true }} />
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: "hidden", backgroundColor: "#000" }, flyStyle]}>
        <SwipeFilters enabled={!busyUi} onSwipe={nextFilter}>
          <View style={StyleSheet.absoluteFill}>
            {media.type === "video" ? (
              <LoopClip uri={media.src} muted={muted} filter={filter} />
            ) : (
              <StoryMedia frame={{ id: "edit", image: media.src, cells: media.cells, layout: media.layout, gradient: media.gradient, filter }} />
            )}
          </View>
        </SwipeFilters>
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.38)", "transparent"]} locations={[0, 0.16]} style={[StyleSheet.absoluteFill, { opacity: busyUi ? 0.6 : 1 }]} />
        <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.5)"]} locations={[0.72, 1]} style={[StyleSheet.absoluteFill, { opacity: busyUi ? 0.6 : 1 }]} />
        {filterHint ? <FilterName key={filterHint} label={t(filterNow.label)} u={u} /> : null}

        {draws.map((item) => <DrawingLayer key={item.uid} item={item} w={W} h={H} />)}
        {movable.map((item) => (
          <EditableSticker
            key={item.uid}
            item={item}
            w={W}
            h={H}
            u={u}
            trash={trash}
            onDrag={setDragging}
            onHot={(on) => { setHot(on); if (on) tap(); }}
            onChange={(patch) => setStickers((prev) => prev.map((entry) => (entry.uid === item.uid ? { ...entry, ...patch, fresh: 0 } : entry)))}
            onRemove={() => { setHot(false); setStickers((prev) => prev.filter((entry) => entry.uid !== item.uid)); }}
            onEdit={item.type === "text" ? () => setEditor({ open: Date.now(), uid: item.uid, text: item.text, color: item.color, font: item.font || "classic", bg: item.bg || "" }) : null}
          />
        ))}
        {dragging ? (
          <View pointerEvents="none" style={[styles.trash, { bottom: insets.bottom + 44, transform: [{ scale: hot ? 1.3 : 1 }], backgroundColor: hot ? "#ff3040" : "rgba(0,0,0,0.3)", borderColor: hot ? "#ff3040" : "#fff" }]}>
            <Close size={24} weight="bold" color="#fff" />
          </View>
        ) : null}

        {!busyUi ? (
          <View style={[styles.top, { top: insets.top + 8 }]}>
            <GlassBtn label={t("Indietro")} onPress={() => (stickers.length ? setSheet("discard") : leaveEditor())}><ChevronLeft size={22} color="#fff" /></GlassBtn>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <GlassBtn label={t("Testo")} onPress={() => setEditor({ open: Date.now(), text: "", color: "#ffffff", font: "classic", bg: "" })}><TextIcon size={22} color="#fff" /></GlassBtn>
              <GlassBtn label={t("Sticker")} onPress={() => setTool("tray")}><StickerIcon size={22} color="#fff" /></GlassBtn>
              <GlassBtn label={t("Filtri")} onPress={() => setTool("filters")}><Sparkle size={22} color="#fff" /></GlassBtn>
              <GlassBtn label={t("Disegna")} onPress={() => setTool("draw")}><Scribble size={22} color="#fff" /></GlassBtn>
              <GlassBtn label={t("Altro")} onPress={() => setSheet("more")}><More size={22} weight="bold" color="#fff" /></GlassBtn>
            </View>
          </View>
        ) : null}

        {media.type === "video" && !busyUi ? (
          <View style={{ position: "absolute", top: insets.top + 58, left: 10 }}>
            <GlassBtn label={muted ? t("Attiva audio") : t("Silenzia")} onPress={() => setMuted((value) => !value)}>
              {muted ? <SoundOff size={22} color="#fff" /> : <SoundOn size={22} color="#fff" />}
            </GlassBtn>
          </View>
        ) : null}

        {tool === "filters" ? (
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={[styles.filters, { paddingBottom: insets.bottom + 22 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}>
              {STORY_FILTERS.map((item) => {
                const on = filter === item.id;
                const thumb = media.type === "image" ? media.src : media.type === "layout" ? media.cells[0] : me?.avatar || "";
                return (
                  <Pressable key={item.id} style={{ alignItems: "center", gap: 6 }} onPress={() => { tap(); setFilter(item.id); setFilterHint(Date.now()); }}>
                    <View style={{ width: 58, height: 58, borderRadius: 29, overflow: "hidden", borderWidth: 2, borderColor: on ? "#fff" : "transparent", transform: [{ scale: on ? 1.12 : 1 }] }}>
                      {media.type === "gradient" ? <LinearGradient colors={media.gradient} style={StyleSheet.absoluteFill} /> : <StoryMedia frame={{ id: `f-${item.id}`, image: thumb, filter: item.id }} />}
                    </View>
                    <T size={11.5} weight="600" color="#fff">{t(item.label)}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setTool(null)} style={styles.done}><T size={16} weight="700" color="#fff">{t("Fine")}</T></Pressable>
          </LinearGradient>
        ) : null}

        {tool === "draw" ? (
          <DrawPad w={W} h={H} top={insets.top} bottom={insets.bottom} onDone={(item) => { if (item) setStickers((prev) => [...prev, { ...item, uid: nextUid() }]); setTool(null); }} />
        ) : null}

        {tool && tool !== "draw" && tool !== "filters" ? (
          <Tray tool={tool} setTool={setTool} find={find} setFind={setFind} addSticker={addSticker} bottom={insets.bottom} />
        ) : null}

        {editor ? <TextEditor draft={editor} setDraft={setEditor} onDone={saveText} u={u} top={insets.top} /> : null}

        {!busyUi ? (
          <View style={[styles.share, { bottom: insets.bottom + 18 }]}>
            <Pressable style={styles.pill} disabled={sending} onPress={() => publish(false)} accessibilityLabel={t("Pubblica nella tua storia")}>
              <Avatar src={me?.avatar} size={26} style={{ borderRadius: 13, borderWidth: 1.5, borderColor: "#fff" }} />
              <T size={13.5} weight="600" color="#fff" lines={1}>{t("La tua storia")}</T>
            </Pressable>
            <Pressable style={styles.pill} disabled={sending} onPress={() => publish(true)} accessibilityLabel={t("Pubblica per gli amici stretti")}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#1fcf5c", alignItems: "center", justifyContent: "center" }}><Star size={14} weight="fill" color="#fff" /></View>
              <T size={13.5} weight="600" color="#fff" lines={1}>{t("Amici stretti")}</T>
            </Pressable>
          </View>
        ) : null}
        {sending ? (
          <View style={[StyleSheet.absoluteFill, styles.sending]}>
            <ActivityIndicator size="large" color="#fff" />
            <T size={14} weight="600" color="#fff">{t("Pubblicazione…")}</T>
          </View>
        ) : null}
      </Animated.View>

      {sheet === "more" ? (
        <DarkSheet onClose={() => setSheet(null)} bottom={insets.bottom}>
          <SheetRow icon={Download} label={t("Salva sul dispositivo")} onPress={() => { setSheet(null); saveToDevice(); }} />
          <SheetRow icon={At} label={t("Menziona qualcuno")} onPress={() => { setSheet(null); setTool("tag"); }} />
          <SheetRow icon={MapPin} label={t("Aggiungi luogo")} onPress={() => { setSheet(null); setTool("place"); }} />
          {media.type === "video" ? <SheetRow icon={muted ? SoundOn : SoundOff} label={muted ? t("Attiva audio") : t("Silenzia")} onPress={() => { setSheet(null); setMuted((value) => !value); }} /> : null}
          <SheetRow icon={Close} warn label={t("Scarta")} onPress={() => setSheet("discard")} />
        </DarkSheet>
      ) : null}

      {sheet === "discard" ? (
        <DarkSheet onClose={() => setSheet(null)} bottom={insets.bottom}>
          <T size={14} color="rgba(255,255,255,0.7)" style={{ textAlign: "center", paddingHorizontal: 24, paddingVertical: 12 }}>{t("Scartare questa storia? Le modifiche andranno perse.")}</T>
          <SheetRow warn label={t("Scarta")} onPress={leaveEditor} />
          <SheetRow label={t("Continua a modificare")} onPress={() => setSheet(null)} />
        </DarkSheet>
      ) : null}

      {toast ? <Toast key={toast.at} text={toast.text} bottom={insets.bottom + 84} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- pieces

function GlassBtn({ children, onPress, on, label }) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [styles.glassBtn, on ? { backgroundColor: "#fff" } : null, { transform: [{ scale: pressed ? 0.86 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

function RailBtn({ icon: Icon, label, on, badge, onPress }) {
  return (
    <Pressable style={styles.railRow} onPress={() => { tap(); onPress(); }} accessibilityLabel={label}>
      {({ pressed }) => (
        <>
          <View style={[styles.railIcon, on ? { backgroundColor: "#fff" } : styles.glass, { transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
            <Icon size={21} color={on ? "#111" : "#fff"} />
            {badge ? <View style={styles.railBadge}><T size={10.5} weight="700" color="#111">{badge}</T></View> : null}
          </View>
          {on ? <T size={13.5} weight="600" color="#fff" style={styles.shadow}>{label}</T> : null}
        </>
      )}
    </Pressable>
  );
}

function SpinIcon({ turn, children }) {
  const v = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    v.value = withTiming(v.value + 180, { duration: 420, easing: EASE });
  }, [turn, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.value}deg` }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function FlashBlink({ front }) {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = front ? withSequence(withTiming(1, { duration: 280 }), withTiming(0, { duration: 340 })) : withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) });
  }, [front, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", zIndex: 30 }, style]} />;
}

function CountPop({ value, u }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 1000 });
  }, [v]);
  const style = useAnimatedStyle(() => {
    const k = v.value;
    return {
      opacity: k < 0.2 ? k / 0.2 : k > 0.85 ? (1 - k) / 0.15 : 1,
      transform: [{ scale: k < 0.2 ? 1.6 - 3 * k : k > 0.85 ? 1 - ((k - 0.85) / 0.15) * 0.2 : 1 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", zIndex: 20 }, style]}>
      <T size={140 * u} weight="800" color="#fff" style={{ textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 30, textShadowOffset: { width: 0, height: 6 } }}>{value}</T>
    </Animated.View>
  );
}

function FilterName({ label, u }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 1100 });
  }, [v]);
  const style = useAnimatedStyle(() => {
    const k = v.value;
    return {
      opacity: k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1,
      transform: [{ scale: k < 0.15 ? 0.9 + (k / 0.15) * 0.1 : 1 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: "44%", left: 0, right: 0, alignItems: "center" }, style]}>
      <T size={30 * u} weight="700" color="#fff" style={{ letterSpacing: -0.6, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } }}>{label}</T>
    </Animated.View>
  );
}

// Swipe sideways on the photo to change filter, like every camera app.
function SwipeFilters({ enabled, onSwipe, children }) {
  const gesture = useMemo(() => Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-20, 20])
    .failOffsetY([-30, 30])
    .onEnd((e) => {
      if (Math.abs(e.translationX) >= 50 && Math.abs(e.translationX) > Math.abs(e.translationY)) runOnJS(onSwipe)(e.translationX < 0 ? 1 : -1);
    }), [enabled, onSwipe]);
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

// A sticker on the editor: drag, pinch to scale, twist to rotate, drop on the bin, tap text to edit.
function EditableSticker({ item, w, h, u, trash, onDrag, onHot, onChange, onRemove, onEdit }) {
  const x = useSharedValue(item.x ?? 50);
  const y = useSharedValue(item.y ?? 40);
  const s = useSharedValue(item.s || 1);
  const r = useSharedValue(item.r || 0);
  const base = useSharedValue({ x: 0, y: 0, s: 1, r: 0 });
  const doomed = useSharedValue(0);
  const pop = useSharedValue(item.fresh ? 0 : 1);
  const pinchBase = useSharedValue(1);
  const turnBase = useSharedValue(0);

  useEffect(() => {
    x.value = item.x ?? 50;
    y.value = item.y ?? 40;
    s.value = item.s || 1;
    r.value = item.r || 0;
  }, [item.x, item.y, item.s, item.r, x, y, s, r]);

  useEffect(() => {
    if (item.fresh) pop.value = withSpring(1, { damping: 10, stiffness: 240 });
  }, [item.fresh, pop]);

  const gesture = useMemo(() => {
    const commit = () => {
      "worklet";
      if (doomed.value) runOnJS(onRemove)();
      else runOnJS(onChange)({ x: x.value, y: y.value, s: s.value, r: r.value });
    };
    const pan = Gesture.Pan()
      .minDistance(4)
      .averageTouches(true)
      .hitSlop(16)
      .onStart(() => {
        base.value = { x: x.value, y: y.value, s: s.value, r: r.value };
        runOnJS(onDrag)(true);
      })
      .onUpdate((e) => {
        x.value = Math.min(96, Math.max(4, base.value.x + (e.translationX / w) * 100));
        y.value = Math.min(94, Math.max(6, base.value.y + (e.translationY / h) * 100));
        const near = Math.hypot(e.absoluteX - trash.x, e.absoluteY - trash.y) < 60 ? 1 : 0;
        if (near !== doomed.value) {
          doomed.value = near;
          runOnJS(onHot)(Boolean(near));
        }
      })
      .onEnd(() => commit())
      .onFinalize(() => {
        runOnJS(onDrag)(false);
      });
    const pinch = Gesture.Pinch()
      .hitSlop(40)
      .onStart(() => { pinchBase.value = s.value; })
      .onUpdate((e) => { s.value = Math.max(0.35, Math.min(5, pinchBase.value * e.scale)); })
      .onEnd(() => commit());
    const rotation = Gesture.Rotation()
      .hitSlop(40)
      .onStart(() => { turnBase.value = r.value; })
      .onUpdate((e) => { r.value = turnBase.value + (e.rotation * 180) / Math.PI; })
      .onEnd(() => commit());
    const tapGesture = Gesture.Tap().maxDuration(260).onEnd(() => { if (onEdit) runOnJS(onEdit)(); });
    return Gesture.Race(Gesture.Simultaneous(pan, pinch, rotation), tapGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, onEdit]);

  const box = useAnimatedStyle(() => ({
    transform: [{ translateX: (x.value / 100) * w - 600 }, { translateY: (y.value / 100) * h - 600 }],
  }));
  const face = useAnimatedStyle(() => ({
    opacity: doomed.value ? 0.6 : 1,
    transform: [{ scale: (doomed.value ? 0.3 : s.value) * (0.3 + 0.7 * pop.value) }, { rotate: `${r.value}deg` }],
  }));
  const max = item.type === "text" ? w * 0.88 : w * 0.78;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.spot, box]}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ maxWidth: max }, face]}>
          <View pointerEvents="none">
            <StickerFace item={item} u={u} />
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// Drawing with pen, highlighter, neon and eraser, with undo. Strokes are kept as SVG paths.
function DrawPad({ w, h, top, bottom, onDone }) {
  const [brush, setBrush] = useState("pen");
  const [pen, setPen] = useState("#ffffff");
  const [size, setSize] = useState(1);
  const [paths, setPaths] = useState([]);
  const [history, setHistory] = useState([]);
  const [live, setLive] = useState(null);
  const current = useRef(null);
  const k = 1000 / w;
  const vh = Math.round(1000 * (h / w));
  const kind = BRUSHES.find((item) => item.id === brush) || BRUSHES[0];

  function toD(points) {
    if (points.length === 1) {
      const [p] = points;
      return `M${p[0].toFixed(1)} ${p[1].toFixed(1)} L${(p[0] + 0.1).toFixed(1)} ${p[1].toFixed(1)}`;
    }
    let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 1; i < points.length; i += 1) {
      const [px, py] = points[i - 1];
      const [cx, cy] = points[i];
      d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + cx) / 2).toFixed(1)} ${((py + cy) / 2).toFixed(1)}`;
    }
    const last = points[points.length - 1];
    return `${d} L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  }

  function erase(px, py) {
    const radius = (kind.width * size * k) / 2;
    setPaths((prev) => {
      const next = prev.filter((path) => !path.pts.some(([x, y]) => Math.hypot(x - px, y - py) < radius + path.width / 2));
      return next.length === prev.length ? prev : next;
    });
  }

  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      const p = [e.nativeEvent.locationX * k, e.nativeEvent.locationY * k];
      setHistory((prev) => [...prev, paths]);
      if (kind.erase) {
        current.current = { erase: true };
        erase(p[0], p[1]);
        return;
      }
      current.current = { pts: [p], color: pen, width: kind.width * size * k, alpha: kind.alpha, glow: Boolean(kind.glow), marker: kind.id === "marker" };
      setLive({ ...current.current, d: toD(current.current.pts) });
    },
    onResponderMove: (e) => {
      const stroke = current.current;
      if (!stroke) return;
      const p = [e.nativeEvent.locationX * k, e.nativeEvent.locationY * k];
      if (stroke.erase) {
        erase(p[0], p[1]);
        return;
      }
      const last = stroke.pts[stroke.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3) return;
      stroke.pts.push(p);
      setLive({ ...stroke, d: toD(stroke.pts) });
    },
    onResponderRelease: () => {
      const stroke = current.current;
      current.current = null;
      setLive(null);
      if (!stroke || stroke.erase) return;
      setPaths((prev) => [...prev, { ...stroke, d: toD(stroke.pts) }]);
    },
  };

  function undo() {
    setHistory((prev) => {
      if (!prev.length) return prev;
      setPaths(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }

  function done() {
    if (!paths.length) {
      onDone(null);
      return;
    }
    onDone({ type: "draw", paths: paths.map(({ pts: _pts, ...rest }) => rest), vw: 1000, vh, x: 50, y: 50, s: 1, r: 0 });
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.12)" }]}>
      <View style={StyleSheet.absoluteFill} {...responder}>
        <Svg width={w} height={h} viewBox={`0 0 1000 ${vh}`} preserveAspectRatio="none" pointerEvents="none">
          {paths.map((path, i) => <StrokePath key={i} path={path} />)}
          {live ? <StrokePath path={live} /> : null}
        </Svg>
      </View>
      <View style={[styles.drawTop, { top: top + 8 }]}>
        <Pressable disabled={!history.length} onPress={() => { tap(); undo(); }} style={[styles.glassBtn, { opacity: history.length ? 1 : 0.35 }]} accessibilityLabel={t("Annulla")}>
          <Undo size={22} color="#fff" />
        </Pressable>
        <View style={styles.brushes}>
          {BRUSHES.map((item) => {
            const Icon = BRUSH_ICONS[item.id];
            const on = brush === item.id;
            return (
              <Pressable key={item.id} accessibilityLabel={t(item.label)} onPress={() => { tap(); setBrush(item.id); }} style={[styles.brush, on ? { backgroundColor: "#fff" } : null]}>
                <Icon size={20} weight={on ? "fill" : "regular"} color={on ? "#111" : "#fff"} />
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={done} style={styles.done}><T size={16} weight="700" color="#fff">{t("Fine")}</T></Pressable>
      </View>
      <SizeSlider value={size} onChange={setSize} top={h * 0.3} />
      <View style={[styles.swatches, { bottom: bottom + 26 }]}>
        {TEXT_SWATCHES.map((color) => (
          <Pressable key={color} accessibilityLabel={color} onPress={() => { tap(); setPen(color); }} style={[styles.swatch, { backgroundColor: color, transform: [{ scale: pen === color ? 1.3 : 1 }] }]} />
        ))}
      </View>
    </View>
  );
}

// Vertical brush size slider (0.5 to 3), on the left edge like the web.
function SizeSlider({ value, onChange, top }) {
  const height = 150;
  const set = (y) => onChange(Math.round((3 - (Math.max(0, Math.min(height, y)) / height) * 2.5) * 10) / 10);
  return (
    <View
      style={{ position: "absolute", left: 14, top, width: 30, height, alignItems: "center" }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => set(e.nativeEvent.locationY)}
      onResponderMove={(e) => set(e.nativeEvent.locationY)}
    >
      <View pointerEvents="none" style={{ width: 4, height: "100%", borderRadius: 2, backgroundColor: "rgba(255,255,255,0.4)" }} />
      <View pointerEvents="none" style={{ position: "absolute", top: ((3 - value) / 2.5) * height - 10, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" }} />
    </View>
  );
}

function TextEditor({ draft, setDraft, onDone, u, top }) {
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const look = textStyle(draft, u);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)", zIndex: 15 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} />
      <View style={[styles.teTop, { top: top + 10 }]}>
        <Pressable
          accessibilityLabel={t("Sfondo testo")}
          onPress={() => { tap(); setDraft((prev) => ({ ...prev, bg: prev.bg === "" ? "solid" : prev.bg === "solid" ? "soft" : "" })); }}
          style={[styles.teBg, draft.bg ? { backgroundColor: "#fff" } : null]}
        >
          <T size={17} weight="800" color={draft.bg ? "#111" : "#fff"}>A</T>
        </Pressable>
        <Pressable onPress={onDone} style={styles.done}><T size={16} weight="700" color="#fff">{t("Fine")}</T></Pressable>
      </View>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, top: top + 60, bottom: keyboard + 110, alignItems: "center", justifyContent: "center" }}>
        <View style={[textBox(draft, u), { alignSelf: "center", maxWidth: "100%" }]}>
          <TextInput
            autoFocus
            multiline
            value={draft.text}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, text }))}
            placeholder={t("Scrivi…")}
            placeholderTextColor="rgba(255,255,255,0.55)"
            selectionColor="#fff"
            accessibilityLabel={t("Testo della storia")}
            style={[look, { minWidth: 40, padding: 0, textAlignVertical: "center" }]}
          />
        </View>
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: keyboard + 58 }}>
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, flexGrow: 1, justifyContent: "center" }}>
          {TEXT_FONTS.map((font) => {
            const on = draft.font === font.id;
            return (
              <Pressable key={font.id} onPress={() => { tap(); setDraft((prev) => ({ ...prev, font: font.id })); }} style={[styles.font, on ? { backgroundColor: "#fff", borderColor: "#fff", transform: [{ scale: 1.05 }] } : null]}>
                <T size={13} color={on ? "#111" : "#fff"} style={fontChip(font.id)}>{t(font.label)}</T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={[styles.swatches, { bottom: keyboard + 16 }]}>
        {TEXT_SWATCHES.map((color) => (
          <Pressable key={color} accessibilityLabel={color} onPress={() => { tap(); setDraft((prev) => ({ ...prev, color })); }} style={[styles.swatch, { width: 26, height: 26, backgroundColor: color, transform: [{ scale: draft.color === color ? 1.3 : 1 }] }]} />
        ))}
      </View>
    </View>
  );
}

function fontChip(id) {
  if (id === "type") return { fontFamily: Platform.select({ ios: "Courier New", default: "monospace" }) };
  if (id === "strong") return { fontWeight: "800", fontStyle: "italic" };
  if (id === "modern") return { textTransform: "uppercase", letterSpacing: 0.8 };
  if (id === "neon") return { textShadowColor: "#fff", textShadowRadius: 8 };
  return null;
}

// The sticker tray: the kit, quick emoji, and each sticker's own panel. Everything a sticker shows
// is typed or picked by the author: people from search, products from their own shop.
function Tray({ tool, setTool, find, setFind, addSticker, bottom }) {
  const { height: H } = useWindowDimensions();
  const me = useMe();
  const q = find.trim();
  const lower = q.toLowerCase();
  const wantsPeople = tool === "tag" || (tool === "tray" && q.length > 0);
  const search = useSearch(wantsPeople || tool === "hash" ? q.replace(/^[@#]/, "") : "");
  const shop = useShop(tool === "product" ? me?.handle : null);
  const people = (search.data?.people || []).filter((person) => person.handle !== me?.handle);
  const tagWord = q.replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
  const kit = STORY_KIT.filter((item) => !lower || t(item.label).toLowerCase().includes(lower));
  const close = () => { setTool(null); setFind(""); };
  const personRow = (person) => (
    <Row
      key={person.handle}
      lead={<Avatar src={person.avatar} size={36} />}
      title={person.name || person.handle}
      sub={`@${person.handle}`}
      onPress={() => addSticker({ type: "tag", handle: person.handle, name: person.name || person.handle })}
    />
  );
  const searching = <View style={{ paddingVertical: 18, alignItems: "center" }}><ActivityIndicator color="#fff" /></View>;

  let body = null;
  let hint = t("Cerca");
  if (tool === "tray") {
    body = (
      <>
        {q ? people.slice(0, 3).map(personRow) : null}
        {q ? <Row icon={MapPin} title={q} sub={t("Luogo")} onPress={() => addSticker({ type: "place", name: q.slice(0, 60) })} /> : null}
        <View style={styles.kit}>
          {kit.map((item) => {
            const Icon = KIT_ICONS[item.id] || Smile;
            return (
              <Pressable key={item.id} onPress={() => { tap(); setTool(item.id); setFind(""); }} style={({ pressed }) => [styles.kitBtn, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
                <Icon size={17} weight="bold" color="#7c3aed" />
                <T size={13} weight="700" color="#111" lines={1}>{t(item.label)}</T>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.emojiQuick}>
          {STORY_EMOJI.slice(0, 16).map((char) => (
            <Pressable key={char} style={styles.emojiCell} onPress={() => addSticker({ type: "emoji", char })}><T size={28} style={{ lineHeight: 36 }}>{char}</T></Pressable>
          ))}
        </View>
      </>
    );
  } else if (tool === "emoji") {
    body = (
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {STORY_EMOJI.filter((char) => !q || char.includes(q)).map((char) => (
          <Pressable key={char} style={{ width: "16.66%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }} onPress={() => addSticker({ type: "emoji", char })}>
            <T size={30} style={{ lineHeight: 38 }}>{char}</T>
          </Pressable>
        ))}
      </View>
    );
  } else if (tool === "tag") {
    hint = t("Cerca persone");
    body = !q ? <TrayNote text={t("Scrivi un nome o un nome utente.")} />
      : search.loading && !search.data ? searching
      : people.length ? people.map(personRow)
      : <TrayNote text={t("Nessuno trovato")} />;
  } else if (tool === "place") {
    hint = t("Nome del luogo");
    body = q ? <Row icon={MapPin} title={q} sub={t("Aggiungi")} onPress={() => addSticker({ type: "place", name: q.slice(0, 60) })} /> : <TrayNote text={t("Scrivi dove sei: una città, un locale, un indirizzo.")} />;
  } else if (tool === "hash") {
    hint = t("Hashtag");
    const tags = (search.data?.tags || []).filter((item) => item.tag !== tagWord);
    body = !tagWord ? <TrayNote text={t("Scrivi una parola, senza spazi.")} /> : (
      <>
        <Row icon={Hash} title={tagWord} onPress={() => addSticker({ type: "hash", tag: tagWord.slice(0, 40) })} />
        {tags.map((item) => <Row key={item.tag} icon={Hash} title={item.tag} sub={t("{n} post", { n: item.count })} onPress={() => addSticker({ type: "hash", tag: item.tag })} />)}
      </>
    );
  } else if (tool === "link") {
    hint = "https://";
    const url = q.replace(/\s+/g, "");
    const valid = /^(https?:\/\/)?[^\s/.]+\.[^\s]{2,}/i.test(url);
    const label = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    body = valid ? <Row icon={LinkIcon} title={label} sub={t("Aggiungi")} onPress={() => addSticker({ type: "link", url: /^https?:\/\//i.test(url) ? url : `https://${url}`, label: label.slice(0, 40) })} /> : <TrayNote text={t("Incolla o scrivi un indirizzo web.")} />;
  } else if (tool === "product") {
    const products = (shop.data?.products || []).filter((product) => !lower || String(product.name || "").toLowerCase().includes(lower));
    body = shop.loading && !shop.data ? searching
      : shop.error && !shop.data ? <TrayNote text={errorText(shop.error, t)} onPress={shop.refresh} />
      : !(shop.data?.products || []).length ? <TrayNote text={t("Non hai ancora prodotti nel tuo shop.")} />
      : products.map((product) => <ProductRow key={product.id} product={product} owner={me?.handle} onPress={addSticker} />);
  } else if (["poll", "quiz", "ask", "slider"].includes(tool)) {
    body = <StickerForm kind={tool} onAdd={addSticker} />;
  }
  const searchable = !["poll", "quiz", "ask", "slider"].includes(tool);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 15 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} onPress={close} />
      <TraySheet height={H * 0.7} bottom={bottom}>
        <View style={styles.grab} />
        {searchable ? (
          <View style={styles.search}>
            <Search size={17} color="rgba(255,255,255,0.6)" />
            <TextInput
              value={find}
              onChangeText={setFind}
              autoFocus={tool !== "tray" && tool !== "emoji" && tool !== "product"}
              autoCapitalize={tool === "place" ? "words" : "none"}
              autoCorrect={tool === "place"}
              keyboardType={tool === "link" ? "url" : "default"}
              placeholder={hint}
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={{ flex: 1, height: 38, color: "#fff", fontSize: 15, padding: 0 }}
              accessibilityLabel={hint}
            />
          </View>
        ) : null}
        {tool !== "tray" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable hitSlop={8} onPress={() => { setTool("tray"); setFind(""); }} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }} accessibilityLabel={t("Indietro")}><ChevronLeft size={20} color="#fff" /></Pressable>
            <T size={16} weight="700" color="#fff">{t(STORY_KIT.find((item) => item.id === tool)?.label || "")}</T>
          </View>
        ) : null}
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingBottom: bottom + 14 }} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      </TraySheet>
    </View>
  );
}

function TrayNote({ text, onPress }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ paddingVertical: 18, paddingHorizontal: 12 }}>
      <T size={14} color="rgba(255,255,255,0.6)" style={{ textAlign: "center" }}>{text}</T>
      {onPress ? <T size={14} weight="700" color="#fff" style={{ textAlign: "center", marginTop: 6 }}>{t("Riprova")}</T> : null}
    </Pressable>
  );
}

// Poll, quiz, question and slider: the author writes the question and the answers.
function StickerForm({ kind, onAdd }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(kind === "quiz" ? ["", "", ""] : [t("Sì"), t("No")]);
  const [answer, setAnswer] = useState(0);
  const [char, setChar] = useState("❤️");
  const filled = options.map((option) => option.trim()).filter(Boolean);
  const ready = question.trim() && (kind === "ask" || kind === "slider" || (kind === "poll" ? filled.length === 2 : filled.length >= 2 && options[answer]?.trim()));
  const placeholder = { poll: t("Fai una domanda…"), quiz: t("Fai una domanda…"), ask: t("Chiedimi qualcosa…"), slider: t("Quanto ti piace…?") }[kind];

  function add() {
    if (!ready) return;
    const text = question.trim().slice(0, 120);
    if (kind === "ask") onAdd({ type: "ask", prompt: text });
    if (kind === "slider") onAdd({ type: "slider", prompt: text, char, value: 50 });
    if (kind === "poll") onAdd({ type: "poll", question: text, a: options[0].trim().slice(0, 30), b: options[1].trim().slice(0, 30) });
    if (kind === "quiz") {
      const kept = options.map((option, index) => ({ option: option.trim().slice(0, 30), index })).filter((item) => item.option);
      onAdd({ type: "quiz", question: text, options: kept.map((item) => item.option), answer: Math.max(0, kept.findIndex((item) => item.index === answer)) });
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <TextInput autoFocus value={question} onChangeText={setQuestion} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.45)" maxLength={120} style={styles.formInput} accessibilityLabel={t("Domanda")} />
      {kind === "poll" || kind === "quiz" ? options.map((option, index) => (
        <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {kind === "quiz" ? (
            <Pressable hitSlop={6} onPress={() => { tap(); setAnswer(index); }} accessibilityLabel={t("Risposta giusta")}>
              {answer === index ? <Checked size={24} weight="fill" color="#34c759" /> : <Ring size={24} color="rgba(255,255,255,0.45)" />}
            </Pressable>
          ) : null}
          <TextInput
            value={option}
            onChangeText={(value) => setOptions((prev) => prev.map((item, i) => (i === index ? value : item)))}
            placeholder={t("Opzione {n}", { n: index + 1 })}
            placeholderTextColor="rgba(255,255,255,0.45)"
            maxLength={30}
            style={[styles.formInput, { flex: 1 }]}
          />
        </View>
      )) : null}
      {kind === "quiz" ? <T size={12.5} color="rgba(255,255,255,0.55)">{t("Tocca il cerchio della risposta giusta.")}</T> : null}
      {kind === "slider" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {["❤️", "😍", "🔥", "😂", "😮", "👏", "💯", "⭐"].map((item) => (
            <Pressable key={item} onPress={() => { tap(); setChar(item); }} style={{ width: "12.5%", height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: char === item ? "rgba(255,255,255,0.18)" : "transparent" }}>
              <T size={26} style={{ lineHeight: 34 }}>{item}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable disabled={!ready} onPress={add} style={[styles.formGo, { opacity: ready ? 1 : 0.4 }]}>
        <T size={15} weight="700" color="#fff">{t("Aggiungi")}</T>
      </Pressable>
    </View>
  );
}

function TraySheet({ height, bottom, children }) {
  const y = useSharedValue(height);
  useEffect(() => {
    y.value = withTiming(0, { duration: 380, easing: EASE });
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.tray, { height }, style]}>{children}</Animated.View>;
}

function Row({ icon: Icon, lead, title, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed ? { backgroundColor: "rgba(255,255,255,0.12)" } : null]}>
      {lead || null}
      {Icon ? <Icon size={18} weight="bold" color="#fff" /> : null}
      <T size={14.5} weight="700" color="#fff" lines={1} style={{ flexShrink: 1 }}>{title}</T>
      {sub ? <T size={12.5} color="rgba(255,255,255,0.55)" lines={1} style={{ marginLeft: "auto", flexShrink: 1 }}>{sub}</T> : null}
    </Pressable>
  );
}

function ProductRow({ product, owner, onPress }) {
  const image = product.images?.[0] || "";
  return (
    <Pressable
      onPress={() => onPress({ type: "product", owner, productId: product.id, name: product.name, price: product.price, image, y: 72 })}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: "rgba(255,255,255,0.12)" } : null]}
    >
      {image ? <Image source={{ uri: image }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" recyclingKey={image} /> : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}><Bag size={20} weight="fill" color="#fff" /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={14.5} weight="700" color="#fff" lines={1}>{product.name}</T>
        <T size={12.5} color="rgba(255,255,255,0.55)" lines={1}>{euro(product.price)}</T>
      </View>
    </Pressable>
  );
}

function DarkSheet({ children, onClose, bottom }) {
  const y = useSharedValue(500);
  useEffect(() => {
    y.value = withTiming(0, { duration: 380, easing: EASE });
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} onPress={onClose} />
      <Animated.View style={[styles.sheet, { paddingBottom: bottom + 22 }, style]}>
        <View style={styles.grab} />
        {children}
      </Animated.View>
    </View>
  );
}

function SheetRow({ icon: Icon, label, warn, onPress }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.sheetRow, pressed ? { backgroundColor: "rgba(255,255,255,0.06)" } : null]}>
      {Icon ? <Icon size={20} color={warn ? "#ff3040" : "#fff"} /> : null}
      <T size={15.5} color={warn ? "#ff3040" : "#fff"}>{label}</T>
    </Pressable>
  );
}

function Toast({ text, bottom }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSequence(withTiming(1, { duration: 160 }), withTiming(1, { duration: 1000 }), withTiming(2, { duration: 220 }));
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value <= 1 ? v.value : 2 - v.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom }, style]}>
      <T size={13.5} weight="600" color="#fff">{text}</T>
    </Animated.View>
  );
}

const glass = { backgroundColor: "rgba(0,0,0,0.3)" };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  glass,
  shadow: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", ...glass },
  top: { position: "absolute", left: 10, right: 10, zIndex: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rail: { position: "absolute", left: 10, zIndex: 10, gap: 14 },
  railRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  railIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  railSub: { width: 34, height: 34, borderRadius: 17, marginLeft: 3, alignItems: "center", justifyContent: "center" },
  railBadge: { position: "absolute", right: -2, bottom: -2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#ffd60a", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  bottom: { position: "absolute", left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 26 },
  roll: { width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "#fff" },
  rollEmpty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  shutter: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  modes: { position: "absolute", left: 0, right: 0, zIndex: 10, flexDirection: "row", justifyContent: "center", gap: 20 },
  tip: { position: "absolute", left: 0, right: 0, textAlign: "center" },
  badge: { position: "absolute", zIndex: 8, alignSelf: "center", paddingVertical: 5, paddingHorizontal: 12, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.45)" },
  permBox: { position: "absolute", left: 40, right: 40, top: "38%", gap: 8, alignItems: "center", padding: 18, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)" },
  permBtn: { marginTop: 6, height: 36, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  spot: { position: "absolute", left: 0, top: 0, width: 1200, height: 1200, alignItems: "center", justifyContent: "center" },
  trash: { position: "absolute", zIndex: 13, alignSelf: "center", width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  share: { position: "absolute", left: 12, right: 12, zIndex: 12, flexDirection: "row", gap: 8 },
  pill: { flex: 1, minWidth: 0, height: 46, borderRadius: 99, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10, backgroundColor: "rgba(28,28,30,0.86)" },
  go: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  done: { height: 34, paddingHorizontal: 14, justifyContent: "center" },
  filters: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 14, paddingTop: 14, alignItems: "center", gap: 10 },
  drawTop: { position: "absolute", left: 10, right: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brushes: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.35)" },
  brush: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  swatches: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#fff" },
  teTop: { position: "absolute", left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teBg: { width: 36, height: 36, borderRadius: 8, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  font: { height: 32, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", justifyContent: "center" },
  tray: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 10, paddingTop: 8, paddingHorizontal: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: "rgba(28,28,30,0.97)" },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.3)" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)" },
  kit: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kitBtn: { width: "31.6%", height: 44, borderRadius: 12, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6 },
  emojiQuick: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  emojiCell: { width: "12.5%", height: 42, alignItems: "center", justifyContent: "center" },
  formInput: { height: 44, borderRadius: 10, paddingHorizontal: 12, color: "#fff", fontSize: 15, backgroundColor: "rgba(255,255,255,0.1)" },
  formGo: { height: 44, borderRadius: 10, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 8, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: "#262626" },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  sending: { zIndex: 30, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(0,0,0,0.35)" },
  toast: { position: "absolute", alignSelf: "center", zIndex: 40, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.92)" },
});

