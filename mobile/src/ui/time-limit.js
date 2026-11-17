// Time spent (web App.jsx "space-time" + .time-wall): counts the minutes iywa is on screen
// each day and, once the daily limit in Settings → Tempo di utilizzo is reached, covers the
// app with a reminder until "Continua" (which lasts until tomorrow or a new limit).
import { useEffect } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../theme";
import { addUsage, dayKey, dismissLimit, useStore, useUsage } from "../lib/store";
import { t } from "../lib/i18n";
import { Timer } from "./icons";
import { Btn, T, tap } from "./kit";

const TICK = 15000;

// Adds foreground time to today's total every TICK and whenever the app leaves the screen.
function useUsageTracker() {
  useEffect(() => {
    let since = AppState.currentState === "active" ? Date.now() : 0;
    const flush = () => {
      if (!since) return;
      const now = Date.now();
      // A paused JS thread (sleep, debugger) should not count as use.
      addUsage(Math.min(now - since, TICK * 2));
      since = now;
    };
    const timer = setInterval(flush, TICK);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        if (!since) since = Date.now();
      } else {
        flush();
        since = 0;
      }
    });
    return () => {
      flush();
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}

export function todayMinutes(snapshot) {
  return Math.floor((snapshot.days[dayKey()] || 0) / 60000);
}

export function TimeLimit() {
  useUsageTracker();
  const theme = useTheme();
  const store = useStore();
  const usage = useUsage();
  const cap = Number(store.prefs?.timeLimit);
  const used = todayMinutes(usage);
  const dismissed = usage.dismissed?.day === dayKey() && usage.dismissed?.cap === String(store.prefs?.timeLimit);
  const on = store.ready && Boolean(store.auth?.handle) && cap > 0 && used >= cap && !dismissed;
  if (!on) return null;
  const close = () => { tap(); dismissLimit(store.prefs.timeLimit); };
  return (
    <View style={[StyleSheet.absoluteFill, styles.wall, { backgroundColor: theme.scrim }]} accessibilityViewIsModal>
      <View style={[styles.sheet, { backgroundColor: theme.bg }]}>
        <View style={[styles.icon, { backgroundColor: theme.blue }]}>
          <Timer size={34} weight="fill" color={theme.accentInk || "#fff"} />
        </View>
        <T size={22} weight="700" style={{ marginTop: 6 }}>{t("Tempo")}</T>
        <T size={15} color={theme.text2} style={{ textAlign: "center" }}>{t("Hai raggiunto il limite di oggi.")}</T>
        <T size={13} color={theme.text2}>{t("{n} minuti oggi", { n: used })}</T>
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 14 }}>
          <Pressable onPress={close} style={({ pressed }) => [styles.primary, { backgroundColor: theme.blue, opacity: pressed ? 0.7 : 1 }]}>
            <T size={15} weight="600" color={theme.accentInk || "#fff"}>{t("Continua")}</T>
          </Pressable>
          <Btn title={t("Modifica limite")} height={44} size={15} onPress={() => { dismissLimit(store.prefs.timeLimit); router.push("/settings/time"); }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { zIndex: 1000, elevation: 1000, alignItems: "center", justifyContent: "center", padding: 28 },
  sheet: { alignSelf: "stretch", borderRadius: 22, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 20, alignItems: "center", gap: 6 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  primary: { height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
