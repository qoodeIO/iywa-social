import { I18nManager } from "react-native";
import { getLocales } from "expo-localization";
import { DICTS } from "../i18n";

// The app is written in Italian: every UI string is wrapped in t("…") and the
// Italian text is the key. src/i18n/<id>.json maps it to each language.
// `npm run i18n` lists every key in src/i18n/keys.json.

export const LANGS = [
  { id: "it", label: "Italiano", en: "Italian" },
  { id: "en", label: "English", en: "English" },
  { id: "es", label: "Español", en: "Spanish" },
  { id: "fr", label: "Français", en: "French" },
  { id: "de", label: "Deutsch", en: "German" },
  { id: "pt", label: "Português", en: "Portuguese" },
  { id: "nl", label: "Nederlands", en: "Dutch" },
  { id: "sv", label: "Svenska", en: "Swedish" },
  { id: "da", label: "Dansk", en: "Danish" },
  { id: "nb", label: "Norsk", en: "Norwegian" },
  { id: "fi", label: "Suomi", en: "Finnish" },
  { id: "pl", label: "Polski", en: "Polish" },
  { id: "cs", label: "Čeština", en: "Czech" },
  { id: "sk", label: "Slovenčina", en: "Slovak" },
  { id: "hu", label: "Magyar", en: "Hungarian" },
  { id: "ro", label: "Română", en: "Romanian" },
  { id: "hr", label: "Hrvatski", en: "Croatian" },
  { id: "el", label: "Ελληνικά", en: "Greek" },
  { id: "tr", label: "Türkçe", en: "Turkish" },
  { id: "ru", label: "Русский", en: "Russian" },
  { id: "uk", label: "Українська", en: "Ukrainian" },
  { id: "ar", label: "العربية", en: "Arabic", rtl: true },
  { id: "he", label: "עברית", en: "Hebrew", rtl: true },
  { id: "hi", label: "हिन्दी", en: "Hindi" },
  { id: "id", label: "Bahasa Indonesia", en: "Indonesian" },
  { id: "ms", label: "Bahasa Melayu", en: "Malay" },
  { id: "th", label: "ไทย", en: "Thai" },
  { id: "vi", label: "Tiếng Việt", en: "Vietnamese" },
  { id: "ja", label: "日本語", en: "Japanese" },
  { id: "ko", label: "한국어", en: "Korean" },
  { id: "zh-Hans", label: "简体中文", en: "Chinese (Simplified)" },
  { id: "zh-Hant", label: "繁體中文", en: "Chinese (Traditional)" },
];

const IDS = new Set(LANGS.map((lang) => lang.id));

// The phone's own language, mapped to one we ship; English when we don't have it.
export function deviceLanguage() {
  try {
    for (const locale of getLocales()) {
      const code = (locale.languageCode || "").toLowerCase();
      if (code === "zh") {
        const tag = locale.languageTag || "";
        return /Hant|TW|HK|MO/i.test(tag) || /^(TW|HK|MO)$/.test(locale.regionCode || "") ? "zh-Hant" : "zh-Hans";
      }
      if (code === "no" || code === "nn") return "nb";
      if (code === "iw") return "he";
      if (code === "in") return "id";
      if (IDS.has(code)) return code;
    }
  } catch {}
  return "en";
}

// "auto" (the default) follows the phone.
export function resolveLanguage(choice) {
  return choice && choice !== "auto" && IDS.has(choice) ? choice : deviceLanguage();
}

let current = "it";
let dict = null;

export function setLanguage(id) {
  current = IDS.has(id) ? id : "en";
  dict = current === "it" ? null : DICTS[current] || null;
}

export function currentLanguage() {
  return current;
}

export function isRTL(id = current) {
  return Boolean(LANGS.find((lang) => lang.id === id)?.rtl);
}

// Lays the app out right-to-left for Arabic and Hebrew. iOS applies it on the next launch.
// Returns true when a restart is needed.
export function applyDirection(id = current) {
  const rtl = isRTL(id);
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true;
}

// t("Ciao {name}", { name }) → the current language, with {placeholders} filled in.
export function t(text, vars) {
  let out = text;
  if (dict) {
    const hit = dict[text];
    if (typeof hit === "string" && hit) out = hit;
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, key) => (vars[key] == null ? match : String(vars[key])));
  return out;
}

// BCP-47 tag for Intl number and date formatting.
export function localeTag() {
  return current;
}

// Marks a string for translation without translating it yet: use it in constants
// defined at module load, then call t(value) where the text is shown.
export function tk(text) {
  return text;
}

// Narrow weekday letter in the current language; day 0 is Sunday.
export function weekdayLetter(day) {
  const date = new Date(Date.UTC(2024, 0, 7 + day, 12));
  try {
    return new Intl.DateTimeFormat(current, { weekday: "narrow", timeZone: "UTC" }).format(date);
  } catch {
    return ["D", "L", "M", "M", "G", "V", "S"][day];
  }
}
