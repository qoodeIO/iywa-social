// Calls (incoming, outgoing, 1:1 and group mesh) and the live message toast, drawn
// over every screen like the web's CallLayer and LiveToast.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeOut, SlideInUp, SlideOutUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { RTCView } from "react-native-webrtc";
import { LiveProvider, useLive } from "../live/LiveStore";
import { routeAudio } from "../live/calls";
import { CALL_NOTICES, callStamp, groupToneOf, liveThread, toneOf } from "../live/format";
import { useStore } from "../lib/store";
import { Face, GroupAvatar, useChatTheme } from "./chat";
import { Mic, MicOff, Minimize, Phone, PhoneOff, SwitchCamera, Video, VideoOff, Volume } from "./chatIcons";
import { T, tap } from "./kit";
import { t } from "../lib/i18n";

// Mount once in the root layout, inside StoreProvider.
export function LiveRoot({ children }) {
  return (
    <LiveProvider>
      {children}
      <LiveToast />
      <CallLayer />
    </LiveProvider>
  );
}

function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

function hasVideo(stream) {
  return Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === "live" && !track.muted && track.enabled !== false));
}

function Ring({ delay, size }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }), -1));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - v.value), transform: [{ scale: 0.7 + v.value * 0.75 }] }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)" }, style]} />;
}

function Rings({ size = 180 }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ring delay={0} size={size} />
      <Ring delay={550} size={size} />
      <Ring delay={1100} size={size} />
    </View>
  );
}

function Bounce({ children }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-6, { duration: 700, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) })), -1);
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Backdrop({ src, name, photo, group }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {src && !String(src).startsWith("data:image/svg") ? <Image source={{ uri: src }} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]} contentFit="cover" blurRadius={40} /> : (
        <LinearGradient colors={group ? groupToneOf(photo, name) : toneOf(name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]} />
    </View>
  );
}

function Notice({ code }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} pointerEvents="none" style={[styles.notice, { top: insets.top + 48 }]}>
      <T size={13} weight="600" color="#fff" style={{ textAlign: "center" }}>{t(CALL_NOTICES[code] || CALL_NOTICES.failed)}</T>
    </Animated.View>
  );
}

function ControlButton({ icon: Icon, label, on, end, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.control, pressed && { transform: [{ scale: 0.92 }] }]}>
      <View style={[styles.controlIcon, on && { backgroundColor: "#fff" }, end && { backgroundColor: "#ff3b30" }]}>
        <Icon size={22} weight="regular" color={on ? "#111" : "#fff"} />
      </View>
      <T size={11} weight="600" color="rgba(255,255,255,0.8)">{label}</T>
    </Pressable>
  );
}

function CallLayer() {
  const live = useLive();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const call = live?.call;
  const [speaker, setSpeaker] = useState(true);
  const elapsed = useElapsed(call?.startedAt);
  const me = live?.me?.handle;

  useEffect(() => {
    if (!call?.notice) return undefined;
    const id = setTimeout(() => live.calls.clearNotice(), 3600);
    return () => clearTimeout(id);
  }, [call?.notice, live]);

  useEffect(() => {
    if (call?.phase === "idle") setSpeaker(true);
  }, [call?.phase]);

  if (!live || !call) return null;
  const notice = call.notice ? <Notice code={call.notice.code} /> : null;

  const convOf = (convId) => live.convs[convId];
  const titleOf = (convId) => {
    const conv = convOf(convId);
    if (!conv) {
      const local = store.chats.find((item) => item.id === convId);
      return { name: call.demo?.name || local?.name || "", src: call.demo?.src || local?.src || "", photo: call.demo?.photo || local?.photo, group: call.demo?.group, faces: local?.members };
    }
    const thread = liveThread(conv, me, null);
    return { name: thread.name, src: thread.src, faces: thread.people, photo: thread.photo, group: thread.group };
  };

  if (call.phase === "idle" && call.incoming) {
    const incoming = call.incoming;
    const head = titleOf(incoming.convId);
    const caller = live.people[incoming.from] || convOf(incoming.convId)?.members.find((m) => m.handle === incoming.from);
    const group = convOf(incoming.convId)?.kind === "group";
    return (
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.incoming, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 48 }]} accessibilityViewIsModal accessibilityLabel={t("Chiamata in arrivo")}>
        <StatusBar style="light" />
        <Backdrop src={caller?.src || head.src} name={caller?.name || head.name} />
        <View style={styles.incomingCard}>
          <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <Rings />
            <View style={{ borderRadius: 70, borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" }}><Face src={caller?.src} name={caller?.name || head.name} size={128} /></View>
          </View>
          <T size={26} weight="700" color="#fff" style={{ letterSpacing: -0.8, textAlign: "center" }}>{group ? head.name : (caller?.name || head.name)}</T>
          <T size={15} color="rgba(255,255,255,0.78)">
            {group ? `${caller?.name?.split(" ")[0] || ""} · ` : ""}
            {incoming.video ? t("Videochiamata in arrivo") : t("Chiamata in arrivo")}
          </T>
        </View>
        <View style={styles.incomingActions}>
          <Pressable accessibilityRole="button" onPress={() => { tap("medium"); live.calls.decline(); }} style={styles.incomingBtn}>
            <View style={[styles.bigRound, { backgroundColor: "#ff3b30" }]}><PhoneOff size={28} weight="fill" color="#fff" /></View>
            <T size={13} weight="600" color="#fff">{t("Rifiuta")}</T>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { tap("medium"); live.calls.accept(); }} style={styles.incomingBtn}>
            <Bounce><View style={[styles.bigRound, { backgroundColor: "#34c759" }]}>{incoming.video ? <Video size={28} weight="fill" color="#fff" /> : <Phone size={28} weight="fill" color="#fff" />}</View></Bounce>
            <T size={13} weight="600" color="#fff">{t("Rispondi")}</T>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  if (call.phase === "idle") return notice;

  const head = titleOf(call.convId);
  const peers = Object.entries(call.peers).map(([handle, peer]) => {
    const person = live.people[handle] || convOf(call.convId)?.members.find((m) => m.handle === handle) || { name: handle };
    return { handle, ...peer, name: person.name || handle, src: person.src || "", video: peer.cam !== false && hasVideo(peer.stream) };
  });
  const connected = Boolean(call.startedAt) && peers.length > 0;
  const status = call.phase === "joining"
    ? t("Connessione…")
    : connected
      ? (peers.some((peer) => peer.state === "reconnecting" || peer.state === "disconnected") ? t("Riconnessione…") : callStamp(elapsed))
      : call.demo || !peers.length ? t("Squilla…") : t("Connessione…");
  const anyVideo = call.cam || peers.some((peer) => peer.video);

  if (call.minimized) {
    return (
      <>
        <Animated.View entering={SlideInUp.springify().damping(18)} exiting={SlideOutUp.duration(200)} style={[styles.pill, { top: insets.top + 4 }]}>
          <Pressable style={styles.pillMain} onPress={() => { tap(); live.calls.minimize(false); }}>
            <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>{call.video ? <Video size={16} weight="fill" color="#04140a" /> : <Phone size={16} weight="fill" color="#04140a" />}</View>
            <T size={13.5} weight="700" color="#04140a" lines={1} style={{ flex: 1 }}>{head.name}</T>
            <T size={13.5} weight="700" color="#04140a" style={{ fontVariant: ["tabular-nums"] }}>{status}</T>
          </Pressable>
          <Pressable accessibilityLabel={t("Termina")} onPress={() => { tap("medium"); live.calls.hangup(); }} style={styles.pillEnd}>
            <PhoneOff size={16} weight="fill" color="#fff" />
          </Pressable>
        </Animated.View>
        {notice}
      </>
    );
  }

  const faces = peers.length ? peers : (head.faces?.length ? head.faces : [{ name: head.name, src: head.src }]);
  const solo = peers.length === 1 && peers[0].video;
  const groupHead = !peers.length && (head.group || head.photo);
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]}>
      <StatusBar style="light" />
      {!solo ? <Backdrop src={faces[0]?.src || head.src} name={head.name} photo={head.photo} group={head.group} /> : null}
      {solo ? <RTCView streamURL={peers[0].stream.toURL()} key={`${peers[0].handle}-${peers[0].v}`} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} /> : null}
      {anyVideo && !solo && peers.length > 1 ? (
        <View style={[styles.grid, { top: insets.top + 70, bottom: 150 + insets.bottom }]}>
          {peers.map((peer) => (
            <View key={peer.handle} style={[styles.tile, { width: peers.length === 2 ? "100%" : "48.6%", height: peers.length <= 2 ? "49%" : peers.length <= 4 ? "49%" : "32%" }]}>
              {peer.video ? <RTCView streamURL={peer.stream.toURL()} key={`${peer.handle}-${peer.v}`} style={StyleSheet.absoluteFill} objectFit="cover" /> : <Face src={peer.src} name={peer.name} size={72} />}
              <View style={styles.tileName}>
                <T size={11.5} weight="600" color="#fff">{peer.name.split(" ")[0]}</T>
                {peer.mic === false ? <MicOff size={12} weight="bold" color="#ff5b52" /> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {!anyVideo || (!solo && peers.length <= 1) ? (
        <View style={styles.voice} pointerEvents="none">
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: -18 }}>
            {!connected ? <Rings /> : null}
            {groupHead ? <GroupAvatar photo={head.photo} title={head.name} size={128} /> : faces.length > 1 ? (
              <View style={{ flexDirection: "row" }}>
                {faces.slice(0, 4).map((face, index) => (
                  <View key={face.handle || face.name} style={{ marginLeft: index ? -16 : 0, borderRadius: 44, borderWidth: 2, borderColor: "#070506" }}><Face src={face.src} name={face.name} size={84} /></View>
                ))}
              </View>
            ) : <Face src={faces[0]?.src} name={faces[0]?.name} size={128} />}
          </View>
          {peers.length === 1 && peers[0].mic === false ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 }}><MicOff size={14} weight="bold" color="rgba(255,255,255,0.72)" /><T size={14} color="rgba(255,255,255,0.72)">{t("Microfono spento")}</T></View>
          ) : null}
          {peers.length > 1 ? <T size={14} color="rgba(255,255,255,0.72)" style={{ marginTop: 16 }}>{peers.map((peer) => peer.name.split(" ")[0]).join(", ")}</T> : null}
        </View>
      ) : null}
      <LinearGradient pointerEvents="box-none" colors={["rgba(0,0,0,0.45)", "transparent"]} style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <T size={24} weight="700" color="#fff" lines={1} style={{ letterSpacing: -0.7, maxWidth: "76%" }}>{head.name}</T>
        <T size={14} color="rgba(255,255,255,0.86)" style={{ fontVariant: ["tabular-nums"] }}>{status}</T>
      </LinearGradient>
      <Pressable accessibilityLabel={t("Riduci")} onPress={() => { tap(); live.calls.minimize(true); }} style={[styles.min, { top: insets.top + 6 }]}>
        <Minimize size={17} weight="bold" color="#fff" />
      </Pressable>
      {call.cam && call.local ? (
        <View style={[styles.self, { bottom: 150 + insets.bottom }]}>
          <RTCView streamURL={call.local.toURL()} key={`self-${call.localV}`} style={StyleSheet.absoluteFill} objectFit="cover" mirror={call.facing === "user"} zOrder={1} />
          <Pressable accessibilityLabel={t("Gira fotocamera")} onPress={() => { tap(); live.calls.flip(); }} style={styles.flip}>
            <SwitchCamera size={14} weight="bold" color="#fff" />
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.controls, { bottom: 28 + insets.bottom }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <ControlButton icon={call.mic ? Mic : MicOff} label={t("Muto")} on={!call.mic} onPress={() => live.calls.toggleMic()} />
        <ControlButton icon={Volume} label={t("Audio")} on={speaker} onPress={() => { const next = !speaker; setSpeaker(next); routeAudio(next); }} />
        <ControlButton icon={call.cam ? Video : VideoOff} label={t("Camera")} on={call.cam} onPress={() => live.calls.toggleCam()} />
        <ControlButton icon={PhoneOff} label={t("Fine")} end onPress={() => live.calls.hangup()} />
      </View>
      {notice}
    </Animated.View>
  );
}

function LiveToast() {
  const live = useLive();
  const theme = useChatTheme();
  const insets = useSafeAreaInsets();
  const toast = live?.toast;
  if (!toast || live.call?.phase !== "idle" && !live.call?.minimized) return null;
  const message = toast.message;
  const group = toast.conv?.kind === "group";
  const text = message.kind === "image" ? `📷 ${t("Foto")}` : message.kind === "audio" ? `🎤 ${t("Messaggio vocale")}` : message.text;
  return (
    <Animated.View key={toast.id} entering={SlideInUp.springify().damping(20)} exiting={FadeOut.duration(160)} style={[styles.toast, { top: insets.top + 4, backgroundColor: theme.dark ? "rgba(38,38,38,0.96)" : "#fff" }]}>
      <Pressable
        style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
        onPress={() => {
          tap();
          live.dismissToast();
          router.push(`/chat/${toast.convId}`);
        }}
      >
        <Face src={toast.from?.src} name={toast.from?.name} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={14} weight="700" lines={1}>{group ? `${toast.from?.name?.split(" ")[0]} · ${toast.conv.title}` : toast.from?.name}</T>
          <T size={14} color={theme.text2} lines={1}>{text}</T>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notice: { position: "absolute", zIndex: 70, alignSelf: "center", maxWidth: "88%", paddingVertical: 9, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "rgba(20,16,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  incoming: { zIndex: 60, backgroundColor: "#070506", justifyContent: "space-between", paddingHorizontal: 24 },
  incomingCard: { alignItems: "center", gap: 8 },
  incomingActions: { flexDirection: "row", justifyContent: "space-around" },
  incomingBtn: { alignItems: "center", gap: 8 },
  bigRound: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", zIndex: 60, left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 6, padding: 5, borderRadius: 99, backgroundColor: "#1fcf5c", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  pillMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 },
  pillEnd: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#ff3b30", alignItems: "center", justifyContent: "center" },
  grid: { position: "absolute", left: 8, right: 8, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignContent: "flex-start", rowGap: 8 },
  tile: { borderRadius: 14, overflow: "hidden", backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  tileName: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.5)" },
  voice: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  top: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, alignItems: "center", gap: 4, paddingHorizontal: 20, paddingBottom: 18 },
  min: { position: "absolute", left: 14, zIndex: 3, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  self: { position: "absolute", zIndex: 2, right: 16, width: 108, height: 148, borderRadius: 14, overflow: "hidden", backgroundColor: "#141416" },
  flip: { position: "absolute", right: 6, bottom: 6, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  controls: { position: "absolute", zIndex: 2, left: 14, right: 14, flexDirection: "row", justifyContent: "center", gap: 4, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 6, borderRadius: 28, overflow: "hidden", backgroundColor: "rgba(38,38,38,0.82)" },
  control: { width: 72, alignItems: "center", gap: 6 },
  controlIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  toast: { position: "absolute", zIndex: 55, left: 12, right: 12, flexDirection: "row", paddingVertical: 9, paddingHorizontal: 12, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
