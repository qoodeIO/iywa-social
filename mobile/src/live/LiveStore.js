// Live state for chats, groups, presence and calls (React context), ported from
// src/live/LiveStore.jsx: optimistic sends with a clientId replaced by the server
// copy, failed after 15 s with retry, typing with expiry, reads only while the chat
// is on screen. Also hosts the offline "demo" side of the web app: demo contacts
// answer locally, and calls to them are logged in the local thread (LiveBridge).

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { createHub } from "./hub";
import { CallController } from "./calls";
import { sounds } from "./sounds";
import { useStore } from "../lib/store";
import { emitOrderEvent, payApi, payHandle } from "../lib/pay";
import { t } from "../lib/i18n";
import { avatarFor, euro } from "../data";

const Live = createContext(null);

export function useLive() {
  return useContext(Live);
}

const TYPING_EVERY = 2500;
const TYPING_SHOW = 6000;
const SEND_TIMEOUT = 15_000;

let sequence = 0;
const clientId = () => `${Date.now().toString(36)}${(sequence++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const initial = { status: "idle", me: null, people: {}, convs: {}, typing: {}, toast: null };

function sortMessages(list) {
  return list.sort((a, b) => (a.created || Number.MAX_SAFE_INTEGER) - (b.created || Number.MAX_SAFE_INTEGER));
}

function mergeMessages(current = [], incoming = []) {
  const byId = new Map();
  const pending = [];
  for (const message of current) {
    if (message.id) byId.set(message.id, message);
    else pending.push(message);
  }
  for (const message of incoming) byId.set(message.id, message);
  const confirmed = new Set([...byId.values()].map((message) => message.clientId).filter(Boolean));
  return sortMessages([...byId.values(), ...pending.filter((message) => !confirmed.has(message.clientId))]);
}

function upsertConv(state, conv) {
  const existing = state.convs[conv.id];
  const messages = mergeMessages(existing?.messages, conv.messages || []);
  return {
    ...state.convs,
    [conv.id]: { ...existing, ...conv, messages, hasMore: existing?.messages?.length > (conv.messages || []).length ? existing.hasMore : conv.hasMore },
  };
}

function patchConv(state, convId, fn) {
  const conv = state.convs[convId];
  if (!conv) return state;
  return { ...state, convs: { ...state.convs, [convId]: { ...conv, ...fn(conv) } } };
}

function reducer(state, action) {
  switch (action.type) {
    case "status":
      return { ...state, status: action.status };
    case "reset":
      return initial;
    case "ready": {
      const people = {};
      for (const person of action.people) people[person.handle] = person;
      const convs = {};
      for (const conv of action.convs) {
        const old = state.convs[conv.id];
        convs[conv.id] = { ...old, ...conv, messages: mergeMessages(old?.messages, conv.messages), hasMore: conv.hasMore, loading: false };
      }
      return { ...state, me: action.me, people, convs };
    }
    case "presence": {
      const person = action.person;
      const convs = {};
      for (const [id, conv] of Object.entries(state.convs)) {
        convs[id] = conv.members.some((member) => member.handle === person.handle)
          ? { ...conv, members: conv.members.map((member) => (member.handle === person.handle ? { ...member, ...person, readAt: member.readAt } : member)) }
          : conv;
      }
      return { ...state, people: { ...state.people, [person.handle]: person }, convs, me: state.me?.handle === person.handle ? person : state.me };
    }
    case "conv":
      return { ...state, convs: upsertConv(state, action.conv) };
    case "conv_removed": {
      const convs = { ...state.convs };
      delete convs[action.convId];
      return { ...state, convs };
    }
    case "pending":
      return patchConv(state, action.convId, (conv) => ({ messages: [...conv.messages.filter((m) => m.clientId !== action.message.clientId), action.message] }));
    case "failed":
      return patchConv(state, action.convId, (conv) => ({ messages: conv.messages.map((m) => (!m.id && m.clientId === action.clientId ? { ...m, status: "failed" } : m)) }));
    case "discard":
      return patchConv(state, action.convId, (conv) => ({ messages: conv.messages.filter((m) => m.id || m.clientId !== action.clientId) }));
    case "message": {
      const message = action.message;
      const conv = state.convs[message.convId];
      if (!conv) return state;
      const known = conv.messages.some((item) => item.id === message.id);
      const fromOther = message.from !== state.me?.handle && message.from !== "system";
      const typing = { ...state.typing };
      if (typing[conv.id]?.[message.from]) {
        typing[conv.id] = { ...typing[conv.id] };
        delete typing[conv.id][message.from];
      }
      return {
        ...state,
        typing,
        convs: {
          ...state.convs,
          [conv.id]: {
            ...conv,
            messages: mergeMessages(conv.messages, [message]),
            updatedAt: Math.max(conv.updatedAt || 0, message.created),
            unread: !known && fromOther && !action.viewing ? (conv.unread || 0) + 1 : conv.unread,
            lastReadAt: message.from === state.me?.handle ? message.created : conv.lastReadAt,
          },
        },
      };
    }
    case "page":
      return patchConv(state, action.convId, (conv) => ({ messages: mergeMessages(conv.messages, action.messages), hasMore: action.hasMore, loading: false }));
    case "loading":
      return patchConv(state, action.convId, () => ({ loading: true }));
    case "read": {
      const mine = action.handle === state.me?.handle;
      return patchConv(state, action.convId, (conv) => ({
        unread: mine ? 0 : conv.unread,
        lastReadAt: mine ? Math.max(conv.lastReadAt || 0, action.at) : conv.lastReadAt,
        members: conv.members.map((member) => (member.handle === action.handle ? { ...member, readAt: action.at } : member)),
      }));
    }
    case "reaction":
      return patchConv(state, action.convId, (conv) => ({ messages: conv.messages.map((m) => (m.id === action.messageId ? { ...m, reactions: action.reactions } : m)) }));
    case "edited":
      return patchConv(state, action.message.convId, (conv) => ({ messages: conv.messages.map((m) => (m.id === action.message.id ? { ...m, ...action.message } : m)) }));
    case "pinned":
      return patchConv(state, action.convId, () => ({ pinned: action.message }));
    case "unsent":
      return patchConv(state, action.convId, (conv) => ({ messages: conv.messages.filter((m) => m.id !== action.messageId) }));
    case "typing": {
      const now = Date.now();
      return { ...state, typing: { ...state.typing, [action.convId]: { ...(state.typing[action.convId] || {}), [action.handle]: now + TYPING_SHOW } } };
    }
    case "prune": {
      const now = Date.now();
      let changed = false;
      const typing = {};
      for (const [convId, map] of Object.entries(state.typing)) {
        const kept = Object.fromEntries(Object.entries(map).filter(([, until]) => until > now));
        if (Object.keys(kept).length !== Object.keys(map).length) changed = true;
        if (Object.keys(kept).length) typing[convId] = kept;
      }
      return changed ? { ...state, typing } : state;
    }
    case "toast":
      return { ...state, toast: action.toast };
    default:
      return state;
  }
}

const DEMO_REPLIES = {
  image: ["Che bello! 😍", "Wow, si vede benissimo il lavoro.", "Mandamene altre 📸"],
  audio: ["Ascoltato! Ti rispondo dal laboratorio 🎧", "Perfetto, ci sentiamo dopo."],
  question: ["Sì, certo! Passa quando vuoi.", "Domani mattina va benissimo.", "Credo di sì, ti confermo stasera."],
  text: ["Perfetto 🙌", "Ahah sì!", "Grazie! ❤️", "Ci vediamo in laboratorio.", "Ottimo, allora siamo d'accordo."],
};

export function LiveProvider({ children }) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const prefs = store.prefs;
  const handle = String(store.profile?.handle || "").replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const user = useMemo(() => (handle ? { handle, name: store.profile?.name || handle, src: store.profile?.src || "" } : null), [handle, store.profile?.name, store.profile?.src]);
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const hubRef = useRef(null);
  const waiters = useRef(new Map());
  const timers = useRef(new Map());
  const typedAt = useRef(new Map());
  const viewing = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const userRef = useRef(user);
  userRef.current = user;
  const visible = () => AppState.currentState === "active";

  // Sellers publish their catalogue to the server so buyers on other devices can pay
  // (web App "/products/sync"): business accounts with the shop on, 800 ms after a change.
  const payAs = payHandle(store);
  const selling = store.accountType === "business" && store.business?.shop !== false && Boolean(payAs);
  useEffect(() => {
    if (!selling) return undefined;
    const business = store.business || {};
    const products = (store.myProducts || []).map((item) => ({
      id: item.id, name: item.name, price: item.price, image: item.images?.[0], stock: item.madeToOrder && !item.stock ? null : item.stock, madeToOrder: item.madeToOrder || null, service: Boolean(item.service),
    }));
    const id = setTimeout(() => {
      payApi("/products/sync", { handle: payAs, shop: { title: business.title, city: business.city, category: business.category }, products }).catch(() => {});
    }, 800);
    return () => clearTimeout(id);
  }, [selling, payAs, store.business, store.myProducts]);

  const send = useCallback((message) => hubRef.current?.send(message) || false, []);
  const calls = useMemo(() => new CallController({ send, me: () => userRef.current?.handle }), [send]);
  const call = useSyncExternalStore(calls.subscribe, calls.getSnapshot);

  // Demo contacts write back, so the chat feels alive without a second account.
  const [demoTyping, setDemoTyping] = useState({});
  const answered = useRef({});
  const answerLater = useCallback((target, payload) => {
    const id = target.id;
    if (answered.current[id]) return;
    answered.current[id] = true;
    const text = typeof payload === "string" ? payload : payload.text || "";
    const pool = payload.kind === "image" ? DEMO_REPLIES.image : payload.kind === "audio" ? DEMO_REPLIES.audio : /\?\s*$/.test(text) ? DEMO_REPLIES.question : DEMO_REPLIES.text;
    const reply = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => setDemoTyping((prev) => ({ ...prev, [id]: true })), 900);
    setTimeout(() => {
      setDemoTyping((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      storeRef.current.receiveChatMessage?.(id, reply, viewing.current === id && visible());
      if (calls.getSnapshot().phase === "idle") sounds.message();
      setTimeout(() => { answered.current[id] = false; }, 4000);
    }, 900 + 1400 + reply.length * 40);
  }, [calls]);

  // LiveBridge: demo-contact calls never reach the hub, log them in the local thread.
  useEffect(() => {
    calls.onLog = (entry) => storeRef.current.addChatMessage(entry.convId, { kind: "call", call: entry.call, duration: entry.duration });
    return () => { calls.onLog = null; };
  }, [calls]);

  const markRead = useCallback((convId) => {
    const conv = stateRef.current.convs[convId];
    if (!conv) return;
    const last = conv.messages[conv.messages.length - 1];
    if (!conv.unread && (!last?.created || last.created <= (conv.lastReadAt || 0))) return;
    send({ type: "read", convId });
  }, [send]);

  const onMessage = useCallback((message) => {
    const current = stateRef.current;
    switch (message.type) {
      case "ready":
        dispatch({ type: "ready", me: message.me, people: message.people, convs: message.convs });
        calls.onReady(message);
        for (const conv of Object.values(current.convs)) {
          for (const pending of conv.messages.filter((item) => !item.id && item.status !== "failed")) {
            send({ type: "send", convId: conv.id, ...pending.payload, clientId: pending.clientId });
          }
        }
        if (viewing.current) setTimeout(() => markRead(viewing.current), 0);
        return;
      case "presence": dispatch({ type: "presence", person: message.person }); return;
      case "conv": dispatch({ type: "conv", conv: message.conv }); return;
      case "conv_removed": dispatch({ type: "conv_removed", convId: message.convId }); return;
      case "opened": {
        const waiter = waiters.current.get(message.ref);
        if (waiter) { waiters.current.delete(message.ref); waiter.resolve(message.convId); }
        return;
      }
      case "error": {
        if (message.ref && waiters.current.has(message.ref)) {
          waiters.current.get(message.ref).reject(new Error(message.code));
          waiters.current.delete(message.ref);
        }
        return;
      }
      case "message": {
        const msg = message.message;
        if (msg.clientId) {
          clearTimeout(timers.current.get(msg.clientId));
          timers.current.delete(msg.clientId);
        }
        const onScreen = viewing.current === msg.convId && visible();
        const me = current.me?.handle;
        if (!current.convs[msg.convId]) {
          send({ type: "sync" });
          return;
        }
        dispatch({ type: "message", message: msg, viewing: onScreen });
        if (msg.from !== me && msg.from !== "system") {
          if (onScreen) send({ type: "read", convId: msg.convId });
          else {
            const conv = current.convs[msg.convId];
            const sender = conv?.members.find((member) => member.handle === msg.from) || current.people[msg.from];
            const muted = (prefsRef.current?.muted || []).includes(sender?.name) || Boolean(storeRef.current.dmFlags?.[msg.convId]?.muted);
            if (!muted && prefsRef.current?.notes?.messages !== false && msg.kind !== "call") {
              if (calls.getSnapshot().phase === "idle") sounds.message();
              dispatch({ type: "toast", toast: { id: msg.id, convId: msg.convId, from: sender, conv, message: msg } });
            }
          }
        }
        return;
      }
      case "send_failed":
        clearTimeout(timers.current.get(message.clientId));
        dispatch({ type: "failed", convId: message.convId, clientId: message.clientId });
        return;
      case "page": dispatch({ type: "page", convId: message.convId, messages: message.messages, hasMore: message.hasMore }); return;
      case "read": dispatch({ type: "read", convId: message.convId, handle: message.handle, at: message.at }); return;
      case "typing": dispatch({ type: "typing", convId: message.convId, handle: message.handle }); return;
      case "reaction": dispatch({ type: "reaction", convId: message.convId, messageId: message.messageId, reactions: message.reactions }); return;
      case "edited": dispatch({ type: "edited", message: message.message }); return;
      case "unsent": dispatch({ type: "unsent", convId: message.convId, messageId: message.messageId }); return;
      // Stripe orders (calls/src/payments.js markPaid / orders/ship): a sale for the seller,
      // "shipped" for the buyer, both as notifications that open the orders (web "space-order").
      case "order": {
        const order = message.order;
        if (!order) return;
        emitOrderEvent(message);
        // The hub sends "sold" only to the seller and "shipped" to both sides.
        const mine = new Set([current.me?.handle, userRef.current?.handle, storeRef.current.auth?.handle].filter(Boolean));
        const push = storeRef.current.pushNote;
        if (message.event === "sold") {
          const what = `${order.qty > 1 ? `${order.qty} × ` : ""}${order.name}`;
          push?.({ type: "order", name: `@${order.buyer}`, src: avatarFor(order.buyer) || order.image || undefined, text: t("ha acquistato {what} · {total}", { what, total: euro(order.total) }), target: { kind: "orders" } });
        }
        if (message.event === "shipped" && (mine.has(order.buyer) || !mine.has(order.seller))) {
          push?.({ type: "order", name: `@${order.seller}`, src: avatarFor(order.seller) || order.image || undefined, text: t("ha spedito il tuo ordine: {name}", { name: order.name }), target: { kind: "orders" } });
        }
        return;
      }
      default:
        if (String(message.type || "").startsWith("call_")) calls.onMessage(message);
    }
  }, [calls, markRead, send]);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Connect while there is a profile handle.
  useEffect(() => {
    if (!user?.handle) return undefined;
    const hub = createHub({
      hello: () => ({
        handle: userRef.current.handle,
        name: userRef.current.name,
        src: String(userRef.current.src || "").length < 40_000 ? userRef.current.src : "",
        receipts: prefsRef.current?.readReceipts !== false,
        showOnline: prefsRef.current?.activity !== false,
      }),
      onMessage: (message) => onMessageRef.current(message),
      onStatus: (status) => {
        dispatch({ type: "status", status });
        calls.onHubStatus(status);
      },
    });
    hubRef.current = hub;
    return () => {
      calls.reset();
      hub.close();
      hubRef.current = null;
      dispatch({ type: "reset" });
    };
  }, [user?.handle, calls]);

  useEffect(() => {
    send({ type: "prefs", receipts: prefs?.readReceipts !== false, showOnline: prefs?.activity !== false });
  }, [prefs?.readReceipts, prefs?.activity, send]);

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "prune" }), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!state.toast) return undefined;
    const id = setTimeout(() => dispatch({ type: "toast", toast: null }), 4200);
    return () => clearTimeout(id);
  }, [state.toast]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && viewing.current) markRead(viewing.current);
    });
    return () => sub.remove();
  }, [markRead]);

  const unread = Object.values(state.convs).reduce((sum, conv) => sum + (conv.unread || 0), 0);

  const ask = useCallback((message) => new Promise((resolve, reject) => {
    const ref = clientId();
    waiters.current.set(ref, { resolve, reject });
    if (!send({ ...message, ref })) {
      waiters.current.delete(ref);
      reject(new Error("offline"));
      return;
    }
    setTimeout(() => {
      if (waiters.current.has(ref)) {
        waiters.current.delete(ref);
        reject(new Error("timeout"));
      }
    }, 8000);
  }), [send]);

  const api = useMemo(() => {
    const out = {
      send(convId, payload) {
        const body = typeof payload === "string" ? { kind: "text", text: payload } : { kind: "text", ...payload };
        if (body.kind === "text") {
          body.text = String(body.text || "").trim();
          if (!body.text) return;
        }
        const id = clientId();
        const me = stateRef.current.me?.handle;
        dispatch({ type: "pending", convId, message: { ...body, clientId: id, from: me, convId, created: 0, status: "pending", payload: body } });
        send({ type: "send", convId, clientId: id, ...body });
        timers.current.set(id, setTimeout(() => dispatch({ type: "failed", convId, clientId: id }), SEND_TIMEOUT));
      },
      retry(convId, message) {
        dispatch({ type: "discard", convId, clientId: message.clientId });
        out.send(convId, message.payload);
      },
      react(convId, messageId, emoji) {
        if (!messageId) return;
        const me = stateRef.current.me?.handle;
        const conv = stateRef.current.convs[convId];
        const current = conv?.messages.find((message) => message.id === messageId)?.reactions || {};
        const next = { ...current };
        if (emoji) next[me] = emoji;
        else delete next[me];
        dispatch({ type: "reaction", convId, messageId, reactions: next });
        send({ type: "react", convId, messageId, emoji: emoji || "" });
      },
      unsend(convId, messageId) {
        if (!messageId) return;
        dispatch({ type: "unsent", convId, messageId });
        send({ type: "unsend", convId, messageId });
      },
      discard(convId, message) {
        dispatch({ type: "discard", convId, clientId: message.clientId });
      },
      typing(convId) {
        const last = typedAt.current.get(convId) || 0;
        if (Date.now() - last < TYPING_EVERY) return;
        typedAt.current.set(convId, Date.now());
        send({ type: "typing", convId });
      },
      setViewing(convId) {
        viewing.current = convId;
        if (convId && visible()) markRead(convId);
      },
      viewingNow: () => viewing.current,
      markRead,
      fetchOlder(convId) {
        const conv = stateRef.current.convs[convId];
        if (!conv || !conv.hasMore || conv.loading) return;
        const first = conv.messages.find((message) => message.created);
        dispatch({ type: "loading", convId });
        send({ type: "fetch", convId, before: first?.created || Date.now() });
      },
      openDm: (target) => ask({ type: "dm_open", handle: target }),
      createGroup: (title, members, extra = {}) => ask({ type: "group_create", title, members, ...extra }),
      edit(convId, messageId, text) {
        const value = String(text || "").trim();
        if (!messageId || !value) return;
        const conv = stateRef.current.convs[convId];
        const current = conv?.messages.find((message) => message.id === messageId);
        if (current) dispatch({ type: "edited", message: { ...current, convId, text: value, edited: Date.now() } });
        send({ type: "edit", convId, messageId, text: value });
      },
      pin(convId, message) {
        dispatch({ type: "pinned", convId, message: message || null });
        send({ type: "pin", convId, messageId: message?.id || null });
      },
      updateGroup: (convId, patch) => send({ type: "group_update", convId, ...patch }),
      leaveGroup: (convId) => send({ type: "group_leave", convId }),
      dismissToast: () => dispatch({ type: "toast", toast: null }),
      answerLater,
    };
    return out;
  }, [ask, markRead, send, answerLater]);

  const value = useMemo(() => ({ ...state, unread, call, calls, demoTyping, ...api }), [state, unread, call, calls, demoTyping, api]);
  return createElement(Live.Provider, { value }, children);
}
