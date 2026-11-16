import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StoreProvider, useStore } from "../lib/store";
import { LiveRoot } from "../ui/chatCall";
import TabBar from "../ui/TabBar";
import { FeedOverlay } from "../ui/notify";
import { AuthGate } from "../ui/auth";
import { useTheme } from "../theme";
import { useLive } from "../live/LiveStore";

const TAB_ROOTS = ["index", "search", "reels", "messages", "profile"];
// Screens drawn over black media keep light status bar text in both themes.
const LIGHT_BAR = { statusBarStyle: "light" };

function Shell() {
  const theme = useTheme();
  const call = useLive()?.call;
  // Full-screen call UI sits above the Stack; flip every screen's bar to light while it shows.
  const callFull = Boolean(call && ((call.phase === "idle" && call.incoming) || (call.phase !== "idle" && !call.minimized)));
  const barStyle = callFull || theme.scheme === "dark" ? "light" : "dark";
  // Changing language redraws every screen with the new strings.
  const language = useStore().language;
  return (
    <View key={language} style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: "default", gestureEnabled: true, statusBarStyle: barStyle, statusBarAnimation: "fade" }}>
          {TAB_ROOTS.map((name) => <Stack.Screen key={name} name={name} options={{ animation: "fade", animationDuration: 140, ...(name === "reels" ? LIGHT_BAR : null) }} />)}
          <Stack.Screen name="story/[deck]" options={{ statusBarStyle: "light", presentation: "transparentModal", animation: "fade", animationDuration: 180, gestureEnabled: false, contentStyle: { backgroundColor: "transparent" } }} />
          <Stack.Screen name="story/new" options={{ statusBarStyle: "light", presentation: "fullScreenModal", animation: "slide_from_bottom", gestureEnabled: false, contentStyle: { backgroundColor: "#000" } }} />
          <Stack.Screen name="compose" options={{ presentation: "modal" }} />
          <Stack.Screen name="create" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="comments/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="share/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="reel-camera" options={{ statusBarStyle: "light", presentation: "fullScreenModal", animation: "slide_from_bottom", gestureEnabled: false, contentStyle: { backgroundColor: "#000" } }} />
          <Stack.Screen name="edit-profile" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="product-edit/[id]" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="qr" options={{ presentation: "fullScreenModal", animation: "fade" }} />
          <Stack.Screen name="auth" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom", gestureEnabled: false }} />
        </Stack>
      </View>
      <TabBar />
      <FeedOverlay />
      <AuthGate />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <LiveRoot>
            <Shell />
          </LiveRoot>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
