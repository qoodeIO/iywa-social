// Data helpers for Search, profiles, Pensieri and the shop tools, ported from the web app.
import { useEffect, useState } from "react";
import { router } from "expo-router";
import seed from "../data/seed.json";
import { AVATAR, CHATS, EXPLORE, PEOPLE, PORTRAIT, POSTS, REELS, WORKS, personByName } from "../data";
import { localeTag, t } from "./i18n";
import { openTab } from "./tabs";

export const SEARCH_PEOPLE = PEOPLE;

// "Scopri persone" suggestions on your profile (web MEET).
export const MEET = [
  { name: "Chiara Valli", meta: "Tessuti · Firenze", src: CHATS[4]?.src },
  { name: "Pietro Lama", meta: "Cucina · Genova", src: CHATS[5]?.src },
  { name: "Sara Conte", meta: "Ceramica · Faenza", src: CHATS[6]?.src },
  { name: "Elena Marini", meta: "Ricerca · Padova", src: CHATS[7]?.src },
  ...(seed.PEOPLE || []),
];

export const DIRECTORY = [
  ...SEARCH_PEOPLE.map((person) => ({ name: person.name, handle: `@${person.handle}`, craft: person.craft, city: person.city, src: person.src })),
  { name: "Giulia Neri", handle: "@forno.neri", craft: "Ceramica", city: "Milano", src: AVATAR },
];

export const CITIES = ["Milano", "Torino", "Cremona", "Prato", "Bologna"];

export const DEMO_GALLERY = [...new Set([
  ...WORKS.map((work) => work.src),
  PORTRAIT,
  ...(seed.PEOPLE || []).map((person) => person.src),
  ...POSTS.map((post) => post.image).filter(Boolean),
])];

export const CONTACTS = seed.CONTACTS || [];

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

export function reelAsPost(reel) {
  return {
    id: `reel-${reel.id}`,
    reelId: reel.id,
    name: reel.name,
    handle: reel.handle,
    avatar: reel.avatar || reel.src,
    image: reel.image || reel.src,
    text: reel.caption,
    likes: reel.likes,
    kind: "reel",
    views: reel.likes ? `${((parseCount(reel.likes) * 7) / 1000).toFixed(0)}k` : "",
    tag: personByName(reel.name)?.craft,
  };
}

// Everything the explore grid can show: published posts, explore posts and reels, each photo once.
export function explorePool({ library = [], prefs } = {}) {
  const hidden = new Set([...(prefs?.blocked || []), ...(prefs?.muted || [])]);
  const mine = library.filter((item) => item.image && (item.kind === "post" || item.kind === "reel" || !item.kind)).map((item) => ({ ...item, mine: true, reelId: item.kind === "reel" ? item.id : undefined }));
  const seen = new Set();
  return [...mine, ...POSTS.filter((post) => post.image), ...EXPLORE, ...REELS.map(reelAsPost)].filter((post) => {
    if (!post.image || seen.has(post.image) || String(post.image).startsWith("blob:")) return false;
    if (hidden.has(post.name)) return false;
    seen.add(post.image);
    return true;
  });
}

// Open a grid tile: reels go to the Reels tab, the rest to the post page.
export function openGridItem(post) {
  if (post.kind === "reel" && (post.reelId || String(post.id).startsWith("reel-") || REELS.some((reel) => reel.id === post.id))) {
    const id = post.reelId || String(post.id).replace(/^reel-/, "");
    if (router.canDismiss()) router.dismissAll();
    openTab("reels", { id });
    return;
  }
  router.push(`/post/${post.id}`);
}

export function openPersonByName(name, myName) {
  if (name && name === myName) {
    openTab("profile");
    return;
  }
  const person = personByName(name);
  if (person?.handle) router.push(`/person/${String(person.handle).replace(/^@/, "")}`);
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

// Numbers that count up when a profile opens, like the web app.
export function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) {
      setValue(0);
      return undefined;
    }
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(end * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
