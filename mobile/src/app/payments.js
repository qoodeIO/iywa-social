import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { payApi, payBase, payHandle } from "../lib/pay";
import { Bag, Bell, Check, Directions, PriceTag, Warn } from "../ui/icons-profile";
import { Header, T, tap } from "../ui/kit";
import { settingsColors } from "../ui/profile-kit";

// Pagamenti: connect a Stripe account to sell directly in the app (web PaymentsSetup).
// It talks to the iywa hub; when the hub is not reachable the card says so.
export default function Payments() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const st = settingsColors(theme);
  const handle = payHandle(store);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    payApi("/config").then(setConfig).catch(() => setConfig({ enabled: false, offline: true }));
    if (handle) payApi(`/connect/status?handle=${encodeURIComponent(handle)}`).then(setStatus).catch((err) => setStatus({ connected: false, error: err.code }));
  }, [handle]);
  useEffect(load, [load]);

  const back = payBase() ? `${payBase().replace(/\/calls\/api$/, "")}/` : "https://iywa.app/";

  async function onboard() {
    setBusy(true);
    setError("");
    try {
      const { url } = await payApi("/connect/onboard", { handle, returnUrl: back, country: "IT" });
      await WebBrowser.openBrowserAsync(url);
      load();
    } catch (err) {
      setError(err.detail || err.code || "error");
    }
    setBusy(false);
  }

  async function dashboard() {
    setBusy(true);
    try {
      const { url } = await payApi("/connect/dashboard", { handle });
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setError(err.detail || err.code || "error");
    }
    setBusy(false);
  }

  const ready = status?.chargesEnabled;
  const state = !config ? "loading" : !handle ? "nouser" : config.offline ? "offline" : !config.enabled ? "server" : ready ? "ready" : status?.connected ? "pending" : "none";
  const fee = config?.feePercent ?? 5;
  const title = {
    ready: t("Pagamenti attivi"),
    pending: t("Completa la verifica su Stripe"),
    none: t("Vendi direttamente nell'app"),
    server: t("Stripe non è configurato sul server"),
    nouser: t("Prima collegati al Direct"),
    offline: t("Server non raggiungibile"),
    loading: t("Controllo…"),
  }[state];
  const text = {
    ready: t("Chi compra paga con carta, Apple Pay o Google Pay. I soldi arrivano sul tuo account Stripe."),
    pending: t("Stripe ha bisogno di qualche dato prima di poterti pagare."),
    none: t("Collega il tuo account Stripe: i pagamenti arrivano lì e poi sul tuo conto in banca."),
    server: t("Aggiungi STRIPE_SECRET_KEY al server (calls/.dev.vars) per attivare i pagamenti."),
    offline: payBase() ? t("Il server live ora non risponde.") : t("Il server live di iywa non è ancora collegato a questa app (EXPO_PUBLIC_HUB_URL)."),
    nouser: "",
    loading: "",
  }[state];
  const tone = state === "ready" ? "#34c759" : state === "pending" ? "#ff9500" : "#5e5ce6";

  return (
    <View style={{ flex: 1, backgroundColor: st.bg }}>
      <Header title={t("Pagamenti")} />
      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 30 }}>
        <View style={[styles.card, { backgroundColor: st.card, padding: 14 }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={[styles.ico, { backgroundColor: tone }]}>{state === "ready" ? <Check size={16} weight="bold" color="#fff" /> : <PriceTag size={16} weight="fill" color="#fff" />}</View>
            <View style={{ flex: 1, gap: 3 }}>
              <T size={15.5} weight="700">{title}</T>
              {text ? <T size={13} color={theme.text2} style={{ lineHeight: 18 }}>{text}</T> : null}
            </View>
          </View>
          {config?.testMode ? <View style={styles.test}><T size={11.5} weight="700" color="#ff9f0a">{t("Modalità test")}</T></View> : null}
          {state === "none" || state === "pending" ? (
            <Pressable disabled={busy} onPress={() => { tap(); onboard(); }} style={({ pressed }) => [styles.go, { backgroundColor: theme.blue, opacity: busy ? 0.6 : pressed ? 0.8 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <T size={15} weight="600" color="#fff">{state === "none" ? t("Collega Stripe") : t("Continua su Stripe")}</T>}
            </Pressable>
          ) : null}
          {state === "ready" ? (
            <Pressable disabled={busy} onPress={() => { tap(); dashboard(); }} style={({ pressed }) => [styles.go, { backgroundColor: theme.btn, opacity: pressed ? 0.8 : 1 }]}>
              <T size={15} weight="600">{t("Apri dashboard Stripe")}</T>
            </Pressable>
          ) : null}
          {state === "offline" || state === "server" ? (
            <Pressable onPress={() => { tap(); setConfig(null); load(); }} style={({ pressed }) => [styles.go, { backgroundColor: theme.btn, opacity: pressed ? 0.8 : 1 }]}>
              <T size={15} weight="600">{t("Riprova")}</T>
            </Pressable>
          ) : null}
          {error ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Warn size={15} weight="fill" color="#ff453a" />
              <T size={13} color="#ff453a" style={{ flex: 1 }}>{error}</T>
            </View>
          ) : null}
        </View>
        <T size={12.5} weight="500" color={theme.text2} style={styles.cap}>{t("COME FUNZIONA")}</T>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          {[
            [Bag, "#0a84ff", t("“Acquista ora” sui tuoi prodotti"), t("Pagamento sicuro con Stripe, con indirizzo di spedizione.")],
            [Directions, "#34c759", t("Pagato sul tuo account"), t("Stripe versa automaticamente sul tuo conto.")],
            [PriceTag, "#8e8e93", t("Commissione iywa: {fee}%", { fee }), t("Più le commissioni carta di Stripe. Nessun costo mensile.")],
            [Bell, "#ff9500", t("Avvisi d'ordine in tempo reale"), t("Ricevi una notifica appena qualcuno compra.")],
          ].map(([Icon, color, head, sub], index) => (
            <View key={head} style={styles.row}>
              {index ? <View style={[styles.sep, { backgroundColor: theme.line }]} /> : null}
              <View style={[styles.ico, { backgroundColor: color }]}><Icon size={16} weight="fill" color="#fff" /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <T size={15.5} weight="500" lines={1}>{head}</T>
                <T size={12.5} color={theme.text2}>{sub}</T>
              </View>
            </View>
          ))}
        </View>
        <T size={12.5} color={theme.text2} style={{ marginTop: 10, marginHorizontal: 30, lineHeight: 17 }}>{t("I prodotti con foto caricate dal telefono si sincronizzano senza foto: per ora usa foto dal web.")}</T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: INSET, borderRadius: 14, overflow: "hidden" },
  ico: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  test: { alignSelf: "flex-start", marginTop: 10, marginLeft: 42, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, backgroundColor: "rgba(255,159,10,0.18)" },
  go: { height: 42, borderRadius: 8, marginTop: 14, alignItems: "center", justifyContent: "center" },
  cap: { marginTop: 22, marginBottom: 7, marginHorizontal: 30, letterSpacing: 0.4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingVertical: 8, paddingHorizontal: 14 },
  sep: { position: "absolute", top: 0, right: 0, left: 56, height: StyleSheet.hairlineWidth },
});
