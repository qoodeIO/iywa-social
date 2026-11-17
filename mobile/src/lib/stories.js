import { useMemo } from "react";
import { useHighlights, useStories } from "./social";
import { myHandle } from "./session";
import { tk } from "./i18n";

// Story constants, copied from the web app (StoryCamera, StoryViewer, HighlightNew).
export const STORY_MS = 5000;
export const MAX_CLIP = 15;
export const STORY_REACTIONS = ["😂", "😮", "😍", "😢", "👏", "🔥", "🎉", "💯"];

// The sticker tray. Every sticker here is made from what the author types or picks
// (people come from search, products from their own shop): nothing is pre-filled.
export const STORY_KIT = [
  { id: "tag", label: tk("Menzione"), icon: "tag" },
  { id: "place", label: tk("Luogo"), icon: "place" },
  { id: "hash", label: tk("Hashtag"), icon: "hash" },
  { id: "product", label: tk("Prodotto"), icon: "product" },
  { id: "link", label: tk("Link"), icon: "link" },
  { id: "emoji", label: tk("Emoji"), icon: "emoji" },
  { id: "poll", label: tk("Sondaggio"), icon: "poll" },
  { id: "ask", label: tk("Domanda"), icon: "ask" },
  { id: "quiz", label: tk("Quiz"), icon: "quiz" },
  { id: "slider", label: tk("Slider"), icon: "slider" },
];

export const STORY_EMOJI = [
  "😀", "😂", "🥰", "😍", "😘", "😊", "😉", "😎", "🤔", "😴", "🔥", "❤️", "✨", "⭐", "💯", "👏", "🙌", "👍", "👎", "💪",
  "🎉", "🥂", "🍷", "☕️", "🍕", "🍝", "🎶", "🎵", "📸", "💫", "🌹", "💎", "🖤", "🤍", "💛", "💚", "💙", "💜", "🌙", "☀️",
];

export const TEXT_FONTS = [
  { id: "classic", label: tk("Classic") },
  { id: "modern", label: tk("Modern") },
  { id: "neon", label: tk("Neon") },
  { id: "type", label: tk("Typewriter") },
  { id: "strong", label: tk("Strong") },
];
export const TEXT_SWATCHES = ["#ffffff", "#111111", "#ff3040", "#ff8a00", "#ffd60a", "#34c759", "#0095f6", "#7c3aed", "#ff5ac8"];

// The web filters are CSS filter chains. React Native renders the same chain on a View
// (Android: all of it; iOS: contrast, saturate, grayscale, hue-rotate, and brightness only darkening),
// so the sepia part becomes a warm tint laid over the photo.
export const STORY_FILTERS = [
  { id: "normal", label: tk("Normale"), css: "", tint: null },
  { id: "alba", label: tk("Alba"), css: "brightness(1.08) contrast(0.92) saturate(1.12)", tint: ["#ffb070", 0.08] },
  { id: "nord", label: tk("Nord"), css: "contrast(1.1) saturate(0.72) brightness(1.05) hue-rotate(-10deg)", tint: ["#9fc8ff", 0.06] },
  { id: "terra", label: tk("Terracotta"), css: "saturate(1.35) contrast(1.05)", tint: ["#c4703c", 0.16] },
  { id: "pastello", label: tk("Pastello"), css: "brightness(1.12) contrast(0.85) saturate(0.85)", tint: ["#ffffff", 0.08] },
  { id: "vivido", label: tk("Vivido"), css: "contrast(1.18) saturate(1.45) brightness(1.02)", tint: null },
  { id: "miele", label: tk("Miele"), css: "saturate(1.2) brightness(1.06) hue-rotate(-8deg)", tint: ["#d9a04a", 0.2] },
  { id: "cinema", label: tk("Cinema"), css: "contrast(1.22) brightness(0.92) saturate(0.7)", tint: ["#a07850", 0.08] },
  { id: "noir", label: tk("Noir"), css: "grayscale(1) contrast(1.25) brightness(0.95)", tint: null },
  { id: "polvere", label: tk("Polvere"), css: "contrast(0.9) brightness(1.05) saturate(0.8)", tint: ["#b89870", 0.22] },
];

export function filterOf(id) {
  return STORY_FILTERS.find((item) => item.id === id) || STORY_FILTERS[0];
}

export const CREATE_GRADIENTS = [
  ["#7c3aed", "#ff2d55"],
  ["#ff8a00", "#ff2d55"],
  ["#0095f6", "#34c759"],
  ["#111111", "#3a3a3c"],
  ["#ff5ac8", "#ffd60a"],
  ["#1d2b64", "#f8cdda"],
];

export const BRUSHES = [
  { id: "pen", label: tk("Penna"), width: 7, alpha: 1 },
  { id: "marker", label: tk("Evidenziatore"), width: 22, alpha: 0.5 },
  { id: "neon", label: tk("Neon"), width: 9, alpha: 1, glow: true },
  { id: "eraser", label: tk("Gomma"), width: 28, alpha: 1, erase: true },
];

// A server story ({ id, media: { url, type }, text, stickers, style, closeFriends, seen, liked … })
// in the shape the renderer reads: image / video / cells / gradient / filter / muted.
// The look chosen in the editor (filter, collage, gradient, mute) travels in `style`.
export function storyFrame(frame) {
  if (!frame) return null;
  if (!frame.media) return frame;
  const style = frame.style || {};
  const video = frame.media.type === "video";
  return {
    ...frame,
    image: video ? style.poster || "" : frame.media.url || "",
    video: video ? frame.media.url || "" : "",
    cells: Array.isArray(style.cells) && style.cells.length ? style.cells : undefined,
    layout: style.layout || undefined,
    gradient: Array.isArray(style.gradient) ? style.gradient : undefined,
    filter: style.filter || "normal",
    muted: Boolean(style.muted),
    close: Boolean(frame.closeFriends),
  };
}

// The first frame not watched yet (or the first one when all are).
export function openFrame(deck) {
  if (!deck) return 0;
  const index = deck.frames.findIndex((frame) => !frame.seen);
  return index < 0 ? 0 : index;
}

// The cover picture of a story frame (photo, or the first collage cell). Videos have none.
export function frameCover(frame) {
  const item = storyFrame(frame);
  return item?.image || item?.cells?.[0] || "";
}

// A server deck ({ handle, name, avatar, mine, seen, frames }) with the fields older screens read.
export function deckCard(deck) {
  return {
    ...deck,
    id: deck.handle,
    full: deck.name || deck.handle,
    src: deck.avatar || "",
    frames: (deck.frames || []).map(storyFrame),
  };
}

// Story decks for Home and the profile: yours first, then the people you follow (server order).
export function useStoryDecks() {
  const { data } = useStories();
  return useMemo(() => (data || []).map(deckCard), [data]);
}

// Someone's highlights (yours when no handle) as decks; `href` opens one in the viewer.
export function useHighlightDecks(handle) {
  const owner = String(handle || myHandle() || "").replace(/^@/, "");
  const { data } = useHighlights(owner || null);
  return useMemo(() => (data || []).filter((item) => item.frames?.length).map((item) => ({
    ...item,
    id: `h:${item.id}`,
    raw: item.id,
    name: item.title,
    src: item.cover || frameCover(item.frames[0]),
    owner,
    highlight: true,
    href: `/story/h:${item.id}?owner=${encodeURIComponent(owner)}`,
    frames: item.frames.map(storyFrame),
  })), [data, owner]);
}

export function mineDeck(decks) {
  return decks[0]?.mine ? decks[0] : null;
}

// ---------------------------------------------------------------------------
// A small PNG of a two-colour vertical gradient, for "Crea" stories: the server stores one
// picture per story, and this is what the rail, highlights and other clients show for them.
// The viewer still draws the real gradient from `style.gradient`.

function hex(color) {
  const value = String(color || "#000").replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function chunk(type, data) {
  const head = [...type].map((c) => c.charCodeAt(0));
  const body = [...head, ...data];
  return [...u32(data.length), ...body, ...u32(crc32(body))];
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64[c & 63];
  }
  return out;
}

// Returns the PNG as base64 (9×16 proportions, small enough to stay a few KB).
export function gradientPng(colors, width = 36, height = 64) {
  const [from, to] = [hex(colors?.[0]), hex(colors?.[1] || colors?.[0])];
  const raw = [];
  for (let y = 0; y < height; y += 1) {
    raw.push(0);
    for (let x = 0; x < width; x += 1) {
      // Mostly top to bottom, slightly diagonal like the on-screen gradient.
      const k = Math.min(1, Math.max(0, (y / (height - 1)) * 0.85 + (x / (width - 1)) * 0.15));
      for (let i = 0; i < 3; i += 1) raw.push(Math.round(from[i] + (to[i] - from[i]) * k));
    }
  }
  // zlib stream with "stored" deflate blocks (no compression needed for a few KB).
  const z = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const block = raw.slice(i, i + 65535);
    const last = i + 65535 >= raw.length ? 1 : 0;
    z.push(last, block.length & 255, block.length >> 8, ~block.length & 255, (~block.length >> 8) & 255, ...block);
  }
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  z.push(...u32(((b << 16) | a) >>> 0));
  const png = [
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk("IHDR", [...u32(width), ...u32(height), 8, 2, 0, 0, 0]),
    ...chunk("IDAT", z),
    ...chunk("IEND", []),
  ];
  return base64(png);
}
