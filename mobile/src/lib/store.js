import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { relinkMedia } from "./media-store";
import { BUSINESS, CHATS, MY_PRODUCTS, NOTIFICATIONS, PROFILE, THOUGHTS } from "../data";

// Same preferences as the web app's settings, kept on the phone.
export const DEFAULT_PREFS = {
  appearance: "auto",
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
  closeFriends: ["Marta Colle", "Leo Bassi"],
  restricted: [],
  notes: { likes: true, comments: true, follows: true, messages: true, mentions: true },
};

const KEY = "space-mobile-v1";

const INITIAL = {
  profile: PROFILE,
  accountType: "business",
  follows: ["Leo Bassi", "Adele Romano", "Marta Colle"],
  likes: [],
  saves: [],
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
  myProducts: MY_PRODUCTS,
  chats: CHATS,
  // Messages: per-chat flags (muted, pinned, archivedAt, hiddenAt, wall, pin) and chat folders (null = defaults).
  dmFlags: {},
  dmFolders: null,
  readNotes: false,
  orders: [],
  prefs: DEFAULT_PREFS,
  business: BUSINESS,
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
  auth: { users: [{ name: "Giulia Neri", handle: "forno.neri", password: "forno" }], handle: null, previous: null },
};

const Store = createContext(null);

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
          business: { ...BUSINESS, ...(saved.business || {}) },
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
      toggleSave: (id) => set((s) => ({ saves: toggle(s.saves, id) })),
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
        chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false, preview: message.text || "Foto", time: "ora", at: Date.now(), messages: [...chat.messages, { from: "me", time: clock(), ...message }] } : chat)),
      })),
      receiveMessage: (chatId, text) => set((s) => ({
        chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: true, preview: text, time: "ora", at: Date.now(), messages: [...chat.messages, { from: "them", text, time: clock() }] } : chat)),
      })),
      readChat: (chatId) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false } : chat)) })),
      ensureChat: (person) => {
        const found = stateRef.current.chats.find((chat) => chat.name === person.name);
        if (found) return found.id;
        const id = `c-${Date.now()}`;
        const chat = { id, name: person.name, src: person.src, kind: "", preview: "", time: "ora", at: Date.now(), messages: [] };
        stateRef.current = { ...stateRef.current, chats: [chat, ...stateRef.current.chats] };
        setState((prev) => (prev.chats.some((item) => item.id === id) ? prev : { ...prev, chats: [chat, ...prev.chats] }));
        return id;
      },
      markNotesRead: () => set(() => ({ readNotes: true })),
      // Messages (demo threads are addressed by message position, like the web app)
      addChatMessage: (chatId, message) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: false, time: "ora", at: Date.now(), messages: [...(chat.messages || []), { from: "me", time: clock(), ...message }] } : chat)) })),
      receiveChatMessage: (chatId, text, read) => set((s) => ({ chats: s.chats.map((chat) => (chat.id === chatId ? { ...chat, unread: !read, preview: text, time: "ora", at: Date.now(), messages: [...(chat.messages || []), { from: "them", kind: "text", text, time: clock() }] } : chat)) })),
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
      setAccountType: (accountType) => set(() => ({ accountType })),
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch, notes: { ...s.prefs.notes, ...(patch.notes || {}) } } })),
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setBusiness: (patch) => set((s) => ({ business: { ...s.business, ...patch } })),
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
      signIn: (handle) => set((s) => ({ auth: { ...s.auth, handle, previous: null } })),
      joinAccount: (user) => set((s) => ({ auth: { users: [...s.auth.users, user], handle: user.handle, previous: null } })),
      resetPassword: (handle, password) => set((s) => ({ auth: { ...s.auth, users: s.auth.users.map((user) => (user.handle === handle ? { ...user, password } : user)) } })),
      logout: () => set((s) => ({ auth: { ...s.auth, handle: null, previous: null } })),
      addAccount: () => set((s) => ({ auth: { ...s.auth, handle: null, previous: s.auth.handle } })),
    };
  }, []);

  const value = useMemo(() => ({ ...state, ready, ...api }), [state, ready, api]);
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

export function chatIdFor(store, person) {
  return store.chats.find((chat) => chat.name === person.name)?.id || null;
}

function clock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export const ALL_THOUGHTS = THOUGHTS;
export const ALL_NOTIFICATIONS = NOTIFICATIONS;
