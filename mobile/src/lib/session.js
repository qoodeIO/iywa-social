// The signed-in account: token + my profile from the server, kept on the phone so the app
// opens signed in. Also remembers the accounts used on this phone (for the account switcher),
// each with its own token.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, onApiUnauthorized, setApiToken } from "./api";

const KEY = "iywa-session-v1";

let state = { status: "loading", token: null, me: null, accounts: [] };
const listeners = new Set();

function emit(next) {
  state = { ...state, ...next };
  setApiToken(state.token);
  for (const fn of listeners) fn();
  AsyncStorage.setItem(KEY, JSON.stringify({ token: state.token, me: state.me, accounts: state.accounts })).catch(() => {});
}

function remember(token, me) {
  const card = { handle: me.handle, name: me.name, avatar: me.avatar, token };
  return [card, ...state.accounts.filter((item) => item.handle !== me.handle)].slice(0, 5);
}

export async function loadSession() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    state = { ...state, token: saved?.token || null, me: saved?.me || null, accounts: saved?.accounts || [] };
    setApiToken(state.token);
  } catch {
    // start signed out
  }
  emit({ status: state.token && state.me ? "in" : "out" });
  if (state.token) refreshMe().catch(() => {});
}

export async function refreshMe() {
  const data = await api("/me");
  emit({ me: data.me, accounts: remember(state.token, data.me) });
  return data.me;
}

export async function signUp({ name, handle, email, password }) {
  const data = await api("/auth/signup", { method: "POST", body: { name, handle, email, password } });
  emit({ status: "in", token: data.token, me: data.me, accounts: remember(data.token, data.me) });
  return data.me;
}

export async function signIn(login, password) {
  const data = await api("/auth/login", { method: "POST", body: { login, password } });
  emit({ status: "in", token: data.token, me: data.me, accounts: remember(data.token, data.me) });
  return data.me;
}

// Switches to another account saved on this phone (its token may have expired: then sign in).
export async function switchAccount(handle) {
  const saved = state.accounts.find((item) => item.handle === handle);
  if (!saved) return false;
  setApiToken(saved.token);
  try {
    const data = await api("/me");
    emit({ status: "in", token: saved.token, me: data.me, accounts: remember(saved.token, data.me) });
    return true;
  } catch {
    setApiToken(state.token);
    return false;
  }
}

export async function signOut({ forget = false } = {}) {
  const handle = state.me?.handle;
  try { await api("/auth/logout", { method: "POST" }); } catch { /* offline: drop it locally anyway */ }
  const accounts = state.accounts.filter((item) => item.handle !== handle || !forget).map((item) => (item.handle === handle ? { ...item, token: null } : item));
  emit({ status: "out", token: null, me: null, accounts });
}

export async function updateMe(patch) {
  const data = await api("/me", { method: "PATCH", body: patch });
  emit({ me: data.me, accounts: remember(state.token, data.me) });
  return data.me;
}

export async function changePassword(current, next) {
  await api("/me/password", { method: "POST", body: { current, next } });
}

export async function changeEmail(email) {
  const data = await api("/me/email", { method: "POST", body: { email } });
  emit({ me: data.me });
}

export async function deleteAccount(password) {
  await api(`/me?password=${encodeURIComponent(password)}`, { method: "DELETE" });
  const handle = state.me?.handle;
  emit({ status: "out", token: null, me: null, accounts: state.accounts.filter((item) => item.handle !== handle) });
}

// Locally bump my profile (e.g. post count) without a round trip.
export function patchMe(patch) {
  if (!state.me) return;
  emit({ me: { ...state.me, ...(typeof patch === "function" ? patch(state.me) : patch) } });
}

onApiUnauthorized(() => {
  if (state.status === "in") emit({ status: "out", token: null, me: null });
});

export function getSession() {
  return state;
}

export function onSessionChange(fn) {
  return subscribe(fn);
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => state);
}

// My profile, or null while signed out.
export function useMe() {
  return useSession().me;
}

export function myHandle() {
  return state.me?.handle || null;
}
