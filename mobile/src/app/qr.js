import { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import Animated, { ZoomIn } from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import MaskedText from "../ui/qr-text";
import qrcode from "../lib/qrcode";
import { useStore } from "../lib/store";
import { ArrowUpRight, Copy, X } from "../ui/icons-profile";
import { T, tap } from "../ui/kit";
import { useToast } from "../ui/profile-kit";

const TONES = [["#7c3aed", "#ff2d55"], ["#ff8a00", "#ff2d55"], ["#0095f6", "#34c759"], ["#111111", "#3a3a3c"]];

// "Condividi profilo": a QR code of your profile link on a colour you can change (web QrCard).
export default function QrScreen() {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const handle = String(store.profile.handle || "").replace(/^@/, "");
  const url = `https://space.app/u/${handle}`;
  const [tone, setTone] = useState(0);
  const [toast, say] = useToast();
  const [a, b] = TONES[tone];
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const dots = [];
    for (let r = 0; r < count; r += 1) for (let c = 0; c < count; c += 1) if (qr.isDark(r, c)) dots.push([c, r]);
    return { count, dots };
  }, [url]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[a, b]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Chiudi" hitSlop={8} onPress={() => router.back()} style={styles.close}><X size={22} weight="bold" color="#fff" /></Pressable>
        <Pressable onPress={() => { tap(); setTone((value) => (value + 1) % TONES.length); }} style={styles.tone}>
          <T size={13} weight="700" color="#fff">Colore</T>
        </Pressable>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.card}>
          <Svg width={216} height={216} viewBox={`-1 -1 ${cells.count + 2} ${cells.count + 2}`} accessibilityLabel={`QR ${handle}`}>
            <Defs>
              <SvgGradient id="qr" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={a} />
                <Stop offset="1" stopColor={b} />
              </SvgGradient>
            </Defs>
            {cells.dots.map(([x, y]) => <Rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.28} fill="url(#qr)" />)}
          </Svg>
          <MaskedText text={`@${handle.toUpperCase()}`} colors={[a, b]} />
        </Animated.View>
        <View style={styles.actions}>
          <Pressable onPress={() => { tap(); Share.share({ message: url, url, title: `@${handle}` }).catch(() => {}); }} style={({ pressed }) => [styles.action, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
            <ArrowUpRight size={22} color="#111" />
            <T size={12.5} weight="600" color="#111">Condividi profilo</T>
          </Pressable>
          <Pressable onPress={() => { tap(); Clipboard.setStringAsync(url).catch(() => {}); say("Link copiato"); }} style={({ pressed }) => [styles.action, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
            <Copy size={22} color="#111" />
            <T size={12.5} weight="600" color="#111">Copia link</T>
          </Pressable>
        </View>
      </View>
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  tone: { height: 32, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28, padding: 24 },
  card: { width: 260, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 16, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 25, shadowOffset: { width: 0, height: 20 } },
  actions: { flexDirection: "row", gap: 10, width: 260 },
  action: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: "#fff" },
});
