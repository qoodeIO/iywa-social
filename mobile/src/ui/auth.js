// Sign-in, sign-up and password reset (web AuthScreen), plus the gate that shows it
// over the whole app until an account on this phone is signed in, like the web app.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";
import { signIn, signUp, switchAccount, useSession } from "../lib/session";
import { api, errorText } from "../lib/api";
import { Checked, ChevronLeft, Eye, EyeOff, Warn } from "./icons-profile";
import { T, tap } from "./kit";
import { LANGS, currentLanguage, t } from "../lib/i18n";

export function strengthOf(value) {
  let score = 0;
  if (value.length >= 6) score += 1;
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
  const session = useSession();
  const users = session.accounts || [];
  const back = backHandle || null;
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState({ handle: false, email: false });
  // The last account used on this phone opens ready: only its password is needed, like Instagram.
  const [chosen, setChosen] = useState(() => (back ? null : users.find((user) => user.handle !== back)?.handle || null));
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

  async function enterAs(next) {
    tap();
    if (await switchAccount(next)) onDone?.();
    else { setChosen(next); setTimeout(() => passRef.current?.focus(), 60); }
  }

  const joinKey = handle.trim().replace(/^@/, "").toLowerCase();
  const mailKey = email.trim().toLowerCase();
  const handleOk = /^[a-z0-9._]{3,30}$/.test(joinKey) && !/^\.|\.$|\.\./.test(joinKey);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailKey);

  // Username and email availability, checked on the server while typing.
  useEffect(() => {
    if (mode !== "join" || (!handleOk && !emailOk)) return undefined;
    const timer = setTimeout(() => {
      api("/auth/available", { query: { handle: handleOk ? joinKey : "", email: emailOk ? mailKey : "" } })
        .then((data) => setTaken({ handle: data.handle === false, email: data.email === false }))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [mode, joinKey, mailKey, handleOk, emailOk]);

  const strength = strengthOf(password);
  const ready = mode === "login"
    ? (chosen || handle.trim().length > 1) && password.length > 0
    : mode === "join"
      ? name.trim().length > 0 && emailOk && !taken.email && handleOk && !taken.handle && password.length >= 6 && again.length > 0
      : false;

  async function submit() {
    if (!ready || busy) return;
    setError("");
    if (mode === "join" && password !== again) return fail(t("Le due password non coincidono."));
    setBusy(true);
    tap();
    try {
      if (mode === "login") await signIn(chosen || handle.trim(), password);
      else await signUp({ name: name.trim(), handle: joinKey, email: mailKey, password });
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone?.();
    } catch (err) {
      fail(errorText(err, t));
    }
  }

  const cta = mode === "join" ? t("Crea account") : t("Accedi");
  const heading = { login: backUser ? t("Aggiungi un account") : t("Bentornato"), join: t("Crea il tuo account"), forgot: t("Password dimenticata?") }[mode];
  const sub = {
    login: "",
    join: t("Condividi il tuo lavoro, segui gli artigiani e chatta in tempo reale."),
    forgot: t("Il recupero della password via email arriverà presto. Per ora, se sei ancora dentro su un altro telefono, puoi cambiarla da Impostazioni › Password."),
  }[mode];
  const saved = users.filter((user) => user.handle !== back).slice(0, 3);
  const eye = password ? (
    <Pressable accessibilityLabel={show ? t("Nascondi password") : t("Mostra password")} hitSlop={8} onPress={() => setShow((value) => !value)} style={styles.trail}>
      {show ? <EyeOff size={22} color={a.text} /> : <Eye size={22} color={a.text} />}
    </Pressable>
  ) : null;
  const strengthColors = ["", a.red, "#ff9f0a", "#ffd60a", a.green];

  const picked = mode === "login" && chosen ? users.find((user) => user.handle === chosen) : null;
  const others = saved.filter((user) => user.handle !== chosen);
  const language = LANGS.find((lang) => lang.id === currentLanguage())?.label || "Italiano";

  function choose(next) {
    tap();
    setChosen(next);
    setHandle("");
    setPassword("");
    setError("");
    if (next) setTimeout(() => passRef.current?.focus(), 60);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: a.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top }}>
      <View style={styles.top}>
        {mode !== "login" ? (
          <Pressable accessibilityLabel={t("Indietro")} onPress={() => go("login")} style={styles.back}><ChevronLeft size={24} weight="bold" color={a.text} /></Pressable>
        ) : backUser ? (
          <Pressable onPress={() => enterAs(backUser.handle)} style={styles.back}>
            <ChevronLeft size={24} weight="bold" color={a.text} />
            <T size={15} weight="600" color={a.text}>{t("Torna a @{handle}", { handle: backUser.handle })}</T>
          </Pressable>
        ) : (
          <T size={13.5} color={a.sub} style={styles.lang}>{language}</T>
        )}
      </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, mode !== "login" && styles.bodyTop]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ width: "100%", opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          {mode !== "login" ? (
            <View style={styles.head}>
              <T size={26} weight="700" color={a.text} style={{ letterSpacing: -0.7, lineHeight: 31 }}>{heading}</T>
              <T size={15} color={a.sub} style={styles.sub}>{sub}</T>
            </View>
          ) : picked ? (
            <View style={styles.who}>
              <Face user={picked} size={96} a={a} style={[styles.whoFace, { borderColor: a.line }]} />
              <T size={18} weight="700" color={a.text}>{picked.handle}</T>
              {picked.name ? <T size={14} color={a.sub}>{picked.name}</T> : null}
            </View>
          ) : (
            <T size={56} weight="700" color={a.text} style={styles.word}>iywa</T>
          )}
          {note ? (
            <View style={styles.note}>
              <Checked size={18} weight="fill" color={a.green} />
              <T size={13.5} color={a.text} style={{ flex: 1 }}>{note}</T>
            </View>
          ) : null}
          <Animated.View style={{ width: "100%", gap: 10, transform: [{ translateX: shake }] }}>
            {mode === "join" ? <AuthField a={a} label={t("Nome e cognome")} value={name} onChange={setName} autoComplete="name" returnKeyType="next" /> : null}
            {mode === "join" ? (
              <AuthField
                a={a}
                label={t("Email")}
                value={email}
                onChange={(value) => setEmail(value.replace(/\s+/g, ""))}
                autoComplete="email"
                returnKeyType="next"
                state={email ? (!emailOk || taken.email ? "err" : "ok") : ""}
                hint={email ? (taken.email ? t("Già registrata") : !emailOk ? t("Email non valida") : "") : ""}
              />
            ) : null}
            {mode !== "forgot" && !picked ? (
              <AuthField
                a={a}
                label={mode === "login" ? t("Nome utente o email") : t("Nome utente")}
                value={handle}
                onChange={(value) => setHandle(mode === "join" ? value.toLowerCase().replace(/\s+/g, "") : value)}
                autoComplete="username"
                returnKeyType="next"
                onSubmit={() => passRef.current?.focus()}
                state={mode === "join" && handle ? (taken.handle || !handleOk ? "err" : "ok") : ""}
                trailing={mode === "join" && handle ? <View style={styles.trail}>{taken.handle || !handleOk ? <Warn size={20} weight="fill" color={a.red} /> : <Checked size={20} weight="fill" color={a.green} />}</View> : null}
                hint={mode === "join" && handle ? (taken.handle ? t("Già in uso") : !handleOk ? t("3–30 lettere, numeri, . o _") : t("Disponibile")) : ""}
              />
            ) : null}
            {mode !== "forgot" ? (
              <AuthField
                a={a}
                label={t("Password")}
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
            {mode === "join" && password ? (
              <View style={styles.strength} accessibilityLabel={t("Robustezza password")}>
                <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
                  {[1, 2, 3, 4].map((i) => <View key={i} style={[styles.bar, { backgroundColor: strength >= i ? strengthColors[strength] : a.line }]} />)}
                </View>
                <T size={12} weight="600" color={a.sub} style={{ minWidth: 64, textAlign: "right" }}>{[t("Troppo corta"), t("Debole"), t("Discreta"), t("Buona"), t("Forte")][strength]}</T>
              </View>
            ) : null}
            {mode === "join" ? (
              <AuthField
                a={a}
                label={t("Ripeti password")}
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
            {mode !== "forgot" ? <Pressable disabled={!ready} onPress={submit} style={({ pressed }) => [styles.go, { backgroundColor: pressed && ready ? "#1877f2" : a.blue, opacity: ready ? 1 : 0.45 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <T size={15.5} weight="700" color="#fff">{cta}</T>}
            </Pressable> : null}
            {mode === "login" ? (
              <Pressable onPress={() => go("forgot")} style={styles.link}>
                <T size={14.5} weight="600" color={a.text}>{t("Password dimenticata?")}</T>
              </Pressable>
            ) : null}
            {mode === "join" ? <T size={12.5} color={a.sub} style={{ textAlign: "center", marginTop: 6, lineHeight: 18 }}>{t("Iscrivendoti accetti i Termini e l'Informativa sulla privacy.")}</T> : null}
          </Animated.View>
          {mode === "login" && !handle && (picked || others.length) ? (
            <View style={styles.switch}>
              {others.map((user) => (
                <Pressable key={user.handle} onPress={() => choose(user.handle)} style={({ pressed }) => [styles.chip, { borderColor: a.line, opacity: pressed ? 0.6 : 1 }]}>
                  <Face user={user} size={36} a={a} style={styles.chipFace} />
                  <T size={14} weight="600" color={a.text}>{user.handle}</T>
                </Pressable>
              ))}
              {picked ? (
                <Pressable onPress={() => choose(null)} style={styles.link}>
                  <T size={14.5} weight="600" color={a.blue}>{t("Usa un altro account")}</T>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: Math.max(22, insets.bottom + 6) }]}>
        <Pressable onPress={() => go(mode === "login" ? "join" : "login")} style={({ pressed }) => [styles.outline, { borderColor: a.blue, backgroundColor: pressed ? "rgba(0,149,246,0.08)" : "transparent" }]}>
          <T size={15} weight="700" color={a.blue}>{mode === "login" ? t("Crea nuovo account") : t("Ho già un account")}</T>
        </Pressable>
        <T size={17} weight="700" color={a.sub} style={{ letterSpacing: -0.9 }}>iywa</T>
      </View>
    </KeyboardAvoidingView>
  );
}

// A saved account's face, or its initial on a soft circle when it has no photo yet.
function Face({ user, size, a, style }) {
  if (user?.avatar) return <Image source={{ uri: user.avatar }} style={style} />;
  return (
    <View style={[style, { width: size, height: size, borderRadius: size / 2, backgroundColor: a.line, alignItems: "center", justifyContent: "center" }]}>
      <T size={size * 0.42} weight="700" color={a.sub}>{String(user?.name || user?.handle || "?").slice(0, 1).toUpperCase()}</T>
    </View>
  );
}

// Covers the app until someone signs in.
export function AuthGate() {
  const session = useSession();
  const theme = useTheme();
  if (session.status === "loading") return <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, zIndex: 100 }]} />;
  if (session.status === "in") return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <AuthScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, height: 48 },
  lang: { paddingVertical: 12 },
  back: { position: "absolute", left: 8, top: 6, flexDirection: "row", alignItems: "center", gap: 2, height: 36, minWidth: 36, paddingRight: 6 },
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingBottom: 12 },
  bodyTop: { justifyContent: "flex-start", paddingTop: 20 },
  word: { alignSelf: "center", marginBottom: 40, letterSpacing: -3.4, lineHeight: 64 },
  who: { alignItems: "center", gap: 3, marginBottom: 28 },
  whoFace: { width: 96, height: 96, borderRadius: 48, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  head: { marginBottom: 24 },
  sub: { marginTop: 8, lineHeight: 21 },
  note: { width: "100%", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(52,199,89,0.14)" },
  field: { height: 56, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 6 },
  label: { position: "absolute", left: 16, fontSize: 16 },
  input: { flex: 1, height: "100%", paddingTop: 18, paddingBottom: 2, paddingHorizontal: 16, fontSize: 16 },
  hint: { position: "absolute", right: 48, top: 8 },
  trail: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  strength: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -2, marginHorizontal: 4, marginBottom: 2 },
  bar: { flex: 1, height: 4, borderRadius: 99 },
  error: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  go: { height: 48, marginTop: 6, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  link: { alignSelf: "center", marginTop: 8, padding: 8 },
  switch: { alignItems: "center", gap: 10, marginTop: 22 },
  chip: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingLeft: 6, paddingRight: 18, borderRadius: 99, borderWidth: 1 },
  chipFace: { width: 36, height: 36, borderRadius: 18 },
  foot: { alignItems: "center", gap: 12, paddingTop: 10, paddingHorizontal: 20 },
  outline: { width: "100%", height: 48, borderRadius: 99, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
