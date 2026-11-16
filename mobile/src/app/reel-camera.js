// Reel camera: record clips (or add them from the gallery), then edit and publish.
// Port of the web's ReelCamera (src/App.jsx).
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useFrameCallback, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Stack, router, useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../lib/store";
import { AVATAR, WORKS } from "../data";
import { tap } from "../ui/kit";
import { DarkSheet, FilterLayer, REEL_LENGTHS, REEL_RECORD_SPEEDS, ReelPlayer, STORY_FILTERS, STORY_MUSIC, Toast, clockLabel, openReel, useToast } from "../ui/reels-kit";
import { Camera, ChevronLeft, ChevronRight, Music, Plus, Sparkle, SwitchCamera, Timer, Undo, X } from "../ui/reels-icons";
import { keepAll, keepMedia } from "../lib/media-store";

const SPRING_OUT = Easing.bezier(0.32, 0.72, 0, 1);

export default function ReelCamera() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const cam = useRef(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [mountError, setMountError] = useState(false);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState("front");
  const [flipping, setFlipping] = useState(false);
  const [clips, setClips] = useState([]);
  const [recording, setRecording] = useState(0);
  const [now, setNow] = useState(0);
  const [limit, setLimit] = useState(30);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [music, setMusic] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [stage, setStage] = useState("capture");
  const [filter, setFilter] = useState("normal");
  const [filterHint, setFilterHint] = useState(0);
  const [caption, setCaption] = useState("");
  const [cover, setCover] = useState(0);
  const [alsoStory, setAlsoStory] = useState(false);
  const [toast, note] = useToast(1500);
  const countTimer = useRef(0);

  const used = clips.reduce((sum, item) => sum + item.duration / (item.rate || 1), 0);
  const live = recording ? (now - recording) / 1000 / speed : 0;
  const left = Math.max(0, limit - used - live);
  const camOn = Boolean(camPerm?.granted) && !mountError;

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam();
  }, [camPerm, requestCam]);
  useEffect(() => {
    if (camPerm?.granted && micPerm && !micPerm.granted && micPerm.canAskAgain) requestMic();
  }, [camPerm?.granted, micPerm, requestMic]);
  useEffect(() => () => clearInterval(countTimer.current), []);

  // Clock for the remaining time while a clip records.
  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [recording]);
  useEffect(() => {
    if (recording && left <= 0) stopClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, recording]);

  // Smooth red segment while recording (UI thread).
  const liveStart = useSharedValue(0);
  const liveWidth = useSharedValue(0);
  const liveMeta = useSharedValue({ speed: 1, limit: 30 });
  useEffect(() => {
    liveMeta.value = { speed, limit };
  }, [speed, limit, liveMeta]);
  useFrameCallback(() => {
    "worklet";
    if (!liveStart.value) return;
    const seconds = (Date.now() - liveStart.value) / 1000 / liveMeta.value.speed;
    liveWidth.value = Math.min(1, seconds / liveMeta.value.limit);
  });

  async function startClip() {
    if (left <= 0.3) {
      note("Il reel è completo");
      return;
    }
    if (!camOn || !ready || !cam.current) {
      note("Fotocamera non disponibile: aggiungi clip dalla galleria");
      return;
    }
    const rate = speed;
    const startedAt = Date.now();
    setRecording(startedAt);
    setNow(startedAt);
    liveStart.value = startedAt;
    liveWidth.value = 0;
    tap("medium");
    try {
      const result = await cam.current.recordAsync({ maxDuration: Math.max(1, left * rate) });
      const seconds = (Date.now() - startedAt) / 1000;
      if (result?.uri && seconds >= 0.3) {
        const src = await keepMedia(result.uri, "reel");
        setClips((prev) => [...prev, { type: "video", src, duration: seconds, rate }]);
      }
    } catch {
      note("Registrazione non supportata qui");
    } finally {
      liveStart.value = 0;
      setRecording(0);
    }
  }

  function stopClip() {
    try {
      cam.current?.stopRecording();
    } catch {}
    tap();
  }

  function shutter() {
    if (recording) {
      stopClip();
      return;
    }
    if (countdown) return;
    if (timer) {
      let n = timer;
      setCountdown(n);
      clearInterval(countTimer.current);
      countTimer.current = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(countTimer.current);
          setCountdown(0);
          startClip();
        } else setCountdown(n);
      }, 1000);
      return;
    }
    startClip();
  }

  function removeLast() {
    tap();
    setClips((prev) => prev.slice(0, -1));
  }

  function addPhotoClip(src) {
    if (left < 1) {
      note("Il reel è completo");
      return;
    }
    tap();
    setClips((prev) => [...prev, { type: "image", src, duration: Math.min(3, left), rate: 1 }]);
  }

  async function fromLibrary() {
    tap();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.85, orderedSelection: true }).catch(() => null);
    if (!result || result.canceled) return;
    let room = left;
    const added = [];
    for (const asset of result.assets || []) {
      if (room <= 0.5) break;
      if (asset.type === "video") {
        const seconds = Math.min(asset.duration ? asset.duration / 1000 : 5, room);
        room -= seconds;
        added.push({ type: "video", src: asset.uri, duration: seconds, rate: 1 });
      } else {
        room -= 3;
        added.push({ type: "image", src: asset.uri, duration: 3, rate: 1 });
      }
    }
    if (!added.length) return;
    const kept = await keepAll(added.map((item) => item.src));
    setClips((prev) => [...prev, ...added.map((item, i) => ({ ...item, src: kept[i] }))]);
  }

  function publish() {
    tap("medium");
    const coverSrc = clips.find((item, i) => i === cover && item.type === "image")?.src || clips.find((item) => item.type === "image")?.src;
    const poster = coverSrc || WORKS[0].src;
    const total = clips.reduce((sum, item) => sum + item.duration / (item.rate || 1), 0);
    const avatar = store.profile.src || AVATAR;
    const text = caption.trim();
    const item = {
      id: `made-${Date.now()}`,
      kind: "reel",
      clips,
      image: poster,
      src: poster,
      videoOnly: !coverSrc,
      filter,
      caption: text,
      text,
      music,
      audio: music ? music.title : "Audio originale",
      length: clockLabel(total),
      name: store.profile.name,
      handle: store.profile.handle,
      avatar,
      likes: "0",
      comments: "0",
      saves: "0",
      time: "Now",
      at: Date.now(),
      mine: true,
      thread: [],
    };
    store.publish(item);
    if (alsoStory) {
      store.publish({ id: `made-${Date.now()}-s`, kind: "story", image: poster, text: "", stickers: [], time: "Now", at: Date.now(), mine: true, src: avatar, avatar, name: "Tu", filter });
    }
    openReel();
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/reels");
  }

  function cycleFilter(dir) {
    const i = STORY_FILTERS.findIndex((item) => item.id === filter);
    const next = STORY_FILTERS[(i + dir + STORY_FILTERS.length) % STORY_FILTERS.length];
    setFilter(next.id);
    setFilterHint(Date.now());
    tap();
  }

  const swipe = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-20, 20],
    onDeactivate: (event) => {
      "worklet";
      if (Math.abs(event.translationX) >= 50) scheduleOnRN(cycleFilter, event.translationX < 0 ? 1 : -1);
    },
  });

  const filterNow = STORY_FILTERS.find((item) => item.id === filter) || STORY_FILTERS[0];
  const thumb = clips.find((item) => item.type === "image")?.src || WORKS[0].src;

  const musicTray = (
    <DarkSheet tray open={sheet === "music"} title="Musica" onClose={() => setSheet(null)} bottomPad={insets.bottom + 14}>
      <ScrollView contentContainerStyle={styles.trayBody} showsVerticalScrollIndicator={false}>
        {music ? (
          <TrayRow onPress={() => { setMusic(null); setSheet(null); }}>
            <X size={18} color="#fff" />
            <Text style={styles.trayStrong}>Togli la musica</Text>
          </TrayRow>
        ) : null}
        {STORY_MUSIC.map((song) => (
          <TrayRow key={song.title} onPress={() => { setMusic(song); setSheet(null); }}>
            <Music size={18} color="#fff" />
            <Text style={styles.trayStrong}>{song.title}</Text>
            <Text style={styles.trayMuted}>{song.artist}</Text>
          </TrayRow>
        ))}
      </ScrollView>
    </DarkSheet>
  );

  if (stage === "edit") {
    return (
      <View style={styles.root}>
        <GestureDetector gesture={swipe}>
          <Animated.View entering={FadeIn.duration(420)} style={StyleSheet.absoluteFill}>
            <ReelPlayer clips={clips} active={focused} paused={sheet === "caption"} muted={false} filter={filter} poster={clips[0]?.src} />
          </Animated.View>
        </GestureDetector>
        {filterHint ? <FilterName key={filterHint} label={filterNow.label} /> : null}
        <Scrim />
        <View style={[styles.top, { top: insets.top + 8 }]}>
          <GlassBtn icon={ChevronLeft} label="Indietro" onPress={() => { setStage("capture"); setSheet(null); }} />
          <View style={styles.tools}>
            <GlassBtn icon={Music} label="Musica" onPress={() => setSheet("music")} />
            <GlassBtn icon={Sparkle} label="Filtri" on={sheet === "filters"} onPress={() => setSheet(sheet === "filters" ? null : "filters")} />
          </View>
        </View>
        {music ? (
          <View pointerEvents="none" style={[styles.musicChip, { top: insets.top + 60 }]}>
            <Music size={14} color="#fff" />
            <Text numberOfLines={1} style={styles.chipText}>{music.title} · {music.artist}</Text>
          </View>
        ) : null}

        {sheet === "filters" ? (
          <Animated.View entering={FadeIn.duration(220)} style={[styles.filters, { paddingBottom: 22 + insets.bottom }]}>
            <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {STORY_FILTERS.map((item) => {
                const on = filter === item.id;
                return (
                  <Pressable key={item.id} onPress={() => { tap(); setFilter(item.id); setFilterHint(Date.now()); }} style={styles.filterBtn}>
                    <View style={[styles.filterThumb, on ? styles.filterThumbOn : null]}>
                      <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <FilterLayer id={item.id} />
                    </View>
                    <Text style={styles.filterLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable hitSlop={8} onPress={() => setSheet(null)} style={styles.done}>
              <Text style={styles.doneText}>Fine</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.finishWrap} pointerEvents="box-none">
            <View style={[styles.finish, { paddingBottom: 20 + insets.bottom }]}>
              <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.85)"]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
              <TextInput
                multiline
                maxLength={2200}
                value={caption}
                onChangeText={setCaption}
                placeholder="Scrivi una didascalia… #hashtag @menzione"
                placeholderTextColor="rgba(255,255,255,0.55)"
                accessibilityLabel="Didascalia"
                keyboardAppearance="dark"
                onFocus={() => setSheet("caption")}
                onBlur={() => setSheet(null)}
                style={[styles.caption, sheet === "caption" ? styles.captionOn : null]}
              />
              {clips.some((item) => item.type === "image") ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.covers} keyboardShouldPersistTaps="handled">
                  <Text style={styles.coversLabel}>Copertina</Text>
                  {clips.map((item, i) => (item.type === "image" ? (
                    <Pressable key={i} onPress={() => { tap(); setCover(i); }} style={[styles.cover, cover === i ? styles.coverOn : null]}>
                      <Image source={{ uri: item.src }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    </Pressable>
                  ) : null))}
                </ScrollView>
              ) : null}
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: alsoStory }} onPress={() => { tap(); setAlsoStory((value) => !value); }} style={styles.toggleRow}>
                <Text style={styles.toggleText}>Condividi anche nella storia</Text>
                <Switch on={alsoStory} />
              </Pressable>
              <Pressable onPress={publish} style={({ pressed }) => [styles.share, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <Text style={styles.shareText}>Condividi reel</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
        {musicTray}
        <Toast text={toast} bottom={84} />
      </View>
    );
  }

  const lastImage = clips.length && !recording && clips[clips.length - 1].type === "image" ? clips[clips.length - 1].src : null;
  let offset = 0;
  const chromeHidden = Boolean(recording);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ statusBarHidden: Boolean(recording) }} />
      {camOn ? (
        focused ? (
          <CameraView
            ref={cam}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            mirror={facing === "front"}
            mute={!micPerm?.granted}
            videoQuality="1080p"
            onCameraReady={() => { setReady(true); setFlipping(false); }}
            onMountError={() => setMountError(true)}
          />
        ) : null
      ) : (
        <LinearGradient colors={["#2a1f3d", "#000"]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 0.9 }} style={styles.nocam}>
          <Pressable onPress={() => { if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam(); }} style={styles.nocamIcon}>
            <Camera size={28} color="#fff" />
          </Pressable>
          <Text style={styles.nocamTitle}>Fotocamera non disponibile</Text>
          <Text style={styles.nocamText}>Aggiungi foto o video per creare il reel</Text>
          <View style={styles.demo}>
            {WORKS.map((work) => (
              <Pressable key={work.src} accessibilityLabel={work.caption} onPress={() => addPhotoClip(work.src)} style={({ pressed }) => [styles.demoTile, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
                <Image source={{ uri: work.src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                <View style={styles.demoPlus}><Plus size={13} weight="bold" color="#fff" /></View>
              </Pressable>
            ))}
          </View>
        </LinearGradient>
      )}
      {lastImage ? <Image pointerEvents="none" source={{ uri: lastImage }} style={[StyleSheet.absoluteFill, { opacity: 0.18 }]} contentFit="cover" /> : null}
      <Scrim />
      {countdown ? <Count key={countdown} value={countdown} /> : null}

      <View style={[styles.segments, { top: insets.top + 4 }]} accessibilityLabel={`${Math.round(used)} di ${limit} secondi`}>
        {clips.map((item, i) => {
          const width = ((item.duration / (item.rate || 1)) / limit) * 100;
          const style = { left: `${offset}%`, width: `${width}%` };
          offset += width;
          return <Animated.View key={i} entering={FadeIn.duration(220)} style={[styles.segment, style]} />;
        })}
        {recording ? <LiveSegment left={offset} width={liveWidth} /> : null}
      </View>

      <View pointerEvents={chromeHidden ? "none" : "box-none"} style={[styles.top, { top: insets.top + 16, opacity: chromeHidden ? 0 : 1 }]}>
        <GlassBtn icon={X} label="Chiudi" onPress={close} />
        <Pressable onPress={() => { tap(); setSheet("music"); }} style={styles.musicPill}>
          <Music size={15} color="#fff" />
          <Text numberOfLines={1} style={styles.musicText}>{music ? music.title : "Aggiungi musica"}</Text>
        </Pressable>
        <Text style={styles.left}>{clockLabel(left)}</Text>
      </View>

      <View pointerEvents={chromeHidden ? "none" : "box-none"} style={[styles.rail, { top: insets.top + 72, opacity: chromeHidden ? 0 : 1 }]}>
        <RailBtn label="Durata" onPress={() => setLimit((value) => REEL_LENGTHS[(REEL_LENGTHS.indexOf(value) + 1) % REEL_LENGTHS.length])}>
          <Text style={styles.len}>{limit}</Text>
        </RailBtn>
        <RailBtn label="Velocità" on={speed !== 1} onPress={() => setSpeedOpen((value) => !value)}>
          <Text style={[styles.len, { color: speed !== 1 ? "#111" : "#fff" }]}>{speed}×</Text>
        </RailBtn>
        {speedOpen ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.speeds}>
            {REEL_RECORD_SPEEDS.map((value) => (
              <Pressable key={value} onPress={() => { tap(); setSpeed(value); setSpeedOpen(false); }} style={[styles.speed, speed === value ? styles.speedOn : null]}>
                <Text style={[styles.speedText, { color: speed === value ? "#111" : "#fff" }]}>{value}×</Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
        <RailBtn label="Timer" on={Boolean(timer)} badge={timer || null} onPress={() => setTimer((value) => (value === 0 ? 3 : value === 3 ? 10 : 0))}>
          <Timer size={21} color={timer ? "#111" : "#fff"} />
        </RailBtn>
      </View>

      <Text pointerEvents="none" style={[styles.tip, { bottom: 140 + insets.bottom }]}>
        {recording ? "Tocca per fermare" : clips.length ? `${clips.length} clip · tocca per aggiungerne` : "Tocca per registrare una clip"}
      </Text>

      <View style={[styles.bottom, { bottom: 40 + insets.bottom }]}>
        <View style={styles.side}>
          <Pressable accessibilityLabel="Galleria" pointerEvents={chromeHidden ? "none" : "auto"} onPress={fromLibrary} style={({ pressed }) => [styles.roll, { opacity: chromeHidden ? 0 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
            <Image source={{ uri: WORKS[clips.length % WORKS.length].src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          </Pressable>
        </View>
        <Shutter recording={Boolean(recording)} onPress={shutter} />
        <View style={[styles.side, styles.right, { opacity: chromeHidden ? 0 : 1 }]} pointerEvents={chromeHidden ? "none" : "box-none"}>
          {clips.length && !recording ? (
            <>
              <GlassBtn icon={Undo} label="Elimina ultima clip" onPress={removeLast} />
              <Animated.View entering={FadeIn.duration(260)}>
                <Pressable accessibilityLabel="Avanti" onPress={() => { tap(); setStage("edit"); setSheet(null); setSpeedOpen(false); }} style={({ pressed }) => [styles.next, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
                  <ChevronRight size={22} weight="bold" color="#111" />
                </Pressable>
              </Animated.View>
            </>
          ) : (
            <FlipBtn
              spinning={flipping}
              onPress={() => {
                if (!camOn || recording) return;
                setFlipping(true);
                setReady(false);
                setFacing((value) => (value === "back" ? "front" : "back"));
              }}
            />
          )}
        </View>
      </View>

      {musicTray}
      <Toast text={toast} bottom={84} />
    </View>
  );
}

function Scrim() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={["rgba(0,0,0,0.38)", "transparent"]} locations={[0, 0.16]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.5)"]} locations={[0.72, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function GlassBtn({ icon: Icon, label, on, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.glass, on ? styles.glassOn : null, { transform: [{ scale: pressed ? 0.86 : 1 }] }]}>
      <Icon size={22} color={on ? "#111" : "#fff"} />
    </Pressable>
  );
}

function RailBtn({ label, on, badge, onPress, children }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }} style={styles.railBtn}>
      {({ pressed }) => (
        <>
          <View style={[styles.railIcon, on ? styles.railIconOn : null, { transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
            {children}
            {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
          </View>
          {on ? <Animated.Text entering={FadeIn.duration(200)} style={styles.railLabel}>{label}</Animated.Text> : null}
        </>
      )}
    </Pressable>
  );
}

function FlipBtn({ spinning, onPress }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (spinning) turn.value = withTiming(turn.value + 180, { duration: 420, easing: SPRING_OUT });
  }, [spinning, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Gira fotocamera" hitSlop={4} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.glass, { transform: [{ scale: pressed ? 0.86 : 1 }] }]}>
      <Animated.View style={style}><SwitchCamera size={22} color="#fff" /></Animated.View>
    </Pressable>
  );
}

function Shutter({ recording, onPress }) {
  const rec = useSharedValue(0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    rec.value = withTiming(recording ? 1 : 0, { duration: 240, easing: Easing.bezier(0.2, 0.9, 0.25, 1.25) });
  }, [recording, rec]);
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.15 * rec.value }],
    borderColor: `rgba(255,255,255,${1 - 0.5 * rec.value})`,
  }));
  const dot = useAnimatedStyle(() => ({
    borderRadius: 32 - 20 * rec.value,
    transform: [{ scale: (1 - 0.5 * rec.value) * (1 - 0.1 * pressed.value) }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? "Ferma" : "Registra"}
      onPress={onPress}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 120 }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: 160 }); }}
    >
      <Animated.View style={[styles.shutter, ring]}>
        <Animated.View style={[styles.shutterDot, dot]} />
      </Animated.View>
    </Pressable>
  );
}

function LiveSegment({ left, width }) {
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return <Animated.View style={[styles.segment, styles.segmentLive, { left: `${left}%` }, style]} />;
}

function Count({ value }) {
  const alpha = useSharedValue(0);
  const scale = useSharedValue(1.6);
  useEffect(() => {
    alpha.value = withSequence(withTiming(1, { duration: 200 }), withTiming(1, { duration: 650 }), withTiming(0, { duration: 150 }));
    scale.value = withSequence(withTiming(1, { duration: 200 }), withTiming(1, { duration: 650 }), withTiming(0.8, { duration: 150 }));
  }, [alpha, scale]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value, transform: [{ scale: scale.value }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.countWrap]}>
      <Animated.Text style={[styles.count, style]}>{value}</Animated.Text>
    </View>
  );
}

function FilterName({ label }) {
  return (
    <Animated.View pointerEvents="none" entering={FadeIn.duration(160)} exiting={FadeOut.duration(300)} style={styles.filterName}>
      <FilterNameFade label={label} />
    </Animated.View>
  );
}

function FilterNameFade({ label }) {
  const alpha = useSharedValue(1);
  useEffect(() => {
    alpha.value = withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 400 }));
  }, [alpha]);
  const style = useAnimatedStyle(() => ({ opacity: alpha.value }));
  return <Animated.Text style={[styles.filterNameText, style]}>{label}</Animated.Text>;
}

function TrayRow({ onPress, children }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.trayRow, { backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)" }]}>
      {children}
    </Pressable>
  );
}

function Switch({ on }) {
  const x = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    x.value = withTiming(on ? 1 : 0, { duration: 220, easing: SPRING_OUT });
  }, [on, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 18 * x.value }] }));
  return (
    <View style={[styles.switch, { backgroundColor: on ? "#0095f6" : "rgba(255,255,255,0.25)" }]}>
      <Animated.View style={[styles.knob, knob]} />
    </View>
  );
}

const TEXT_SHADOW = { textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  nocam: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  nocamIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  nocamTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  nocamText: { color: "rgba(255,255,255,0.65)", fontSize: 13.5, textAlign: "center" },
  demo: { flexDirection: "row", gap: 8, marginTop: 14 },
  demoTile: { width: 64, height: 96, borderRadius: 10, overflow: "hidden", backgroundColor: "#222" },
  demoPlus: { position: "absolute", right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  segments: { position: "absolute", zIndex: 12, left: 10, right: 10, height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" },
  segment: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#fff", borderRightWidth: 2, borderRightColor: "rgba(0,0,0,0.6)" },
  segmentLive: { backgroundColor: "#ff3040", borderRightWidth: 0 },
  top: { position: "absolute", zIndex: 12, left: 10, right: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tools: { flexDirection: "row", gap: 6 },
  glass: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  glassOn: { backgroundColor: "#fff" },
  musicPill: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, maxWidth: 200, paddingHorizontal: 14, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.35)" },
  musicText: { color: "#fff", fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  left: { minWidth: 40, textAlign: "right", color: "#fff", fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"], ...TEXT_SHADOW },
  rail: { position: "absolute", zIndex: 10, left: 10, gap: 14, alignItems: "flex-start" },
  railBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  railIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  railIconOn: { backgroundColor: "#fff" },
  railLabel: { color: "#fff", fontSize: 13.5, fontWeight: "600", ...TEXT_SHADOW },
  len: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  badge: { position: "absolute", right: -2, bottom: -2, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 99, backgroundColor: "#ffd60a", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#111", fontSize: 10.5, fontWeight: "700" },
  speeds: { flexDirection: "row", gap: 6, marginLeft: 50, marginTop: -6, padding: 4, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.45)" },
  speed: { width: 38, height: 30, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  speedOn: { backgroundColor: "#fff" },
  speedText: { fontSize: 12.5, fontWeight: "700" },
  tip: { position: "absolute", zIndex: 9, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 12.5, ...TEXT_SHADOW },
  bottom: { position: "absolute", zIndex: 10, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 26 },
  side: { flex: 1, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end", gap: 10 },
  roll: { width: 40, height: 40, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: "#fff", backgroundColor: "#222" },
  next: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterDot: { width: 64, height: 64, backgroundColor: "#ff3040" },
  countWrap: { zIndex: 20, alignItems: "center", justifyContent: "center" },
  count: { color: "#fff", fontSize: 140, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 30 },
  musicChip: { position: "absolute", zIndex: 11, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.45)" },
  chipText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  filterName: { position: "absolute", zIndex: 6, top: "44%", left: 0, right: 0, alignItems: "center" },
  filterNameText: { color: "#fff", fontSize: 30, fontWeight: "700", letterSpacing: -0.6, textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  filters: { position: "absolute", zIndex: 14, left: 0, right: 0, bottom: 0, paddingTop: 14, alignItems: "center", gap: 10 },
  filterRow: { gap: 10, paddingHorizontal: 14 },
  filterBtn: { alignItems: "center", gap: 6 },
  filterThumb: { width: 58, height: 58, borderRadius: 29, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: "#222" },
  filterThumbOn: { borderColor: "#fff", transform: [{ scale: 1.12 }] },
  filterLabel: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
  done: { height: 34, paddingHorizontal: 14, justifyContent: "center" },
  doneText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  finishWrap: { ...StyleSheet.absoluteFill, zIndex: 12, justifyContent: "flex-end" },
  finish: { gap: 10, paddingTop: 16, paddingHorizontal: 14 },
  caption: { minHeight: 52, maxHeight: 120, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 12, backgroundColor: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 14.5, lineHeight: 19.5, textAlignVertical: "top" },
  captionOn: { borderColor: "#fff" },
  covers: { alignItems: "center", gap: 6 },
  coversLabel: { color: "#fff", fontSize: 13, fontWeight: "600", marginRight: 4 },
  cover: { width: 40, height: 60, borderRadius: 6, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  coverOn: { borderColor: "#fff", transform: [{ scale: 1.06 }] },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  switch: { width: 44, height: 26, borderRadius: 99, padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  share: { height: 48, borderRadius: 12, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  shareText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
  trayBody: { gap: 6, paddingBottom: 8 },
  trayRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12 },
  trayStrong: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  trayMuted: { marginLeft: "auto", color: "rgba(255,255,255,0.55)", fontSize: 12.5 },
});
