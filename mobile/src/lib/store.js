import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { applyDirection, resolveLanguage, setLanguage, t } from "./i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { relinkMedia } from "./media-store";
import { BUSINESS } from "../data";
import { signOut, switchAccount, updateMe, useSession } from "./session";
import { uploadMedia } from "./api";

// Same preferences as the web app's settings, kept on the phone.
export const DEFAULT_PREFS = {
  appearance: "auto",
  // Accent colour id from ACCENTS in theme.js; "default" is the original blue.
  accent: "default",
  language: "auto",
  private: false,
  activity: true,
  readReceipts: true,
  messages: "everyone",
  storyReplies: "everyone",
  comments: "everyone",
  tags: "everyone",
  mentions: "everyone",
  sensitive: "standard",
  likeCounts: true,
  suggested: true,
  dataSaver: false,
  captions: false,
  altText: true,
  timeLimit: "off",
  searchesCleared: false,
  hiddenWords: ["spam"],
  blocked: [],
  muted: [],
  closeFriends: [],
  restricted: [],
  notes: { likes: true, comments: true, follows: true, messages: true, mentions: true },
};

// v2: real accounts; everything saved by the demo builds is dropped.
const KEY = "iywa-mobile-v2";

const INITIAL = {
  follows: [],
  likes: [],
  saves: [],
  // A copy of each saved item (by id), so own posts, thoughts and reels still show in Salvati.
  savedItems: {},
  storyLikes: [],
  seenStories: [],
  myStories: [],
  hiddenStories: [],
  highlights: [],
  thoughtLikes: [],
  reposts: [],
  myThoughts: [],
  votes: {},
  cart: [],
  wishlist: [],
  recentProducts: [],
  reviews: {},
  myProducts: [],
  chats: [],
  // Messages: per-chat flags (muted, pinned, archivedAt, hiddenAt, wall, pin) and chat folders (null = defaults).
  dmFlags: {},
  dmFolders: null,
  readNotes: false,
  orders: [],
  prefs: DEFAULT_PREFS,
  // Home feed: posts I published (newest first), comments I wrote per post id,
  // archived post ids, liked comment keys, and live notifications (newest first).
  library: [],
  postComments: {},
  archived: [],
  commentLikes: [],
  notifications: [],
  // Search, profiles, Pensieri and sign-in: recent searches, replies and threads added to
  // thoughts, when each repost happened, pinned grid posts, and the accounts on this phone.
  recentSearches: [],
  thoughtReplies: {},
  repostAt: {},
  pinned: [],
};

const Store = createContext(null);

setLanguage(resolveLanguage("auto"));

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

export function StoreProvider({ children }) {
  const [state, setState] = useState(INITIAL);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(relinkMedia(raw));
        setState((prev) => ({
          ...prev,
          ...saved,
          prefs: { ...DEFAULT_PREFS, ...(saved.prefs || {}), notes: { ...DEFAULT_PREFS.notes, ...(saved.prefs?.notes || {}) } },
        }));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}), 250);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready]);

  const api = useMemo(() => {
    const set = (fn) => setState((prev) => ({ ...prev, ...fn(prev) }));
    return {
      toggleFollow: (name) => set((s) => ({ follows: toggle(s.follows, name) })),
      toggleLike: (id) => set((s) => ({ likes: toggle(s.likes, id) })),
      // `item` is optional: without it the item is looked up in my posts, thoughts and the seed lists.
      toggleSave: (id, item) => set((s) => {
        const items = { ...(s.savedItems || {}) };
        if (s.saves.includes(id)) {
          delete items[id];
          return { saves: s.saves.filter((value) => value !== id), savedItems: items };
        }
        const snap = savedSnapshot(item ? { ...item, id } : resolveSaved(s, id));
        if (snap) items[id] = snap;
        return { saves: [...s.saves, id], savedItems: items };
      }),
      toggleStoryLike: (id) => set((s) => ({ storyLikes: toggle(s.storyLikes, id) })),
      markStorySeen: (id) => set((s) => (s.seenStories.includes(id) ? {} : { seenStories: [...s.seenStories, id] })),
      toggleThoughtLike: (id) => set((s) => ({ thoughtLikes: toggle(s.thoughtLikes, id) })),
      toggleRepost: (id) => set((s) => ({ reposts: toggle(s.reposts, id) })),
      vote: (id, index) => set((s) => (s.votes[id] != null ? {} : { votes: { ...s.votes, [id]: index } })),
      addThought: (thought) => set((s) => ({ myThoughts: [thought, ...s.myThoughts] })),
      addToCart: (ref, qty = 1, variant = "") => set((s) => {
        const at = s.cart.findIndex((item) => item.key === ref.key && item.variant === variant);
        if (at >= 0) return { cart: s.cart.map((item, index) => (index === at ? { ...item, qty: Math.min(20, item.qty + qty) } : item)) };
        return { cart: [...s.cart, { ...ref, variant, qty }] };
      }),
      setCartQty: (key, variant, qty) => set((s) => ({ cart: qty <= 0 ? s.cart.filter((item) => !(item.key === key && item.variant === variant)) : s.cart.map((item) => (item.key === key && item.variant === variant ? { ...item, qty } : item)) })),
      clearCartFor: (seller) => set((s) => ({ cart: s.cart.filter((item) => item.seller !== seller) })),
      toggleWish: (ref) => set((s) => ({ wishlist: s.wishlist.some((item) => item.key === ref.key) ? s.wishlist.filter((item) => item.key !== ref.key) : [{ ...ref, at: Date.now() }, ...s.wishlist] })),
      viewProduct: (ref) => set((s) => ({ recentProducts: [ref, ...s.recentProducts.filter((item) => item.key !== ref.key)].slice(0, 12) })),
      addReview: (key, review) => set((s) => ({ reviews: { ...s.reviews, [key]: [{ ...review, at: Date.now() }, ...(s.reviews[key] || [])] } })),
      sendMessage: (chatId, message) => set((s) => ({
        chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false, preview: message.text || t("Foto"), time: t("ora"), at: Date.now(), messages: [...chat.messages, { from: "me", time: clock(), ...message }] } : chat)),
      })),
      receiveMessage: (chatId, text) => set((s) => ({
        chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: true, preview: text, time: t("ora"), at: Date.now(), messages: [...chat.messages, { from: "them", text, time: clock() }] } : chat)),
      })),
      readChat: (chatId) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false } : chat)) })),
      ensureChat: (person) => {
        const found = stateRef.current.chats.find((chat) => chat.name === person.name);
        if (found) return found.id;
        const id = `c-${Date.now()}`;
        const chat = { id, name: person.name, src: person.src, kind: "", preview: "", time: t("ora"), at: Date.now(), messages: [] };
        stateRef.current = { ...stateRef.current, chats: [chat, ...stateRef.current.chats] };
        setState((prev) => (prev.chats.some((item) => item.id === id) ? prev : { ...prev, chats: [chat, ...prev.chats] }));
        return id;
      },
      markNotesRead: () => set(() => ({ readNotes: true })),
      // Messages (demo threads are addressed by message position, like the web app)
      addChatMessage: (chatId, message) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false, time: t("ora"), at: Date.now(), messages: [...(chat.messages || []), { from: "me", time: clock(), ...message }] } : chat)) })),
      receiveChatMessage: (chatId, text, read) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: !read, preview: text, time: t("ora"), at: Date.now(), messages: [...(chat.messages || []), { from: "them", kind: "text", text, time: clock() }] } : chat)) })),
      reactChatMessage: (chatId, index, emoji) => set((s) => ({ chats: s.chats.map((chat) => (chat.id !== chatId ? chat : { ...chat, messages: chat.messages.map((m, at) => { if (at !== index) return m; const reactions = { ...(m.reactions || {}) }; if (emoji) reactions.me = emoji; else delete reactions.me; return { ...m, reactions: Object.keys(reactions).length ? reactions : undefined }; }) })) })),
      editChatMessage: (chatId, index, text) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, messages: chat.messages.map((m, at) => (at === index ? { ...m, orig: m.orig ?? m.text, text, edited: Date.now() } : m)) } : chat)) })),
      unsendChatMessage: (chatId, index) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, messages: chat.messages.map((m, at) => (at === index ? { ...m, unsent: true, reactions: undefined } : m)) } : chat)) })),
      updateChat: (chatId, patch) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat)) })),
      deleteChat: (chatId) => set((s) => ({ chats: s.chats.filter((chat) => chat.id !== chatId) })),
      markChatUnread: (chatId) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: true } : chat)) })),
      addChat: (thread) => set((s) => ({ chats: [thread, ...s.chats.filter((chat) => chat.id !== thread.id)] })),
      setDmFlag: (id, key, value) => set((s) => ({ dmFlags: { ...(s.dmFlags || {}), [id]: { ...((s.dmFlags || {})[id] || {}), [key]: value } } })),
      setDmFlags: (ids, key, value) => set((s) => { const flags = { ...(s.dmFlags || {}) }; for (const id of ids) flags[id] = { ...(flags[id] || {}), [key]: value }; return { dmFlags: flags }; }),
      setDmFolders: (list) => set(() => ({ dmFolders: list })),
      // Home feed
      publish: (item) => set((s) => ({ library: [item, ...(s.library || [])] })),
      dropPost: (id) => set((s) => ({ library: (s.library || []).filter((item) => item.id !== id) })),
      toggleArchive: (id) => set((s) => ({ archived: toggle(s.archived || [], id) })),
      addComment: (id, text) => set((s) => ({ postComments: { ...(s.postComments || {}), [id]: [...((s.postComments || {})[id] || []), text] } })),
      toggleCommentLike: (key) => set((s) => ({ commentLikes: toggle(s.commentLikes || [], key) })),
      pushNote: (entry) => set((s) => ({ notifications: [{ id: `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), read: false, ...entry }, ...(s.notifications || [])].slice(0, 80) })),
      markNotificationsRead: () => set((s) => ({ readNotes: true, notifications: (s.notifications || []).map((note) => (note.read ? note : { ...note, read: true })) })),
      // Profile, account type and business details live on the server (my account).
      setAccountType: (accountType) => updateMe({ kind: accountType === "business" ? "business" : "personal" }).catch(() => {}),
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch, notes: { ...s.prefs.notes, ...(patch.notes || {}) } } })),
      setProfile: async (patch) => {
        const body = {};
        if (patch.name != null) body.name = patch.name;
        if (patch.bio != null) body.bio = patch.bio;
        if (patch.website != null || patch.link != null) body.website = patch.website ?? patch.link;
        if (patch.handle != null) body.handle = String(patch.handle).replace(/^@/, "");
        if (patch.src != null) body.avatar = patch.src ? await uploadMedia(patch.src) : "";
        return updateMe(body);
      },
      setBusiness: (patch) => updateMe({ business: { ...(stateRef.current.business || {}), ...patch } }),
      addStory: (frame) => set((s) => ({ myStories: [...(s.myStories || []), frame] })),
      deleteStory: (id) => set((s) => ({ myStories: (s.myStories || []).filter((item) => item.id !== id), hiddenStories: [...(s.hiddenStories || []), id] })),
      addHighlight: (item) => set((s) => ({ highlights: [item, ...(s.highlights || [])] })),
      deleteHighlight: (id) => set((s) => ({ highlights: (s.highlights || []).filter((item) => item.id !== id) })),
      reset: () => setState(INITIAL),
      rememberSearch: (entry) => set((s) => ({ recentSearches: [entry, ...(s.recentSearches || []).filter((item) => item.key !== entry.key)].slice(0, 12) })),
      forgetSearch: (key) => set((s) => ({ recentSearches: key ? (s.recentSearches || []).filter((item) => item.key !== key) : [] })),
      addThoughtChain: (thought, chain = []) => set((s) => ({ myThoughts: [thought, ...s.myThoughts], thoughtReplies: chain.length ? { ...(s.thoughtReplies || {}), [thought.id]: chain } : s.thoughtReplies || {} })),
      addThoughtReply: (parentId, reply) => set((s) => ({ thoughtReplies: { ...(s.thoughtReplies || {}), [parentId]: [...((s.thoughtReplies || {})[parentId] || []), reply] } })),
      deleteThought: (id) => set((s) => {
        const replies = { ...(s.thoughtReplies || {}) };
        delete replies[id];
        for (const key of Object.keys(replies)) replies[key] = replies[key].filter((item) => item.id !== id);
        return { myThoughts: s.myThoughts.filter((item) => item.id !== id), thoughtReplies: replies, reposts: s.reposts.filter((item) => item !== id) };
      }),
      toggleThoughtRepost: (id) => set((s) => ({ reposts: toggle(s.reposts, id), repostAt: { ...(s.repostAt || {}), [id]: Date.now() } })),
      togglePin: (id) => set((s) => ({ pinned: toggle(s.pinned || [], id) })),
      saveProduct: (product) => set((s) => ({ myProducts: s.myProducts.some((item) => item.id === product.id) ? s.myProducts.map((item) => (item.id === product.id ? product : item)) : [product, ...s.myProducts] })),
      deleteProduct: (id) => set((s) => ({ myProducts: s.myProducts.filter((item) => item.id !== id) })),
      // Accounts: see lib/session.js. "Aggiungi account" opens the /auth screen.
      signIn: (handle) => switchAccount(handle),
      logout: () => signOut(),
    };
  }, []);

  // Strings are looked up while rendering, so switch the dictionary before children render.
  const language = resolveLanguage(state.prefs?.language);
  setLanguage(language);
  useEffect(() => { if (ready) applyDirection(language); }, [ready, language]);
  // My profile comes from the server session, in the shape the screens have always read.
  const session = useSession();
  const me = session.me;
  const derived = useMemo(() => ({
    profile: me
      ? { name: me.name, handle: `@${me.handle}`, bio: me.bio || "", src: me.avatar || "", website: me.website || "", followers: me.followers || 0, following: me.following || 0, posts: me.posts || 0, private: Boolean(me.private), verified: Boolean(me.verified), email: me.email }
      : { name: "", handle: "", bio: "", src: "", followers: 0, following: 0, posts: 0 },
    accountType: me?.kind === "business" ? "business" : "personal",
    business: { ...BUSINESS, ...(me?.business || {}) },
    auth: { handle: me?.handle || null, users: session.accounts || [] },
  }), [me, session.accounts]);
  stateRef.current = { ...state, ...derived };
  const value = useMemo(() => ({ ...state, ...derived, ready: ready && session.status !== "loading", language, ...api }), [state, derived, ready, session.status, language, api]);
  return createElement(Store.Provider, { value }, children);
}

export function useStore() {
  const value = useContext(Store);
  if (!value) throw new Error("StoreProvider missing");
  return value;
}

// Light or dark as chosen in Settings; null follows the phone.
export function useAppearance() {
  const value = useContext(Store);
  const choice = value?.prefs?.appearance;
  return choice === "light" || choice === "dark" ? choice : null;
}

// Finds a saved id in my posts, my thoughts and every seed list.
export function resolveSaved(state, id) {
  const key = String(id ?? "");
  if (!key) return null;
  const mine = (state?.library || []).find((item) => item.id === key);
  if (mine) return { ...mine, kind: mine.kind || mine.type || "post", mine: true };
  const thought = (state?.myThoughts || []).find((item) => item.id === key);
  if (thought) return { ...thought, kind: "thought", mine: true };
  return null;
}

// The small, persistable copy kept in savedItems.
function savedSnapshot(item) {
  if (!item) return null;
  const isPic = (uri) => typeof uri === "string" && !/\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
  const clip = (item.clips || []).find((entry) => entry?.type === "image")?.src;
  const pics = [item.image, item.images?.[0], item.poster, clip, item.kind === "reel" ? item.src : null, item.kind === "reel" ? item.avatar : null];
  const image = pics.find(isPic) || null;
  const kind = item.kind || item.type || "post";
  return {
    id: String(item.id),
    kind: kind === "tweet" ? "tweet" : kind,
    reelId: item.reelId || (kind === "reel" ? String(item.id).replace(/^reel-/, "") : undefined),
    image,
    text: String(item.text || item.caption || "").slice(0, 280),
    name: item.name || "",
    mine: Boolean(item.mine),
    at: Date.now(),
  };
}

export { savedSnapshot };

// Accent colour id chosen in Settings → Aspetto.
export function useAccentChoice() {
  return useContext(Store)?.prefs?.accent || "default";
}

export function chatIdFor() {
  return null;
}

function clock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export const ALL_THOUGHTS = [];
export const ALL_NOTIFICATIONS = [];

// ---------------------------------------------------------------------------
// Time spent: foreground milliseconds per local day, kept in its own small store so the
// ticking counter never re-renders the whole app. `dismissed` remembers the limit wall
// closed today ({ day, cap }), so "Continua" lasts until tomorrow or until the limit changes.
// ---------------------------------------------------------------------------
const USAGE_KEY = "iywa-usage-v1";
let usage = { days: {}, dismissed: null };
let usageReady = false;
const usageSubs = new Set();

function emitUsage(next) {
  usage = next;
  usageSubs.forEach((fn) => fn());
  if (usageReady) AsyncStorage.setItem(USAGE_KEY, JSON.stringify(usage)).catch(() => {});
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

AsyncStorage.getItem(USAGE_KEY)
  .then((raw) => {
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved) return;
    const days = { ...(saved.days || {}) };
    // Keep anything counted before the saved copy arrived.
    for (const [day, ms] of Object.entries(usage.days)) days[day] = (days[day] || 0) + ms;
    usage = { days, dismissed: saved.dismissed || usage.dismissed };
    usageSubs.forEach((fn) => fn());
  })
  .catch(() => {})
  .finally(() => { usageReady = true; });

export function addUsage(ms) {
  if (!(ms > 0)) return;
  const today = dayKey();
  const days = { ...usage.days, [today]: (usage.days[today] || 0) + ms };
  // Two weeks is all the charts need.
  const keep = Object.keys(days).sort().slice(-14);
  emitUsage({ ...usage, days: Object.fromEntries(keep.map((day) => [day, days[day]])) });
}

export function dismissLimit(cap) {
  emitUsage({ ...usage, dismissed: { day: dayKey(), cap: String(cap) } });
}

export function useUsage() {
  return useSyncExternalStore((fn) => { usageSubs.add(fn); return () => usageSubs.delete(fn); }, () => usage);
}

// Minutes for the last `count` days, oldest first, ending today: [{ day, weekday, minutes }].
export function usageWeek(snapshot, count = 7) {
  const out = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - back);
    const day = dayKey(date);
    out.push({ day, weekday: date.getDay(), minutes: Math.floor((snapshot.days[day] || 0) / 60000) });
  }
  return out;
}
