// Sign-in, sign-up and password reset (web AuthScreen), plus the gate that shows it
// over the whole app until an account on this phone is signed in, like the web app.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR, avatarFor } from "../data";
import { Checked, ChevronLeft, Eye, EyeOff, Warn } from "./icons-profile";
import { T, tap } from "./kit";

export const DEMO_USER = { name: "Giulia Neri", handle: "forno.neri", password: "forno" };

export function strengthOf(value) {
  let score = 0;
  if (value.length >= 4) score += 1;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^\w]/.test(value)) score += 1;
  return Math.min(4, score);
}

function palette(theme) {
  return theme.scheme === "dark"
    ? { bg: "#000", field: "#121212", line: "#363636", text: "#f5f5f5", sub: "#a8a8a8", blue: "#0095f6", red: "#ff3040", green: "#34c759" }
    : { bg: "#fff", field: "#fafafa", line: "#dbdbdb", text: "#000", sub: "#737373", blue: "#0095f6", red: "#ff3040", green: "#34c759" };
}

function AuthField({ a, label, value, onChange, secure, autoComplete, inputRef, trailing, state, hint, onSubmit, returnKeyType }) {
  const [focus, setFocus] = useState(false);
  const up = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(up, { toValue: focus || value ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [focus, value, up]);
  const border = state === "err" ? a.red : focus ? a.sub : a.line;
  return (
    <View style={[styles.field, { backgroundColor: a.field, borderColor: border }]}>
      <Animated.Text
        pointerEvents="none"
        style={[styles.label, { color: a.sub, transformOrigin: "left center", transform: [{ translateY: up.interpolate({ inputRange: [0, 1], outputRange: [0, -11] }) }, { scale: up.interpolate({ inputRange: [0, 1], outputRange: [1, 0.76] }) }] }]}
      >
        {label}
      </Animated.Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        secureTextEntry={secure}
        autoComplete={autoComplete}
        textContentType={autoComplete === "username" ? "username" : autoComplete === "name" ? "name" : autoComplete === "new-password" ? "newPassword" : autoComplete === "current-password" ? "password" : undefined}
        autoCapitalize={autoComplete === "name" ? "words" : "none"}
        autoCorrect={false}
        spellCheck={false}
        onSubmitEditing={onSubmit}
        returnKeyType={returnKeyType}
        style={[styles.input, { color: a.text }]}
      />
      {hint ? <T size={11} weight="600" color={state === "err" ? a.red : a.green} style={styles.hint}>{hint}</T> : null}
      {trailing}
    </View>
  );
}

export function AuthScreen({ onDone, backHandle }) {
  const theme = useTheme();
  const a = palette(theme);
  const insets = useSafeAreaInsets();
  const store = useStore();
  const users = store.auth?.users?.length ? store.auth.users : [DEMO_USER];
  const back = backHandle || store.auth?.previous || null;
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const passRef = useRef(null);
  const shake = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const backUser = back ? users.find((user) => user.handle === back) : null;

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [mode, enter]);

  function fail(text) {
    setError(text);
    setBusy(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    shake.setValue(0);
    Animated.sequence([-8, 8, -4, 3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 90, useNativeDriver: true }))).start();
  }

  function go(next) {
    setMode(next);
    setError("");
    setNote("");
    setPassword("");
    setAgain("");
    setShow(false);
  }

  function findUser(value) {
    const key = value.trim().replace(/^@/, "").toLowerCase();
    return users.find((user) => user.handle === key || user.name.toLowerCase() === value.trim().toLowerCase());
  }

  function enterAs(next) {
    store.signIn(next);
    onDone?.();
  }

  const joinKey = handle.trim().replace(/^@/, "").toLowerCase();
  const handleOk = /^[a-z0-9._]{3,30}$/.test(joinKey);
  const taken = mode === "join" && users.some((user) => user.handle === joinKey);
  const strength = strengthOf(password);
  const ready = mode === "login"
    ? handle.trim().length > 1 && password.length > 0
    : mode === "join"
      ? name.trim().length > 1 && handleOk && !taken && password.length >= 4 && again.length > 0
      : mode === "forgot"
        ? handle.trim().length > 1
        : password.length >= 4 && again.length > 0;

  function submit() {
    if (!ready || busy) return;
    setError("");
    setBusy(true);
    tap();
    // A short beat so the button can show it is working, like a real sign-in.
    setTimeout(() => {
      if (mode === "login") {
        const user = findUser(handle);
        if (!user) return fail("Nessun account con questo nome utente.");
        if (user.password !== password) return fail("Password errata. Riprova.");
        setBusy(false);
        enterAs(user.handle);
        return;
      }
      if (mode === "forgot") {
        const user = findUser(handle);
        if (!user) return fail("Nessun account con questo nome utente.");
        setBusy(false);
        setHandle(user.handle);
        setMode("reset");
        setPassword("");
        setAgain("");
        return;
      }
      if (password !== again) return fail("Le due password non coincidono.");
      if (mode === "reset") {
        store.resetPassword(handle, password);
        setBusy(false);
        go("login");
        setNote("Password aggiornata. Accedi con quella nuova.");
        return;
      }
      if (taken) return fail("Questo nome utente è già in uso.");
      setBusy(false);
      store.joinAccount({ name: name.trim(), handle: joinKey, password });
      onDone?.();
    }, 520);
  }

  const cta = mode === "join" ? "Crea account" : mode === "forgot" ? "Continua" : mode === "reset" ? "Salva password" : "Accedi";
  const heading = { login: backUser ? "Aggiungi un account" : "Bentornato", join: "Crea il tuo account", forgot: "Trova il tuo account", reset: "Scegli una nuova password" }[mode];
  const sub = {
    login: "",
    join: "Condividi il tuo lavoro, segui gli artigiani e chatta in tempo reale.",
    forgot: "Scrivi il tuo nome utente e ti aiutiamo a impostare una nuova password.",
    reset: `Per @${handle}. Usa almeno 4 caratteri.`,
  }[mode];
  const saved = users.filter((user) => user.handle !== back).slice(0, 3);
  const eye = password ? (
    <Pressable accessibilityLabel={show ? "Nascondi password" : "Mostra password"} hitSlop={8} onPress={() => setShow((value) => !value)} style={styles.trail}>
      {show ? <EyeOff size={22} color={a.text} /> : <Eye size={22} color={a.text} />}
    </Pressable>
  ) : null;
  const strengthColors = ["", a.red, "#ff9f0a", "#ffd60a", a.green];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: a.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.top, { paddingTop: insets.top }]}>
        {mode !== "login" ? (
          <Pressable accessibilityLabel="Indietro" onPress={() => go("login")} style={styles.back}><ChevronLeft size={22} weight="bold" color={a.text} /></Pressable>
        ) : backUser ? (
          <Pressable onPress={() => enterAs(backUser.handle)} style={[styles.back, { paddingRight: 12, backgroundColor: a.field, borderWidth: StyleSheet.hairlineWidth, borderColor: a.line }]}>
            <ChevronLeft size={22} weight="bold" color={a.text} />
            <T size={14.5} weight="600" color={a.text}>Torna a @{backUser.handle}</T>
          </Pressable>
        ) : <View />}
        <T size={13} color={a.sub}>Italiano</T>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ width: "100%", alignItems: "center", opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          <LinearGradient colors={["#8b5cf6", "#3b82f6", "#06b6d4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mark}>
            <View style={styles.markRing} />
            <T size={34} weight="800" color="#fff" style={{ letterSpacing: -1.7, lineHeight: 38 }}>S</T>
          </LinearGradient>
          {mode === "login" ? <T size={34} weight="800" color={a.text} style={styles.word}>Space</T> : <T size={22} weight="700" color={a.text} style={{ textAlign: "center", letterSpacing: -0.4 }}>{heading}</T>}
          {mode !== "login" ? <T size={14} color={a.sub} style={styles.sub}>{sub}</T> : null}
          {note ? (
            <View style={styles.note}>
              <Checked size={18} weight="fill" color={a.green} />
              <T size={13.5} color={a.text} style={{ flex: 1 }}>{note}</T>
            </View>
          ) : null}
          <Animated.View style={{ width: "100%", gap: 10, transform: [{ translateX: shake }] }}>
            {mode === "join" ? <AuthField a={a} label="Nome e cognome" value={name} onChange={setName} autoComplete="name" returnKeyType="next" /> : null}
            {mode !== "reset" ? (
              <AuthField
                a={a}
                label="Nome utente"
                value={handle}
                onChange={(value) => setHandle(mode === "join" ? value.toLowerCase().replace(/\s+/g, "") : value)}
                autoComplete="username"
                returnKeyType={mode === "forgot" ? "go" : "next"}
                onSubmit={mode === "forgot" ? submit : () => passRef.current?.focus()}
                state={mode === "join" && handle ? (taken || !handleOk ? "err" : "ok") : ""}
                trailing={mode === "join" && handle ? <View style={styles.trail}>{taken || !handleOk ? <Warn size={20} weight="fill" color={a.red} /> : <Checked size={20} weight="fill" color={a.green} />}</View> : null}
                hint={mode === "join" && handle ? (taken ? "Già in uso" : !handleOk ? "3–30 lettere, numeri, . o _" : "Disponibile") : ""}
              />
            ) : null}
            {mode !== "forgot" ? (
              <AuthField
                a={a}
                label={mode === "reset" ? "Nuova password" : "Password"}
                value={password}
                onChange={setPassword}
                secure={!show}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                inputRef={passRef}
                returnKeyType={mode === "login" ? "go" : "next"}
                onSubmit={mode === "login" ? submit : undefined}
                trailing={eye}
              />
            ) : null}
            {(mode === "join" || mode === "reset") && password ? (
              <View style={styles.strength} accessibilityLabel="Robustezza password">
                <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
                  {[1, 2, 3, 4].map((i) => <View key={i} style={[styles.bar, { backgroundColor: strength >= i ? strengthColors[strength] : a.line }]} />)}
                </View>
                <T size={12} weight="600" color={a.sub} style={{ minWidth: 64, textAlign: "right" }}>{["Troppo corta", "Debole", "Discreta", "Buona", "Forte"][strength]}</T>
              </View>
            ) : null}
            {mode === "join" || mode === "reset" ? (
              <AuthField
                a={a}
                label="Ripeti password"
                value={again}
                onChange={setAgain}
                secure={!show}
                autoComplete="new-password"
                returnKeyType="go"
                onSubmit={submit}
                state={again ? (again === password ? "ok" : "err") : ""}
                trailing={again ? <View style={styles.trail}>{again === password ? <Checked size={20} weight="fill" color={a.green} /> : <Warn size={20} weight="fill" color={a.red} />}</View> : null}
              />
            ) : null}
            {error ? (
              <View style={styles.error} accessibilityRole="alert">
                <Warn size={16} weight="fill" color={a.red} />
                <T size={13.5} weight="500" color={a.red}>{error}</T>
              </View>
            ) : null}
            <Pressable disabled={!ready} onPress={submit} style={({ pressed }) => [styles.go, { backgroundColor: pressed && ready ? "#1877f2" : a.blue, opacity: ready ? 1 : 0.4, transform: [{ scale: pressed && ready ? 0.98 : 1 }] }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <T size={15.5} weight="700" color="#fff">{cta}</T>}
            </Pressable>
            {mode === "login" ? (
              <Pressable onPress={() => go("forgot")} style={{ alignSelf: "center", marginTop: 10, padding: 6 }}>
                <T size={14} weight="600" color={a.text}>Password dimenticata?</T>
              </Pressable>
            ) : null}
            {mode === "join" ? <T size={12} color={a.sub} style={{ textAlign: "center", marginTop: 4, lineHeight: 17 }}>Iscrivendoti accetti i Termini e l'Informativa sulla privacy.</T> : null}
          </Animated.View>
          {mode === "login" && saved.length && !handle ? (
            <View style={{ width: "100%", marginTop: 26 }}>
              <View style={styles.or}>
                <View style={[styles.orLine, { backgroundColor: a.line }]} />
                <T size={12.5} color={a.sub}>Account su questo dispositivo</T>
                <View style={[styles.orLine, { backgroundColor: a.line }]} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
                {saved.map((user) => (
                  <Pressable
                    key={user.handle}
                    onPress={() => { tap(); setHandle(user.handle); setTimeout(() => passRef.current?.focus(), 40); }}
                    style={({ pressed }) => ({ alignItems: "center", gap: 6, transform: [{ scale: pressed ? 0.94 : 1 }] })}
                  >
                    <Image source={{ uri: user.handle === DEMO_USER.handle ? store.profile?.src || AVATAR : avatarFor(user.name || user.handle) || AVATAR }} style={[styles.savedFace, { borderColor: a.line }]} />
                    <T size={12.5} weight="500" color={a.text}>{user.handle}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: Math.max(26, insets.bottom + 8) }]}>
        <Pressable onPress={() => go(mode === "login" ? "join" : "login")} style={({ pressed }) => [styles.outline, { borderColor: a.blue, backgroundColor: pressed ? "rgba(0,149,246,0.1)" : "transparent" }]}>
          <T size={15} weight="700" color={a.blue}>{mode === "login" ? "Crea nuovo account" : "Ho già un account"}</T>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <LinearGradient colors={["#8b5cf6", "#3b82f6", "#06b6d4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 14, height: 14, borderRadius: 4 }} />
          <T size={13} weight="700" color={a.sub}>Space</T>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Covers the app until someone signs in (the web app renders AuthScreen on top while auth.handle is empty).
export function AuthGate() {
  const store = useStore();
  const theme = useTheme();
  if (!store.ready) return <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} />;
  if (store.auth?.handle) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <AuthScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, minHeight: 44 },
  back: { flexDirection: "row", alignItems: "center", gap: 4, height: 36, minWidth: 36, paddingHorizontal: 6, borderRadius: 99 },
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 10 },
  mark: { width: 64, height: 64, borderRadius: 18, marginBottom: 14, alignItems: "center", justifyContent: "center", shadowColor: "#3b82f6", shadowOpacity: 0.3, shadowRadius: 11, shadowOffset: { width: 0, height: 8 } },
  markRing: { position: "absolute", top: 10, left: 10, right: 10, bottom: 10, borderRadius: 99, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)", transform: [{ rotate: "-24deg" }, { scaleY: 0.42 }] },
  word: { marginBottom: 30, letterSpacing: -1.7, lineHeight: 38 },
  sub: { marginTop: 8, marginBottom: 22, maxWidth: 300, textAlign: "center", lineHeight: 20 },
  note: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(52,199,89,0.14)" },
  field: { height: 54, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 6 },
  label: { position: "absolute", left: 16, fontSize: 15.5 },
  input: { flex: 1, height: "100%", paddingTop: 18, paddingBottom: 2, paddingHorizontal: 16, fontSize: 15.5 },
  hint: { position: "absolute", right: 48, top: 8 },
  trail: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  strength: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -2, marginHorizontal: 4, marginBottom: 2 },
  bar: { flex: 1, height: 4, borderRadius: 99 },
  error: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  go: { height: 46, marginTop: 6, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  or: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  savedFace: { width: 54, height: 54, borderRadius: 27, borderWidth: StyleSheet.hairlineWidth },
  foot: { alignItems: "center", gap: 14, paddingTop: 10, paddingHorizontal: 24 },
  outline: { width: "100%", height: 44, borderRadius: 99, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
