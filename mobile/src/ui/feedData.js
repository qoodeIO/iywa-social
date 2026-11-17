// Small helpers shared by the feed, posts, comments, hashtags and notifications.
// Posts, comments and people come from the server (lib/social.js); nothing here holds data.
import { cachedPost, postCard } from "../lib/social";
import { t } from "../lib/i18n";

export { STORY_FILTERS as POST_FILTERS, filterOf } from "../lib/stories";

export const SHARE_BASE = "https://iywa.app/p/";

export function parseCount(label) {
  if (typeof label === "number") return label;
  const text = String(label ?? "0").trim().toLowerCase().replace(/\s/g, "");
  if (text.endsWith("k")) {
    const n = parseFloat(text.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1000) : 0;
  }
  const n = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Counts come from the server already including my own like.
export function tally(label) {
  return String(parseCount(label));
}

export function commentCount(post) {
  return parseCount(post?.comments);
}

export function hashtagsOf(text) {
  return (String(text || "").match(/#[\p{L}\d_]+/gu) || []).map((tag) => tag.slice(1).toLowerCase());
}

// Muted / blocked people (by handle or, for older lists, by name) and hidden words.
export function personHidden(prefs, who, blockOnly = false) {
  if (!who) return false;
  const key = String(who).replace(/^@/, "");
  const has = (list) => Array.isArray(list) && (list.includes(key) || list.includes(who));
  const blocked = has(prefs?.blocked);
  if (blocked || blockOnly) return blocked;
  return has(prefs?.muted);
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
  if (!item) return false;
  const handle = item.owner || item.author?.handle;
  return !personHidden(prefs, handle) && !personHidden(prefs, item.name || item.author?.name) && !textHidden(prefs, item.text || item.caption);
}
export function canReach(prefs, follows, name, key) {
  const rule = prefs?.[key] || "everyone";
  if (rule === "off") return false;
  if (rule === "following") return Array.isArray(follows) && follows.includes(name);
  return true;
}

// One card shape for a server post or an already shaped card.
export function shapePost(item) {
  if (!item) return null;
  if (item.server) return item;
  if (item.author) return postCard(item);
  return { ...item, src: item.src || item.avatar || "", avatar: item.avatar || item.src || "" };
}

// The cached copy of a post (card shape), or null when it has not been loaded yet.
export function findPost(id) {
  const post = cachedPost(String(id || ""));
  return post ? postCard(post) : null;
}

// Faces come with the server's people objects now; without one there is no face to show.
export function faceOf(name, me) {
  if (me && name && (name === me.name || name === me.handle)) return me.src || me.avatar || null;
  return null;
}

// Names no longer map to handles on the device: people are looked up on the server.
export function handleOf() {
  return null;
}

export function noteAgo(at) {
  const diff = Math.max(0, Date.now() - at);
  if (diff < 60_000) return t("ora");
  if (diff < 3_600_000) return t("{n} min", { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t("{n} h", { n: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t("{n} g", { n: Math.floor(diff / 86_400_000) });
  return t("{n} sett", { n: Math.floor(diff / (7 * 86_400_000)) });
}
