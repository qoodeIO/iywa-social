// The app's main surface: story camera · Home · Cerca · Reel · Messaggi · Profilo side by side
// in one native paging scroll view. Swiping moves between them with the finger, the tab bar
// jumps instantly, and every page stays mounted so nothing reloads when you come back.
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import { Stack, router, useIsFocused } from "expo-router";
import { useTheme } from "../theme";
import { HOME, PAGES, pagerX, registerPager, setPageIndex, useTabs } from "../lib/tabs";
import Home from "../screens/Home";
import Search from "../screens/Search";
import Reels from "../screens/Reels";
import Messages from "../screens/Messages";
import Profile from "../screens/Profile";
import { Camera } from "../ui/icons";

const SWIPE_CAMERA = "/story/camera";
const SCREENS = { home: Home, search: Search, reels: Reels, messages: Messages, profile: Profile };

// Left of Home: a black page that hands over to the full story camera once the swipe settles.
function CameraPage() {
  return (
    <View style={styles.camera}>
      <Camera size={34} color="rgba(255,255,255,0.55)" />
    </View>
  );
}

export default function Pager() {
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const W = box.w || screenW;
  const H = box.h;
  const ref = useRef(null);
  const focused = useIsFocused();
  const { index } = useTabs();
  const [mounted, setMounted] = useState(() => new Set([PAGES[index], PAGES[index - 1], PAGES[index + 1]]));
  const settled = useRef(index);
  // Only the first render may place the scroll view; later renders must not move it.
  const [start] = useState(() => ({ x: index * screenW, y: 0 }));

  // Every page mounts shortly after launch, so the first visit to a tab is already drawn.
  // One page at a time, so the first frames of Home stay smooth.
  useEffect(() => {
    const timers = PAGES.map((name, i) => setTimeout(() => setMounted((prev) => (prev.has(name) ? prev : new Set([...prev, name]))), 600 + i * 250));
    return () => timers.forEach(clearTimeout);
  }, []);

  // The scroll view starts at Home through contentOffset, which sends no scroll event.
  useEffect(() => {
    pagerX.setValue(settled.current * W);
    ref.current?.scrollTo({ x: settled.current * W, animated: false });
  }, [W]);

  useEffect(() => registerPager((next, animated) => {
    settled.current = next;
    setMounted((prev) => (prev.has(PAGES[next]) ? prev : new Set([...prev, PAGES[next]])));
    if (!animated) pagerX.setValue(next * W);
    ref.current?.scrollTo({ x: next * W, animated });
  }), [W]);

  // Back from the story camera: slide from the camera page to Home.
  useEffect(() => {
    if (focused && settled.current === 0) {
      settled.current = HOME;
      setPageIndex(HOME);
      pagerX.setValue(HOME * W);
      ref.current?.scrollTo({ x: HOME * W, animated: true });
    }
  }, [focused, W]);

  function onSettle(x) {
    const next = Math.round(x / W);
    settled.current = next;
    // Keeps the JS side of the scroll value right, for a tab bar that mounts again later.
    pagerX.setValue(next * W);
    setPageIndex(next);
    if (next === 0 && focused) router.push(SWIPE_CAMERA);
  }

  const dark = index === 0 || PAGES[index] === "reels";
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }} onLayout={(event) => { const { width, height } = event.nativeEvent.layout; setBox({ w: width, h: height }); }}>
      <Stack.Screen options={{ statusBarStyle: dark || theme.scheme === "dark" ? "light" : "dark" }} />
      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        snapToInterval={W}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        scrollsToTop={false}
        keyboardShouldPersistTaps="handled"
        decelerationRate="fast"
        contentOffset={start}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: pagerX } } }], {
          useNativeDriver: true,
          listener: (event) => {
            const at = Math.round(event.nativeEvent.contentOffset.x / W);
            setPageIndex(at);
            const name = PAGES[at];
            if (name && !mounted.has(name)) setMounted((prev) => new Set([...prev, name]));
          },
        })}
        onMomentumScrollEnd={(event) => onSettle(event.nativeEvent.contentOffset.x)}
      >
        {PAGES.map((name) => {
          const Screen = SCREENS[name];
          return (
            <View key={name} style={{ width: W, height: H }}>
              {name === "camera" ? <CameraPage /> : mounted.has(name) ? <Screen /> : <View style={{ flex: 1, backgroundColor: name === "reels" ? "#000" : theme.bg }} />}
            </View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: { ...StyleSheet.absoluteFill, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
});
