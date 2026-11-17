// Reel camera: record one video (or pick one from the gallery), add a caption and publish it.
// Port of the web's ReelCamera (src/App.jsx).
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useFrameCallback, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Stack, router, useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../lib/i18n";
import { createPost, createStory } from "../lib/social";
import { errorText, mimeOf } from "../lib/api";
import { tap } from "../ui/kit";
import { REEL_LENGTHS, ReelPlayer, Toast, clockLabel, openReel, useToast } from "../ui/reels-kit";
import { Camera, ChevronLeft, ChevronRight, Plus, SquarePlay, SwitchCamera, Timer, Undo, X } from "../ui/reels-icons";
import { openTab } from "../lib/tabs";

const SPRING_OUT = Easing.bezier(0.32, 0.72, 0, 1);

export default function ReelCamera() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const cam = useRef(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [mountError, setMountError] = useState(false);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState("front");
  const [flipping, setFlipping] = useState(false);
  const [clip, setClip] = useState(null); // { uri, duration, w, h, mime, mirror }
  const [recording, setRecording] = useState(0);
  const [now, setNow] = useState(0);
  const [limit, setLimit] = useState(30);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [stage, setStage] = useState("capture");
  const [typing, setTyping] = useState(false);
  const [caption, setCaption] = useState("");
  const [alsoStory, setAlsoStory] = useState(false);
  const [sending, setSending] = useState(null); // null | "upload" | "publish"
  const [toast, note] = useToast(1500);
  const countTimer = useRef(0);

  const live = recording ? (now - recording) / 1000 : 0;
  const left = Math.max(0, limit - live);
  const camOn = Boolean(camPerm?.granted) && !mountError;

  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam();
  }, [camPerm, requestCam]);
  useEffect(() => {
    if (camPerm?.granted && micPerm && !micPerm.granted && micPerm.canAskAgain) requestMic();
  }, [camPerm?.granted, micPerm, requestMic]);
  useEffect(() => () => clearInterval(countTimer.current), []);

  // Clock for the remaining time while the clip records.
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
  const liveLimit = useSharedValue(30);
  useEffect(() => {
    liveLimit.value = limit;
  }, [limit, liveLimit]);
  useFrameCallback(() => {
    "worklet";
    if (!liveStart.value) return;
    liveWidth.value = Math.min(1, (Date.now() - liveStart.value) / 1000 / liveLimit.value);
  });

  async function startClip() {
    if (!camOn || !ready || !cam.current) {
      note(t("Fotocamera non disponibile: scegli un video dalla galleria"));
      return;
    }
    const startedAt = Date.now();
    setRecording(startedAt);
    setNow(startedAt);
    liveStart.value = startedAt;
    liveWidth.value = 0;
    tap("medium");
    try {
      const result = await cam.current.recordAsync({ maxDuration: limit });
      const seconds = (Date.now() - startedAt) / 1000;
      if (result?.uri && seconds >= 0.5) {
        // Recorded in portrait at 720p.
        setClip({ uri: result.uri, duration: Math.min(seconds, limit), w: 720, h: 1280, mime: mimeOf(result.uri, "video/mp4") });
      } else if (result?.uri) note(t("Tieni premuto un po' di più"));
    } catch {
      note(t("Registrazione non supportata qui"));
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
    if (clip) {
      note(t("Elimina la clip per registrarne un'altra"));
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

  function removeClip() {
    tap();
    setClip(null);
  }

  async function fromLibrary() {
    tap();
    const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,  mediaTypes: ["videos"], allowsMultipleSelection: false, videoMaxDuration: REEL_LENGTHS[REEL_LENGTHS.length - 1], quality: 1 }).catch(() => null);
    const asset = result && !result.canceled ? result.assets?.[0] : null;
    if (!asset) return;
    const seconds = asset.duration ? asset.duration / 1000 : 0;
    if (seconds > REEL_LENGTHS[REEL_LENGTHS.length - 1] + 0.5) {
      note(t("Il video può durare al massimo {n} secondi", { n: REEL_LENGTHS[REEL_LENGTHS.length - 1] }));
      return;
    }
    setClip({ uri: asset.uri, duration: seconds || limit, w: asset.width || undefined, h: asset.height || undefined, mime: asset.mimeType || mimeOf(asset.uri, "video/mp4") });
    setStage("edit");
  }

  async function publish() {
    if (!clip || sending) return;
    tap("medium");
    setTyping(false);
    setSending("upload");
    try {
      const post = await createPost({
        kind: "reel",
        text: caption.trim(),
        media: [{ uri: clip.uri, type: "video", w: clip.w, h: clip.h, mime: clip.mime }],
        onProgress: (value) => { if (value >= 1) setSending("publish"); },
      });
      if (alsoStory && post?.media?.[0]?.url) {
        await createStory({ uri: post.media[0].url, type: "video" }).catch(() => note(t("Storia non pubblicata")));
      }
      openReel(post?.id);
    } catch (error) {
      setSending(null);
      Alert.alert(t("Reel non pubblicato"), errorText(error, t));
    }
  }

  function close() {
    if (sending) return;
    if (router.canGoBack()) router.back();
    else openTab("reels");
  }

  if (stage === "edit" && clip) {
    const clips = [{ type: "video", src: clip.uri, duration: clip.duration, mirror: false }];
    return (
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(420)} style={StyleSheet.absoluteFill}>
          <ReelPlayer clips={clips} active={focused} paused={typing || Boolean(sending)} muted={false} />
        </Animated.View>
        <Scrim />
        <View style={[styles.top, { top: insets.top + 8 }]}>
          <GlassBtn icon={ChevronLeft} label={t("Indietro")} onPress={() => { if (!sending) setStage("capture"); }} />
          <Text style={styles.left}>{clockLabel(clip.duration)}</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.finishWrap} pointerEvents="box-none">
          <View style={[styles.finish, { paddingBottom: 20 + insets.bottom }]}>
            <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.85)"]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
            <TextInput
              multiline
              maxLength={2200}
              value={caption}
              onChangeText={setCaption}
              editable={!sending}
              placeholder={t("Scrivi una didascalia… #hashtag @menzione")}
              placeholderTextColor="rgba(255,255,255,0.55)"
              accessibilityLabel={t("Didascalia")}
              keyboardAppearance="dark"
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              style={[styles.caption, typing ? styles.captionOn : null]}
            />
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: alsoStory }} disabled={Boolean(sending)} onPress={() => { tap(); setAlsoStory((value) => !value); }} style={styles.toggleRow}>
              <Text style={styles.toggleText}>{t("Condividi anche nella storia")}</Text>
              <Switch on={alsoStory} />
            </Pressable>
            <Pressable onPress={publish} disabled={Boolean(sending)} style={({ pressed }) => [styles.share, { opacity: sending ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              {sending ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.shareText}>{sending === "upload" ? t("Caricamento del video…") : t("Pubblicazione…")}</Text>
                </View>
              ) : <Text style={styles.shareText}>{t("Condividi reel")}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
        <Toast text={toast} bottom={84} />
      </View>
    );
  }

  const chromeHidden = Boolean(recording);
  const filled = clip ? Math.min(100, (clip.duration / limit) * 100) : 0;

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
            videoQuality="720p"
            onCameraReady={() => { setReady(true); setFlipping(false); }}
            onMountError={() => setMountError(true)}
          />
        ) : null
      ) : (
        <LinearGradient colors={["#2a1f3d", "#000"]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 0.9 }} style={styles.nocam}>
          <Pressable onPress={() => { if (camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam(); }} style={styles.nocamIcon}>
            <Camera size={28} color="#fff" />
          </Pressable>
          <Text style={styles.nocamTitle}>{t("Fotocamera non disponibile")}</Text>
          <Text style={styles.nocamText}>{t("Scegli un video dalla galleria per creare il reel")}</Text>
          <Pressable onPress={fromLibrary} style={({ pressed }) => [styles.pick, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.pickText}>{t("Scegli un video")}</Text>
          </Pressable>
        </LinearGradient>
      )}
      <Scrim />
      {countdown ? <Count key={countdown} value={countdown} /> : null}

      <View style={[styles.segments, { top: insets.top + 4 }]} accessibilityLabel={t("{used} di {limit} secondi", { used: Math.round(clip ? clip.duration : live), limit })}>
        {clip ? <Animated.View entering={FadeIn.duration(220)} style={[styles.segment, { left: 0, width: `${filled}%` }]} /> : null}
        {recording ? <LiveSegment left={0} width={liveWidth} /> : null}
      </View>

      <View pointerEvents={chromeHidden ? "none" : "box-none"} style={[styles.top, { top: insets.top + 16, opacity: chromeHidden ? 0 : 1 }]}>
        <GlassBtn icon={X} label={t("Chiudi")} onPress={close} />
        <Text style={styles.left}>{clockLabel(clip ? clip.duration : left)}</Text>
      </View>

      <View pointerEvents={chromeHidden || clip ? "none" : "box-none"} style={[styles.rail, { top: insets.top + 72, opacity: chromeHidden || clip ? 0 : 1 }]}>
        <RailBtn label={t("Durata")} onPress={() => setLimit((value) => REEL_LENGTHS[(REEL_LENGTHS.indexOf(value) + 1) % REEL_LENGTHS.length])}>
          <Text style={styles.len}>{limit}</Text>
        </RailBtn>
        <RailBtn label={t("Timer")} on={Boolean(timer)} badge={timer || null} onPress={() => setTimer((value) => (value === 0 ? 3 : value === 3 ? 10 : 0))}>
          <Timer size={21} color={timer ? "#111" : "#fff"} />
        </RailBtn>
      </View>

      <Text pointerEvents="none" style={[styles.tip, { bottom: 140 + insets.bottom }]}>
        {recording ? t("Tocca per fermare") : clip ? t("Clip pronta · tocca la freccia per continuare") : t("Tocca per registrare")}
      </Text>

      <View style={[styles.bottom, { bottom: 40 + insets.bottom }]}>
        <View style={styles.side}>
          <Pressable accessibilityLabel={t("Galleria")} pointerEvents={chromeHidden ? "none" : "auto"} onPress={fromLibrary} style={({ pressed }) => [styles.roll, { opacity: chromeHidden ? 0 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
            <SquarePlay size={20} color="#fff" />
            <View style={styles.rollPlus}><Plus size={9} weight="bold" color="#fff" /></View>
          </Pressable>
        </View>
        <Shutter recording={Boolean(recording)} onPress={shutter} />
        <View style={[styles.side, styles.right, { opacity: chromeHidden ? 0 : 1 }]} pointerEvents={chromeHidden ? "none" : "box-none"}>
          {clip && !recording ? (
            <>
              <GlassBtn icon={Undo} label={t("Elimina la clip")} onPress={removeClip} />
              <Animated.View entering={FadeIn.duration(260)}>
                <Pressable accessibilityLabel={t("Avanti")} onPress={() => { tap(); setStage("edit"); }} style={({ pressed }) => [styles.next, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
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
    <Pressable accessibilityRole="button" accessibilityLabel={t("Gira fotocamera")} hitSlop={4} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.glass, { transform: [{ scale: pressed ? 0.86 : 1 }] }]}>
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
      accessibilityLabel={recording ? t("Ferma") : t("Registra")}
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
  pick: { marginTop: 14, height: 38, paddingHorizontal: 18, borderRadius: 10, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  pickText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  rollPlus: { position: "absolute", right: -5, bottom: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  segments: { position: "absolute", zIndex: 12, left: 10, right: 10, height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" },
  segment: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#fff", borderRightWidth: 2, borderRightColor: "rgba(0,0,0,0.6)" },
  segmentLive: { backgroundColor: "#ff3040", borderRightWidth: 0 },
  top: { position: "absolute", zIndex: 12, left: 10, right: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  glass: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  glassOn: { backgroundColor: "#fff" },
  left: { minWidth: 40, textAlign: "right", color: "#fff", fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"], ...TEXT_SHADOW },
  rail: { position: "absolute", zIndex: 10, left: 10, gap: 14, alignItems: "flex-start" },
  railBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  railIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  railIconOn: { backgroundColor: "#fff" },
  railLabel: { color: "#fff", fontSize: 13.5, fontWeight: "600", ...TEXT_SHADOW },
  len: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  badge: { position: "absolute", right: -2, bottom: -2, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 99, backgroundColor: "#ffd60a", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#111", fontSize: 10.5, fontWeight: "700" },
  tip: { position: "absolute", zIndex: 9, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 12.5, ...TEXT_SHADOW },
  bottom: { position: "absolute", zIndex: 10, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 26 },
  side: { flex: 1, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end", gap: 10 },
  roll: { width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  next: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterDot: { width: 64, height: 64, backgroundColor: "#ff3040" },
  countWrap: { zIndex: 20, alignItems: "center", justifyContent: "center" },
  count: { color: "#fff", fontSize: 140, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 6 }, textShadowRadius: 30 },
  finishWrap: { ...StyleSheet.absoluteFill, zIndex: 12, justifyContent: "flex-end" },
  finish: { gap: 10, paddingTop: 16, paddingHorizontal: 14 },
  caption: { minHeight: 52, maxHeight: 120, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 12, backgroundColor: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 14.5, lineHeight: 19.5, textAlignVertical: "top" },
  captionOn: { borderColor: "#fff" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  switch: { width: 44, height: 26, borderRadius: 99, padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  share: { height: 48, borderRadius: 12, backgroundColor: "#0095f6", alignItems: "center", justifyContent: "center" },
  shareText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
});
