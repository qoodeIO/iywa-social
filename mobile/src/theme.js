import { useColorScheme } from "react-native";
import { useAppearance } from "./lib/store";

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

export function useTheme() {
  const system = useColorScheme();
  const choice = useAppearance() || system;
  return choice === "dark" ? dark : light;
}

export const TAB_HEIGHT = 50;
export const INSET = 16;
