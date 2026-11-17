// Helpers for Search, profiles, Pensieri and the shop tools: opening grids and people, and
// small formatting helpers.
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { myHandle } from "./session";
import { localeTag, t } from "./i18n";
import { openTab } from "./tabs";

// The demo directories are gone; these stay (empty) for screens that still import them.
export const SEARCH_PEOPLE = [];
export const MEET = [];
export const DIRECTORY = [];
export const CITIES = [];
export const DEMO_GALLERY = [];
export const CONTACTS = [];

export function hashtagsOf(text) {
  return (String(text || "").match(/#[\p{L}\d_]+/gu) || []).map((tag) => tag.slice(1).toLowerCase());
}

export function parseCount(label) {
  const text = String(label ?? "0").trim().toLowerCase().replace(/\s/g, "");
  if (text.endsWith("k")) {
    const n = parseFloat(text.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1000) : 0;
  }
  const n = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Kept for old callers: the explore grid now comes from the server (useExplore).
export function explorePool() {
  return [];
}

let feed = { list: [], start: 0, title: "" };
export function gridFeed() {
  return feed;
}

// Open a grid tile (server posts in postCard shape): a thought opens its thread; otherwise the
// grid opens as a feed starting at that post, or the single post page when it is alone.
export function openGridItem(post, list, title) {
  if (!post) return;
  if (post.serverKind === "thought" || post.kind === "tweet" || post.kind === "thought") {
    router.push(`/thought/${encodeURIComponent(post.id)}`);
    return;
  }
  const ids = new Set();
  const posts = (list || []).filter((item) => item && item.serverKind !== "thought" && item.kind !== "tweet" && !ids.has(item.id) && ids.add(item.id));
  const start = posts.findIndex((item) => item.id === post.id);
  if (posts.length > 1 && start >= 0) {
    feed = { list: posts, start, title };
    router.push("/posts");
    return;
  }
  router.push(`/post/${encodeURIComponent(post.id)}`);
}

// A profile by handle ("@x" or "x"): mine opens the Profile tab.
export function openProfile(handle) {
  const clean = String(handle || "").replace(/^@/, "").toLowerCase();
  if (!clean) return;
  if (clean === myHandle()) {
    openTab("profile");
    return;
  }
  router.push(`/person/${encodeURIComponent(clean)}`);
}

// Old callers pass a name; people are identified by handle now, so a handle-looking value opens it.
export function openPersonByName(name) {
  if (/^@?[a-z0-9._]{2,30}$/i.test(String(name || ""))) openProfile(name);
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const TIME = { MIN, HOUR, DAY };

export function agoLabel(ms) {
  const diff = Math.max(0, Date.now() - ms);
  if (diff < MIN) return t("ora");
  if (diff < HOUR) return t("{n} min", { n: Math.floor(diff / MIN) });
  if (diff < DAY) return t("{n} h", { n: Math.floor(diff / HOUR) });
  if (diff < 7 * DAY) return t("{n} g", { n: Math.floor(diff / DAY) });
  return new Date(ms).toLocaleDateString(localeTag(), { day: "numeric", month: "short" });
}

export function fullStamp(ms) {
  const date = new Date(ms);
  const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${clock} · ${date.toLocaleDateString(localeTag(), { day: "numeric", month: "short", year: "numeric" })}`;
}

export function openState(hours) {
  if (!hours) return null;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (value) => {
    const [h, m] = String(value).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const open = hours.days.includes(now.getDay()) && minutes >= toMin(hours.open) && minutes < toMin(hours.close);
  const names = [t("dom"), t("lun"), t("mar"), t("mer"), t("gio"), t("ven"), t("sab")];
  let nextDay = null;
  for (let step = minutes < toMin(hours.open) ? 0 : 1; step <= 7; step += 1) {
    const day = (now.getDay() + step) % 7;
    if (hours.days.includes(day)) {
      nextDay = step === 0 ? t("oggi") : step === 1 ? t("domani") : names[day];
      break;
    }
  }
  return open ? { open: true, label: t("Aperto · chiude alle {time}", { time: hours.close }) } : { open: false, label: t("Chiuso · apre {day} alle {time}", { day: nextDay, time: hours.open }) };
}

export function daysLabel(days) {
  const names = [t("Dom"), t("Lun"), t("Mar"), t("Mer"), t("Gio"), t("Ven"), t("Sab")];
  const order = [1, 2, 3, 4, 5, 6, 0].filter((day) => days.includes(day));
  if (!order.length) return "";
  return order.length > 2 ? `${names[order[0]]}–${names[order[order.length - 1]]}` : order.map((day) => names[day]).join(", ");
}

// Numbers that count up when a profile opens, like the web app; later changes (a new
// follower) move on from the number already shown.
export function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    const end = Number(target) || 0;
    const from = shown.current;
    if (end === from) return undefined;
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(from + (end - from) * eased);
      shown.current = next;
      setValue(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
