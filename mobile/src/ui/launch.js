// Opening the app: the native splash (the iywa tile on white, or black in dark mode) hands over
// to this identical screen drawn by React, which stays about half a second while the saved
// state loads and the first page draws, then fades away with the tile easing forward.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import { useStore } from "../lib/store";

SplashScreen.preventAutoHideAsync().catch(() => {});

const TILE = require("../../assets/splash-icon.png");
// Same size the native splash draws the image at (app.json, expo-splash-screen imageWidth).
export const SPLASH_WIDTH = 140;
const MIN_SHOW = 520;
const started = Date.now();

export function LaunchScreen() {
  const ready = useStore().ready;
  const dark = useColorScheme() === "dark";
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const line = useRef(new Animated.Value(0)).current;

  // The React copy is laid out the same as the native one, so hiding the native splash is invisible.
  function onShown() {
    SplashScreen.hide();
    Animated.timing(line, { toValue: 1, duration: MIN_SHOW, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
  }

  useEffect(() => {
    if (!ready) return undefined;
    const wait = Math.max(0, MIN_SHOW - (Date.now() - started));
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(timer);
  }, [ready]);

  if (gone) return null;
  const scale = fade.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });
  return (
    <Animated.View pointerEvents="none" onLayout={onShown} style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: dark ? "#000" : "#fff", opacity: fade }]}>
      <Animated.Image source={TILE} style={{ width: SPLASH_WIDTH, height: SPLASH_WIDTH, transform: [{ scale }] }} />
      <Animated.View style={[styles.track, { backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)" }]}>
        <Animated.View style={{ height: "100%", width: line.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), overflow: "hidden", borderRadius: 2 }}>
          <LinearGradient colors={["#F9761C", "#D62976", "#962FBF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bar} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 },
  track: { position: "absolute", bottom: 86, width: 64, height: 3, borderRadius: 2, overflow: "hidden" },
  bar: { width: 64, height: 3 },
});
