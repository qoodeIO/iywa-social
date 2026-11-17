import { useColorScheme } from "react-native";
import { useAccentChoice, useAppearance } from "./lib/store";
import { tk } from "./lib/i18n";

// Same palette as the web app (Instagram-like): white or black, gray buttons, blue actions.
export const light = {
  scheme: "light",
  bg: "#ffffff",
  text: "#000000",
  text2: "#737373",
  text3: "#c7c7c7",
  fill: "#efefef",
  card: "#f4f4f5",
  btn: "#efefef",
  line: "#dbdbdb",
  blue: "#0095f6",
  red: "#ff3040",
  green: "#1cb14a",
  star: "#ffb400",
  scrim: "rgba(0,0,0,0.42)",
};

export const dark = {
  scheme: "dark",
  bg: "#000000",
  text: "#f5f5f5",
  text2: "#a8a8a8",
  text3: "#555555",
  fill: "#262626",
  card: "#1c1c1e",
  btn: "#363636",
  line: "#262626",
  blue: "#0095f6",
  red: "#ff3040",
  green: "#2ecc5f",
  star: "#ffb400",
  scrim: "rgba(0,0,0,0.6)",
};

// Accent colours (web THEMES). "default" keeps the original blue; `ink` is the text drawn on it.
export const ACCENTS = [
  { id: "default", label: tk("Predefinito"), color: "#0095f6", ink: "#ffffff" },
  { id: "space", label: "iywa", color: "#7c3aed", ink: "#ffffff" },
  { id: "rosso", label: tk("Rosso"), color: "#ff403a", ink: "#ffffff" },
  { id: "arancio", label: tk("Arancio"), color: "#ff9500", ink: "#2a1800" },
  { id: "giallo", label: tk("Giallo"), color: "#ffd60a", ink: "#2a2000" },
  { id: "verde", label: tk("Verde"), color: "#30d158", ink: "#062810" },
  { id: "teal", label: tk("Teal"), color: "#20d2c6", ink: "#002422" },
  { id: "blu", label: tk("Blu"), color: "#0a84ff", ink: "#ffffff" },
  { id: "viola", label: tk("Viola"), color: "#bf5af2", ink: "#ffffff" },
  { id: "rosa", label: tk("Rosa"), color: "#ff3778", ink: "#ffffff" },
];

const themed = new Map();

// `blue` is the app's accent everywhere (links, primary buttons, active states), so it follows
// the chosen accent; `accent`/`accentInk` name it explicitly for new code.
function withAccent(base, id) {
  const key = `${base.scheme}:${id}`;
  let theme = themed.get(key);
  if (!theme) {
    const accent = ACCENTS.find((item) => item.id === id) || ACCENTS[0];
    theme = { ...base, blue: accent.color, accent: accent.color, accentInk: accent.ink };
    themed.set(key, theme);
  }
  return theme;
}

export function useTheme() {
  const system = useColorScheme();
  const choice = useAppearance() || system;
  const accent = useAccentChoice();
  return withAccent(choice === "dark" ? dark : light, accent);
}

export const TAB_HEIGHT = 50;
export const INSET = 16;
