// Real data from the iywa server: a small cache with hooks for every list and screen, and the
// actions that change it (optimistically, then confirmed by the server).
//
//   const { items, loading, refreshing, done, refresh, more } = useFeed();
//   const { data: profile } = useProfile("anna");
//   await toggleLike(post);
//
// Posts come from the server as { id, kind: photo|reel|thought, author: { handle, name, avatar },
// media: [{ url, type }], text, likes, comments, liked, saved, … }. `postCard()` turns one into
// the shape the feed components have always used (name, handle "@x", src, image, images…).
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import * as VideoThumbnails from "expo-video-thumbnails";
import { api, uploadMedia } from "./api";
import { getSession, myHandle, onSessionChange, patchMe } from "./session";
import { t } from "./i18n";

// ---------- cache ----------

const cache = new Map(); // key -> entry
const subs = new Map(); // key -> Set<fn>
const inflight = new Map(); // key -> promise
const EMPTY = Object.freeze({ data: undefined, error: null, loading: false, at: 0 });

function entry(key) {
  return cache.get(key) || EMPTY;
}

function put(key, patch) {
  const next = { ...entry(key), ...patch };
  cache.set(key, next);
  for (const fn of subs.get(key) || []) fn();
  return next;
}

function subscribe(key, fn) {
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key).add(fn);
  return () => subs.get(key)?.delete(fn);
}

function useEntry(key) {
  return useSyncExternalStore(
    useCallback((fn) => (key ? subscribe(key, fn) : () => {}), [key]),
    () => (key ? entry(key) : EMPTY),
  );
}

// Drops everything (sign-out, account switch).
export function clearCache() {
  const keys = [...cache.keys()];
  cache.clear();
  inflight.clear();
  for (const key of keys) for (const fn of subs.get(key) || []) fn();
  // Whatever is on screen loads again for the new account.
  for (const [key, set] of subs) if (set.size) reloaders.get(key)?.();
}

// Marks matching entries stale and reloads the ones on screen.
export function invalidate(prefix) {
  for (const key of [...cache.keys()]) {
    if (!key.startsWith(prefix)) continue;
    put(key, { at: 0 });
    if (subs.get(key)?.size) reloaders.get(key)?.();
  }
}
const reloaders = new Map();

// Applies fn to every cached value (used to update one post everywhere it appears).
function everywhere(fn) {
  for (const [key, value] of cache) {
    if (value.data === undefined) continue;
    const next = fn(value.data, key);
    if (next !== value.data) put(key, { data: next });
  }
}

// Another account (or none): nothing cached for the previous one may show.
let cachedFor = getSession().me?.handle || null;
onSessionChange(() => {
  const handle = getSession().me?.handle || null;
  if (handle !== cachedFor) {
    cachedFor = handle;
    clearCache();
  }
});

// ---------- one-shot queries ----------

export function useQuery(key, path, { query, enabled = true, stale = 20_000, map } = {}) {
  const state = useEntry(enabled ? key : null);
  const load = useCallback(async (force = false) => {
    if (!key || !enabled) return;
    const current = entry(key);
    if (!force && current.at && Date.now() - current.at < stale) return;
    if (inflight.has(key)) return inflight.get(key);
    put(key, { loading: true, error: null });
    const promise = api(path, { query })
      .then((data) => put(key, { data: map ? map(data) : data, loading: false, at: Date.now(), error: null }))
      .catch((error) => put(key, { loading: false, error }))
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }, [key, path, enabled, stale, JSON.stringify(query || null)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return undefined;
    reloaders.set(key, () => load(true));
    load();
    return undefined;
  }, [key, load]);

  return { data: state.data, error: state.error, loading: state.loading || (enabled && state.data === undefined && !state.error), refresh: () => load(true) };
}

// ---------- paged lists ----------

// List endpoints answer { <field>: [...], next }; `next` is the createdAt to load before.
export function usePaged(key, path, { query, field = "posts", enabled = true, stale = 30_000 } = {}) {
  const state = useEntry(enabled ? key : null);
  const busy = useRef(false);

  const load = useCallback(async (mode) => {
    if (!key || !enabled || busy.current) return;
    const current = entry(key);
    if (mode === "first" && current.at && Date.now() - current.at < stale) return;
    if (mode === "more" && (!current.data || current.data.done)) return;
    busy.current = true;
    put(key, mode === "more" ? { moreLoading: true } : mode === "refresh" ? { refreshing: true, error: null } : { loading: true, error: null });
    try {
      const before = mode === "more" ? current.data.next : undefined;
      const data = await api(path, { query: { ...(query || {}), before } });
      const list = data[field] || [];
      const items = mode === "more" ? dedupe([...(current.data?.items || []), ...list]) : list;
      put(key, { data: { ...data, items, next: data.next ?? null, done: !data.next }, loading: false, refreshing: false, moreLoading: false, at: Date.now(), error: null });
    } catch (error) {
      put(key, { loading: false, refreshing: false, moreLoading: false, error });
    } finally {
      busy.current = false;
    }
  }, [key, path, enabled, field, stale, JSON.stringify(query || null)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) return;
    reloaders.set(key, () => load("refresh"));
    load("first");
  }, [key, load]);

  const data = state.data;
  return {
    items: data?.items || [],
    data,
    loading: Boolean(state.loading || (enabled && data === undefined && !state.error)),
    refreshing: Boolean(state.refreshing),
    moreLoading: Boolean(state.moreLoading),
    done: Boolean(data?.done),
    error: state.error,
    refresh: () => load("refresh"),
    more: () => load("more"),
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((item) => {
    const id = item.id || item.handle;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// ---------- hooks ----------

export const useFeed = () => usePaged("feed", "/feed");
export const useExplore = () => usePaged("explore", "/explore");
export const useReelsFeed = () => usePaged("reels", "/reels");
export const useThoughtsFeed = (tab = "all") => usePaged(`thoughts:${tab}`, "/thoughts", { query: { tab } });
export const useUserPosts = (handle, kind = "grid") => usePaged(handle ? `user-posts:${handle}:${kind}` : null, `/users/${encodeURIComponent(handle || "")}/posts`, { query: { kind }, enabled: Boolean(handle) });
export const useUserReposts = (handle) => usePaged(handle ? `user-reposts:${handle}` : null, `/users/${encodeURIComponent(handle || "")}/reposts`, { enabled: Boolean(handle) });
export const useTagPosts = (tag) => usePaged(tag ? `tag:${tag.toLowerCase()}` : null, `/tags/${encodeURIComponent(String(tag || "").toLowerCase())}`, { enabled: Boolean(tag) });
export const useSavedPosts = () => usePaged("saved", "/saved");
export const useLikedPosts = () => usePaged("liked", "/liked");
export const useNotifications = () => usePaged("notifications", "/notifications", { field: "notifications", stale: 10_000 });
export const useFollowList = (handle, kind) => usePaged(handle ? `people:${handle}:${kind}` : null, `/users/${encodeURIComponent(handle || "")}/${kind}`, { field: "people", enabled: Boolean(handle) });

export const useProfile = (handle) => useQuery(handle ? `user:${handle}` : null, `/users/${encodeURIComponent(handle || "")}`, { enabled: Boolean(handle), map: (d) => d.user });
export const usePost = (id) => useQuery(id ? `post:${id}` : null, `/posts/${encodeURIComponent(id || "")}`, { enabled: Boolean(id) });
export const useComments = (id) => useQuery(id ? `comments:${id}` : null, `/posts/${encodeURIComponent(id || "")}/comments`, { enabled: Boolean(id), map: (d) => d.comments });
export const usePostLikes = (id) => useQuery(id ? `likes:${id}` : null, `/posts/${encodeURIComponent(id || "")}/likes`, { enabled: Boolean(id), map: (d) => d.people });
export const useStories = () => useQuery("stories", "/stories", { stale: 15_000, map: (d) => d.decks });
export const useUserStories = (handle) => useQuery(handle ? `user-stories:${handle}` : null, `/users/${encodeURIComponent(handle || "")}/stories`, { enabled: Boolean(handle) });
export const useStoryViewers = (id) => useQuery(id ? `viewers:${id}` : null, `/stories/${encodeURIComponent(id || "")}/viewers`, { enabled: Boolean(id), stale: 5_000, map: (d) => d.people });
export const useHighlights = (handle) => useQuery(handle ? `highlights:${handle}` : null, `/users/${encodeURIComponent(handle || "")}/highlights`, { enabled: Boolean(handle), map: (d) => d.highlights });
export const useSuggested = () => useQuery("suggested", "/suggested", { stale: 120_000, map: (d) => d.people });
export const useRequests = () => useQuery("requests", "/requests", { stale: 10_000, map: (d) => d.people });
export const useShop = (handle) => useQuery(handle ? `shop:${handle}` : null, `/users/${encodeURIComponent(handle || "")}/shop`, { enabled: Boolean(handle) });
export const useShops = () => useQuery("shops", "/shops", { stale: 60_000, map: (d) => d.shops });
export const useProduct = (owner, id) => useQuery(owner && id ? `product:${owner}:${id}` : null, `/products/${encodeURIComponent(owner || "")}/${encodeURIComponent(id || "")}`, { enabled: Boolean(owner && id) });
export const useOrders = () => useQuery("orders", "/orders", { stale: 10_000 });

// Search as you type (debounced by the caller's state; empty query → nothing).
export function useSearch(q) {
  const query = String(q || "").trim();
  return useQuery(query ? `search:${query.toLowerCase()}` : null, "/search", { query: { q: query }, enabled: Boolean(query), stale: 30_000 });
}

// Number of unread notifications (the heart dot), kept live by the hub.
export function useUnreadCount() {
  const state = useEntry("notifications");
  return state.data?.unread || 0;
}

// ---------- shapes ----------

export function ago(at) {
  const diff = Math.max(0, Date.now() - (at || 0));
  if (diff < 60_000) return t("ora");
  if (diff < 3_600_000) return t("{n} min", { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t("{n} h", { n: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t("{n} g", { n: Math.floor(diff / 86_400_000) });
  return t("{n} sett", { n: Math.floor(diff / (7 * 86_400_000)) });
}

// The card shape the existing components read.
export function postCard(post) {
  if (!post) return null;
  const media = post.media || [];
  const images = media.map((m) => (m.type === "video" ? m.poster || m.url : m.url));
  const video = media.find((m) => m.type === "video")?.url || null;
  const author = post.author || {};
  return {
    ...post,
    server: true,
    kind: post.kind === "photo" ? "post" : post.kind === "thought" ? "tweet" : "reel",
    serverKind: post.kind,
    name: author.name,
    handle: `@${author.handle}`,
    owner: author.handle,
    avatar: author.avatar || "",
    src: author.avatar || "",
    verified: Boolean(author.verified),
    image: images[0] || null,
    images,
    video,
    time: ago(post.createdAt),
    mine: author.handle === myHandle(),
  };
}

// Person shape the old lists read ({ name, handle, src }).
export function personCard(person) {
  if (!person) return null;
  return { ...person, src: person.avatar || "", handle: person.handle, at: person.at };
}

// ---------- post actions ----------

function mapPosts(data, id, fn) {
  if (!data || typeof data !== "object") return data;
  let changed = false;
  const one = (p) => {
    if (p && p.id === id) { changed = true; return fn(p); }
    return p;
  };
  const list = (arr) => {
    if (!Array.isArray(arr)) return arr;
    const next = arr.map(one);
    return changed ? next : arr;
  };
  const out = { ...data };
  if (data.id === id && data.author) return fn(data);
  if (Array.isArray(data)) return list(data);
  for (const field of ["items", "posts", "replies", "ancestors"]) if (Array.isArray(data[field])) out[field] = list(data[field]);
  if (data.post && data.post.id === id) { out.post = fn(data.post); changed = true; }
  return changed ? out : data;
}

export function updatePost(id, fn) {
  everywhere((data) => mapPosts(data, id, typeof fn === "function" ? fn : (p) => ({ ...p, ...fn })));
}

function removePost(id) {
  everywhere((data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    let out = data;
    for (const field of ["items", "posts", "replies"]) {
      if (Array.isArray(data[field]) && data[field].some((p) => p?.id === id)) out = { ...out, [field]: data[field].filter((p) => p?.id !== id) };
    }
    return out;
  });
}

function prepend(key, post) {
  const current = entry(key);
  if (!current.data?.items) return;
  put(key, { data: { ...current.data, items: [post, ...current.data.items.filter((p) => p.id !== post.id)] } });
}

async function flip(post, field, countField, path) {
  const on = !post[field];
  updatePost(post.id, (p) => ({ ...p, [field]: on, ...(countField ? { [countField]: Math.max(0, (p[countField] || 0) + (on ? 1 : -1)) } : {}) }));
  try {
    const data = await api(`/posts/${post.id}/${path}`, { method: on ? "POST" : "DELETE" });
    updatePost(post.id, (p) => ({ ...p, likes: data.post.likes, reposts: data.post.reposts, [field]: data.post[field] }));
  } catch (error) {
    updatePost(post.id, (p) => ({ ...p, [field]: !on, ...(countField ? { [countField]: Math.max(0, (p[countField] || 0) + (on ? -1 : 1)) } : {}) }));
    throw error;
  }
  if (field === "saved") invalidate("saved");
  if (field === "liked") invalidate("liked");
  if (field === "reposted") invalidate(`user-reposts:${myHandle()}`);
  return on;
}

export const toggleLike = (post) => flip(post, "liked", "likes", "like");
export const toggleSave = (post) => flip(post, "saved", null, "save");
export const toggleRepost = (post) => flip(post, "reposted", "reposts", "repost");

// Like only (double tap never unlikes).
export async function like(post) {
  if (post.liked) return true;
  return toggleLike(post);
}

export async function vote(post, choice) {
  updatePost(post.id, (p) => (p.poll ? { ...p, poll: { ...p.poll, voted: choice, counts: p.poll.counts.map((n, i) => (i === choice ? n + 1 : n)) } } : p));
  const data = await api(`/posts/${post.id}/vote`, { method: "POST", body: { choice } });
  updatePost(post.id, (p) => ({ ...p, poll: data.post.poll }));
}

// media: [{ uri, type: "image" | "video", w, h, poster }] — local files are uploaded first.
export async function createPost({ kind = "photo", text = "", media = [], place, tags, products, poll, parent, hideLikes, commentsOff, audio, alt, onProgress }) {
  const uploaded = [];
  for (let i = 0; i < media.length; i += 1) {
    const item = media[i];
    onProgress?.(i / Math.max(1, media.length));
    const url = await uploadMedia(item.uri || item.url, item.mime);
    // Videos get a cover from their first second, so grids never show an empty tile.
    let posterUri = item.poster;
    if (!posterUri && item.type === "video" && String(item.uri || "").startsWith("file:")) {
      posterUri = await VideoThumbnails.getThumbnailAsync(item.uri, { time: 500, quality: 0.7 }).then((r) => r.uri).catch(() => null);
    }
    const poster = posterUri ? await uploadMedia(posterUri, "image/jpeg").catch(() => undefined) : undefined;
    uploaded.push({ url, type: item.type === "video" ? "video" : "image", w: item.w, h: item.h, poster });
  }
  onProgress?.(1);
  const data = await api("/posts", { method: "POST", body: { kind, text, media: uploaded, place, tags, products, poll, parent, hideLikes, commentsOff, audio, alt } });
  const post = data.post;
  const me = myHandle();
  if (kind === "thought") {
    if (parent) {
      everywhere((value, key) => (key === `post:${parent}` && value?.replies ? { ...value, replies: [...value.replies, post] } : value));
      updatePost(parent, (p) => ({ ...p, comments: (p.comments || 0) + 1 }));
      invalidate(`user-posts:${me}:replies`);
    } else {
      prepend("thoughts:all", post);
      prepend("thoughts:following", post);
      prepend(`user-posts:${me}:thoughts`, post);
    }
  } else {
    prepend("feed", post);
    prepend(`user-posts:${me}:grid`, post);
    if (kind === "reel") { prepend("reels", post); prepend(`user-posts:${me}:reels`, post); }
    patchMe((m) => ({ posts: (m.posts || 0) + 1 }));
    invalidate(`user:${me}`);
  }
  return post;
}

export async function editPost(id, patch) {
  const data = await api(`/posts/${id}`, { method: "PATCH", body: patch });
  updatePost(id, () => data.post);
  if (patch.archived != null) {
    const me = myHandle();
    if (patch.archived) removePost(id);
    invalidate(`user-posts:${me}`);
    invalidate("feed");
    patchMe((m) => ({ posts: Math.max(0, (m.posts || 0) + (patch.archived ? -1 : 1)) }));
  }
  return data.post;
}

export async function deletePost(id) {
  const kind = cachedPost(id)?.kind;
  await api(`/posts/${id}`, { method: "DELETE" });
  removePost(id);
  cache.delete(`post:${id}`);
  // Only photos and reels count as posts on the profile.
  if (kind !== "thought") patchMe((m) => ({ posts: Math.max(0, (m.posts || 0) - 1) }));
  invalidate(`user:${myHandle()}`);
}

// ---------- comments ----------

export async function addComment(postId, text, parent) {
  const data = await api(`/posts/${postId}/comments`, { method: "POST", body: { text, parent } });
  const current = entry(`comments:${postId}`);
  if (current.data) put(`comments:${postId}`, { data: [...current.data, data.comment] });
  updatePost(postId, (p) => ({ ...p, comments: (p.comments || 0) + 1 }));
  return data.comment;
}

export async function deleteComment(postId, commentId) {
  await api(`/comments/${commentId}`, { method: "DELETE" });
  const current = entry(`comments:${postId}`);
  if (current.data) {
    const gone = current.data.filter((c) => c.id === commentId || c.parent === commentId).length;
    put(`comments:${postId}`, { data: current.data.filter((c) => c.id !== commentId && c.parent !== commentId) });
    updatePost(postId, (p) => ({ ...p, comments: Math.max(0, (p.comments || 0) - gone) }));
  }
}

export async function toggleCommentLike(postId, comment) {
  const on = !comment.liked;
  const swap = (liked, delta) => {
    const current = entry(`comments:${postId}`);
    if (current.data) put(`comments:${postId}`, { data: current.data.map((c) => (c.id === comment.id ? { ...c, liked, likes: Math.max(0, c.likes + delta) } : c)) });
  };
  swap(on, on ? 1 : -1);
  try {
    await api(`/comments/${comment.id}/like`, { method: on ? "POST" : "DELETE" });
  } catch (error) {
    swap(!on, on ? -1 : 1);
    throw error;
  }
}

// ---------- people ----------

function setRelation(handle, patch) {
  everywhere((data, key) => {
    if (key === `user:${handle}` && data) return { ...data, ...patch };
    if (Array.isArray(data) && data.some((p) => p?.handle === handle && !p.author)) return data.map((p) => (p?.handle === handle && !p.author ? { ...p, ...patch } : p));
    if (data && Array.isArray(data.items) && data.items.some((p) => p?.handle === handle && !p.author)) return { ...data, items: data.items.map((p) => (p?.handle === handle && !p.author ? { ...p, ...patch } : p)) };
    if (data && Array.isArray(data.people) && data.people.some((p) => p?.handle === handle)) return { ...data, people: data.people.map((p) => (p?.handle === handle ? { ...p, ...patch } : p)) };
    return data;
  });
}

export async function follow(handle) {
  setRelation(handle, { isFollowing: true });
  try {
    const data = await api(`/users/${encodeURIComponent(handle)}/follow`, { method: "POST" });
    setRelation(handle, { isFollowing: data.user.isFollowing, requested: data.user.requested, followers: data.user.followers });
    if (data.user.isFollowing) patchMe((m) => ({ following: (m.following || 0) + 1 }));
    invalidate("feed");
    invalidate("stories");
    invalidate(`people:${myHandle()}:following`);
    return data.user;
  } catch (error) {
    setRelation(handle, { isFollowing: false });
    throw error;
  }
}

export async function unfollow(handle) {
  setRelation(handle, { isFollowing: false, requested: false });
  const data = await api(`/users/${encodeURIComponent(handle)}/follow`, { method: "DELETE" });
  setRelation(handle, { followers: data.user.followers });
  patchMe((m) => ({ following: Math.max(0, (m.following || 0) - 1) }));
  invalidate("feed");
  invalidate("stories");
  invalidate(`people:${myHandle()}:following`);
  return data.user;
}

// Follow / unfollow / cancel request, from anything with { handle, isFollowing, requested }.
export function toggleFollow(person) {
  const handle = String(person?.owner || person?.handle || "").replace(/^@/, "");
  if (!handle) return Promise.resolve();
  return person.isFollowing || person.requested ? unfollow(handle) : follow(handle);
}

export async function removeFollower(handle) {
  await api(`/users/${encodeURIComponent(handle)}/follower`, { method: "DELETE" });
  invalidate(`people:${myHandle()}:followers`);
  patchMe((m) => ({ followers: Math.max(0, (m.followers || 0) - 1) }));
}

export async function answerRequest(handle, accept) {
  await api(`/requests/${encodeURIComponent(handle)}/${accept ? "accept" : "decline"}`, { method: "POST" });
  const current = entry("requests");
  if (current.data) put("requests", { data: current.data.filter((p) => p.handle !== handle) });
  if (accept) patchMe((m) => ({ followers: (m.followers || 0) + 1 }));
  invalidate("notifications");
}

// ---------- stories ----------

export async function createStory({ uri, type = "image", text, stickers, closeFriends, style }) {
  const url = await uploadMedia(uri);
  const data = await api("/stories", { method: "POST", body: { media: { url, type }, text, stickers, closeFriends, style } });
  invalidate("stories");
  invalidate(`user-stories:${myHandle()}`);
  return data.story;
}

export function markStoryViewed(story) {
  if (!story || story.seen) return;
  everywhere((data, key) => {
    if (key !== "stories" || !Array.isArray(data)) return data;
    return data.map((deck) => {
      if (!deck.frames.some((f) => f.id === story.id)) return deck;
      const frames = deck.frames.map((f) => (f.id === story.id ? { ...f, seen: true } : f));
      return { ...deck, frames, seen: frames.every((f) => f.seen) };
    });
  });
  api(`/stories/${story.id}/view`, { method: "POST" }).catch(() => {});
}

export async function likeStory(story, on = true) {
  await api(`/stories/${story.id}/like`, { method: on ? "POST" : "DELETE" });
}

export async function deleteStory(id) {
  await api(`/stories/${id}`, { method: "DELETE" });
  invalidate("stories");
  invalidate(`user-stories:${myHandle()}`);
}

export async function createHighlight({ title, cover, frames }) {
  const data = await api("/highlights", { method: "POST", body: { title, cover: await uploadMedia(cover).catch(() => cover), frames } });
  invalidate(`highlights:${myHandle()}`);
  return data.highlight;
}

export async function deleteHighlight(id) {
  await api(`/highlights/${id}`, { method: "DELETE" });
  invalidate(`highlights:${myHandle()}`);
}

// ---------- notifications ----------

export async function markNotificationsRead() {
  const current = entry("notifications");
  if (current.data) put("notifications", { data: { ...current.data, unread: 0, items: current.data.items.map((n) => ({ ...n, read: true })) } });
  await api("/notifications/read", { method: "POST" }).catch(() => {});
}

// Live events from the hub socket (LiveStore forwards them here).
const noteListeners = new Set();
export function onLiveNote(fn) {
  noteListeners.add(fn);
  return () => noteListeners.delete(fn);
}

export function receiveServerEvent(message) {
  if (message?.type !== "notify" || !message.note) return false;
  const note = message.note;
  const current = entry("notifications");
  if (current.data) {
    put("notifications", { data: { ...current.data, unread: (current.data.unread || 0) + 1, items: [note, ...current.data.items.filter((n) => n.id !== note.id)] } });
  } else {
    put("notifications", { data: { items: [note], unread: 1, next: null, done: false }, at: 0 });
  }
  if (note.type === "follow" || note.type === "accepted") { patchMe((m) => ({ followers: note.type === "follow" ? (m.followers || 0) + 1 : m.followers })); invalidate(`user:${myHandle()}`); }
  if (note.type === "request") invalidate("requests");
  for (const fn of noteListeners) fn(note);
  return true;
}

// ---------- shop ----------

// Saves one product of my shop (local photos are uploaded first).
export async function saveProduct(product) {
  const images = [];
  for (const uri of product.images || []) images.push(await uploadMedia(uri));
  const data = await api(`/products/${encodeURIComponent(product.id)}`, { method: "PUT", body: { ...product, images } });
  invalidate(`shop:${myHandle()}`);
  invalidate("shops");
  invalidate(`product:${myHandle()}:${product.id}`);
  return data.product;
}

export async function deleteProduct(id) {
  await api(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
  invalidate(`shop:${myHandle()}`);
  invalidate("shops");
}

export async function addReview(owner, id, stars, text) {
  await api(`/products/${encodeURIComponent(owner)}/${encodeURIComponent(id)}/reviews`, { method: "POST", body: { stars, text } });
  invalidate(`product:${owner}:${id}`);
}

// Fetch helpers for screens that need a value once (not a hook).
export function fetchPost(id) {
  return api(`/posts/${encodeURIComponent(id)}`);
}
export function fetchProfile(handle) {
  return api(`/users/${encodeURIComponent(handle)}`).then((d) => d.user);
}
// The cached copy of a post anywhere in the app, if any.
export function cachedPost(id) {
  for (const value of cache.values()) {
    const data = value.data;
    if (!data) continue;
    if (data.post?.id === id) return data.post;
    for (const field of ["items", "posts", "replies"]) {
      const hit = Array.isArray(data[field]) && data[field].find((p) => p?.id === id && p.author);
      if (hit) return hit;
    }
  }
  return null;
}
