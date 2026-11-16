import { useMemo } from "react";
import seed from "../data/seed.json";
import { HIGHLIGHTS, STORY_DECKS } from "../data";
import { useStore } from "./store";
import { t, tk } from "./i18n";

// Story constants, copied from the web app (StoryCamera, StoryViewer, HighlightNew).
export const STORY_MS = 5200;
export const MAX_CLIP = 15;
export const STORY_REACTIONS = ["😂", "😮", "😍", "😢", "👏", "🔥", "🎉", "💯"];

export const STORY_KIT = [
  { id: "music", label: tk("Musica"), icon: "music" },
  { id: "place", label: tk("Luogo"), icon: "place" },
  { id: "tag", label: tk("Tag"), icon: "tag" },
  { id: "product", label: tk("Prodotto"), icon: "product" },
  { id: "hash", label: tk("Hashtag"), icon: "hash" },
  { id: "emoji", label: tk("Emoji"), icon: "emoji" },
  { id: "gif", label: tk("GIF"), icon: "emoji" },
  { id: "poll", label: tk("Sondaggio"), icon: "poll" },
  { id: "ask", label: tk("Domanda"), icon: "ask" },
  { id: "quiz", label: tk("Quiz"), icon: "quiz" },
  { id: "slider", label: tk("Slider"), icon: "slider" },
  { id: "link", label: tk("Link"), icon: "link" },
  { id: "count", label: tk("Countdown"), icon: "count" },
  { id: "yours", label: tk("Aggiungi"), icon: "yours" },
  { id: "notify", label: tk("Notifiche"), icon: "notify" },
];

export const STORY_MUSIC = [
  { title: "Forno lento", artist: "Giulia Neri" },
  { title: "Rosso di Prato", artist: "Adele Romano" },
  { title: "Impasto", artist: "Marta Colle" },
  { title: "Secondo fuoco", artist: "Leo Bassi" },
];
export const STORY_PLACES = seed.STORY_PLACES || ["Milano", "Torino", "Prato", "Cremona", "Bologna", "Firenze", "Roma", "Napoli", "Venezia", "Faenza", "Padova", "Genova"];
export const STORY_EMOJI = seed.STORY_EMOJI || ["😀", "😂", "🥰", "😍", "🔥", "❤️", "✨", "🎉"];
export const STORY_HASH = seed.STORY_HASH || ["forno", "rosso", "ceramica"];
export const STORY_GIFS = [
  { label: "FORNO", tone: "hot" },
  { label: "LENTO", tone: "slow" },
  { label: "ROSSO", tone: "red" },
];
export const GIF_TONES = { hot: "#ffb020", slow: "#9ad7ff", red: "#ff4d4d" };

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

export function openFrame(deck, seen) {
  if (!deck) return 0;
  const index = deck.frames.findIndex((frame) => !seen.includes(frame.id));
  return index < 0 ? 0 : index;
}

// The cover picture of a story frame (photo, poster or the first collage cell).
export function frameCover(frame) {
  return frame?.image || frame?.cells?.[0] || "";
}

// Story decks for Home, the viewer and the profile: yours first, then the people you follow.
export function useStoryDecks() {
  const store = useStore();
  const { myStories, hiddenStories, prefs, profile } = store;
  return useMemo(() => {
    const hidden = new Set(hiddenStories || []);
    const blocked = new Set([...(prefs?.blocked || []), ...(prefs?.muted || [])]);
    const mine = (myStories || []).filter((frame) => !hidden.has(frame.id));
    return [
      ...(mine.length ? [{ id: "you", name: t("La tua"), full: profile.name, src: profile.src, mine: true, frames: mine }] : []),
      ...STORY_DECKS
        .map((deck) => ({ ...deck, frames: deck.frames.filter((frame) => !hidden.has(frame.id)) }))
        .filter((deck) => deck.frames.length && !blocked.has(deck.full || deck.name)),
    ];
  }, [myStories, hiddenStories, prefs?.blocked, prefs?.muted, profile.name, profile.src]);
}

export function useHighlightDecks() {
  const store = useStore();
  const { highlights, hiddenStories, profile } = store;
  return useMemo(() => {
    const hidden = new Set(hiddenStories || []);
    return [...(highlights || []), ...HIGHLIGHTS]
      .map((item) => ({ ...item, id: `hl-${item.id}`, raw: item.id, src: item.src || profile.src, highlight: true, frames: item.frames.filter((frame) => !hidden.has(frame.id)) }))
      .filter((item) => item.frames.length);
  }, [highlights, hiddenStories, profile.src]);
}

export function mineDeck(decks) {
  return decks[0]?.mine ? decks[0] : null;
}
