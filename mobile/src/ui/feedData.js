// Data helpers for the Home feed, posts, comments, hashtags and notifications.
// Mirrors the web helpers in src/App.jsx (FEED_PAGES, hashtagPool, tally, commentCount, shown…).
import { AVATAR, CONTACTS, EXPLORE, FEED_PAGES, PEOPLE, PORTRAIT, POSTS, REELS, WORKS, avatarFor, personByName } from "../data";

export const FEED_ITEMS = FEED_PAGES.flat();

// Every photo the "Nuovo post" picker shows before the phone's own library.
export const DEMO_GALLERY = [...new Set([
  ...WORKS.map((work) => work.src),
  PORTRAIT,
  ...PEOPLE.map((person) => person.src),
  ...POSTS.map((post) => post.image).filter(Boolean),
])];

export { STORY_FILTERS as POST_FILTERS, filterOf } from "../lib/stories";

export const STORY_PLACES = ["Milano", "Torino", "Prato", "Cremona", "Bologna", "Firenze", "Roma", "Napoli", "Venezia", "Faenza", "Padova", "Genova"];

export function parseCount(label) {
  const text = String(label ?? "0").trim().toLowerCase().replace(/\s/g, "");
  if (text.endsWith("k")) {
    const n = parseFloat(text.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1000) : 0;
  }
  const n = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function tally(label, on) {
  if (!on) return String(label ?? "0");
  return String(parseCount(label) + 1);
}

export function commentCount(post, extras) {
  const added = Array.isArray(extras) ? extras.length : 0;
  const base = post.comments != null ? parseCount(post.comments) : (post.thread || []).length;
  return base + added;
}

export function hashtagsOf(text) {
  return (String(text || "").match(/#[\p{L}\d_]+/gu) || []).map((tag) => tag.slice(1).toLowerCase());
}

// Muted / blocked people and hidden words, same rules as the web.
export function personHidden(prefs, name, blockOnly = false) {
  if (!name) return false;
  const blocked = Array.isArray(prefs?.blocked) && prefs.blocked.includes(name);
  if (blocked || blockOnly) return blocked;
  return Array.isArray(prefs?.muted) && prefs.muted.includes(name);
}
export function textHidden(prefs, text) {
  const blob = String(text || "").toLowerCase();
  const words = Array.isArray(prefs?.hiddenWords) ? prefs.hiddenWords : [];
  return words.some((word) => {
    const needle = String(word || "").trim().toLowerCase();
    return needle && blob.includes(needle);
  });
}
export function shown(prefs, item) {
  return !personHidden(prefs, item?.name) && !textHidden(prefs, item?.text || item?.caption);
}
export function canReach(prefs, follows, name, key) {
  const rule = prefs?.[key] || "everyone";
  if (rule === "off") return false;
  if (rule === "following") return Array.isArray(follows) && follows.includes(name);
  return true;
}

// One post shape for every source: `src` is the author's face.
export function shapePost(item) {
  if (!item) return null;
  return { ...item, src: item.src || item.avatar || avatarFor(item.name) || AVATAR, avatar: item.avatar || item.src };
}

export const HOME_HERO = {
  ...POSTS[0],
  src: AVATAR,
  handle: "Milano",
  time: "2 ore fa",
};

function reelPosts() {
  return REELS.map((reel) => ({ id: `reel-${reel.id}`, name: reel.name, handle: reel.handle, avatar: reel.avatar || reel.src, src: reel.avatar || reel.src, image: reel.src, text: reel.caption, likes: reel.likes, comments: reel.comments, saves: reel.saves, kind: "reel", thread: reel.thread }));
}

export function hashtagPool(library) {
  const seen = new Set();
  return [...(library || []).filter((item) => item.image), ...POSTS.filter((item) => item.image), ...EXPLORE, ...reelPosts()].filter((post) => {
    if (!post.image || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

// Finds a post by id in my library, the profile posts, Explore, the Home feed or Reels.
export function findPost(id, library) {
  const key = String(id || "");
  const found = (library || []).find((item) => item.id === key)
    || POSTS.find((item) => item.id === key)
    || EXPLORE.find((item) => item.id === key)
    || FEED_ITEMS.find((item) => item.id === key)
    || reelPosts().find((item) => item.id === key);
  if (!found) return null;
  const post = shapePost(found);
  if (post.type && !post.kind) post.kind = post.type;
  if (!post.thread && post.kind !== "tweet") {
    // Web asPost(): feed posts open with two demo replies.
    post.thread = [
      { name: "Leo Bassi", text: "Il bordo tiene." },
      { name: "Marta Colle", text: "Lo voglio sul banco." },
    ];
  }
  return post;
}

export function faceOf(name, me) {
  if (me && name === me.name) return me.src || AVATAR;
  return PEOPLE.find((p) => p.name === name)?.src || CONTACTS.find((p) => p.name === name)?.src || avatarFor(name) || null;
}

export function handleOf(name) {
  return personByName(name)?.handle || null;
}

export function noteAgo(at) {
  const diff = Math.max(0, Date.now() - at);
  if (diff < 60_000) return "ora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} g`;
  return `${Math.floor(diff / (7 * 86_400_000))} sett`;
}

export const SHARE_BASE = "https://space.app/p/";
