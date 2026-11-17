import { Platform } from "react-native";
import Constants from "expo-constants";

// Where the realtime hub (calls/src/worker.js) lives.
// - Development: ws://localhost:8787/calls/hub (`wrangler dev` on this Mac; the Android
//   emulator reaches the Mac at 10.0.2.2). A physical phone in development needs
//   app.json expo.extra.devHubUrl, e.g. "ws://192.168.1.20:8787/calls/hub", with
//   `wrangler dev --ip 0.0.0.0`.
// - Production: app.json expo.extra.hubUrl, e.g. "wss://space-calls.<account>.workers.dev/calls/hub".
//   When it is empty the app stays offline: chats and calls show "Connessione…", nothing errors.
export function hubUrl() {
  const extra = Constants.expoConfig?.extra || {};
  if (__DEV__) {
    if (extra.devHubUrl) return extra.devHubUrl;
    return `ws://${Platform.OS === "android" ? "10.0.2.2" : "localhost"}:8787/calls/hub`;
  }
  return extra.hubUrl || null;
}
