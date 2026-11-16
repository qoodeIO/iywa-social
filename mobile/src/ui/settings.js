import { Pressable, StyleSheet, View } from "react-native";
import { INSET, useTheme } from "../theme";
import { LANGS, t, tk } from "../lib/i18n";
import {
  Archive, At, Bell, BellOff, Bookmark, Box, Brush, Chart, ChatDots, ChatText, Check, ChevronRight, Download, Eye, EyeOff,
  Globe, Hand, Help, Info, Lock, PriceTag, Settings, Sparkle, Star, Store, TextT, Timer, User, Users,
} from "./icons";
import { T, Toggle, tap } from "./kit";

// The same groups and rows as "Impostazioni e privacy" in the web app.
export const SETTING_GROUPS = [
  { title: tk("Il tuo account"), rows: [
    { id: "edit", label: tk("Modifica profilo"), meta: tk("Nome, handle, bio") },
    { id: "login", label: tk("Account"), meta: tk("Su questo telefono") },
  ] },
  { title: tk("Come usi iywa"), rows: [
    { id: "saved", label: tk("Salvati"), meta: tk("Post e reel") },
    { id: "archive", label: tk("Archivio"), meta: tk("Storie e post nascosti") },
    { id: "activity", label: tk("La tua attività"), meta: tk("Tempo, like, ricerche") },
    { id: "notifications", label: tk("Notifiche"), meta: tk("Like, commenti, follow") },
    { id: "time", label: tk("Tempo di utilizzo"), meta: tk("Limite giornaliero") },
  ] },
  { title: tk("Chi può vedere i tuoi contenuti"), rows: [
    { id: "privacy", label: tk("Privacy dell'account"), meta: tk("Pubblico o privato") },
    { id: "close", label: tk("Amici più stretti"), meta: tk("Storie solo per loro") },
    { id: "blocked", label: tk("Bloccati"), meta: tk("Chi non può trovarti") },
  ] },
  { title: tk("Come gli altri interagiscono con te"), rows: [
    { id: "messages", label: tk("Messaggi e risposte alle storie"), meta: tk("Chi può scriverti") },
    { id: "tags", label: tk("Tag e menzioni"), meta: tk("Chi può taggarti") },
    { id: "comments", label: tk("Commenti"), meta: tk("Chi può commentare") },
    { id: "words", label: tk("Parole nascoste"), meta: tk("Filtra commenti e richieste") },
    { id: "restricted", label: tk("Limitati"), meta: tk("Commenti che vedi solo tu") },
  ] },
  { title: tk("Cosa vedi"), rows: [
    { id: "muted", label: tk("Account silenziati"), meta: tk("Nascondi i loro post") },
    { id: "content", label: tk("Preferenze sui contenuti"), meta: tk("Contenuti sensibili, suggerimenti") },
  ] },
  { title: tk("App e media"), rows: [
    { id: "theme", label: tk("Aspetto"), meta: tk("Chiaro, scuro o automatico") },
    { id: "language", label: tk("Lingua"), meta: tk("Lingua dell'app") },
    { id: "accessibility", label: tk("Accessibilità"), meta: tk("Sottotitoli e testo alternativo") },
    { id: "data", label: tk("Uso dei dati"), meta: tk("Risparmio dati") },
  ] },
  { title: tk("Per i professionisti"), rows: [
    { id: "account-type", label: tk("Tipo di account e shop"), meta: tk("Personale, creator o azienda") },
    { id: "payments", label: tk("Pagamenti"), meta: tk("Vendite e versamenti") },
    { id: "orders", label: tk("Ordini"), meta: tk("Acquisti e vendite") },
  ] },
  { title: tk("Info e assistenza"), rows: [
    { id: "help", label: tk("Assistenza"), meta: tk("Risposte") },
    { id: "privacy-policy", label: tk("Privacy Policy"), meta: tk("Come iywa tratta i tuoi dati") },
    { id: "terms", label: tk("Termini di utilizzo"), meta: tk("Le regole dell'anteprima") },
    { id: "about", label: tk("Informazioni"), meta: tk("Versione dell'app") },
  ] },
];

const TONES = {
  blue: "#0a84ff", indigo: "#5e5ce6", purple: "#bf5af2", brown: "#a2845e", teal: "#30b0c7", red: "#ff3b30",
  gray: "#8e8e93", green: "#34c759", orange: "#ff9500", pink: "#ff2d55", cyan: "#32ade6", yellow: "#ffb300",
};

const ICONS = {
  edit: [User, "blue"], login: [Users, "indigo"], saved: [Bookmark, "purple"], archive: [Archive, "brown"],
  activity: [Chart, "teal"], notifications: [Bell, "red"], time: [Timer, "indigo"], privacy: [Lock, "gray"],
  close: [Star, "green"], blocked: [EyeOff, "red"], messages: [ChatDots, "blue"], tags: [At, "orange"],
  comments: [ChatText, "teal"], words: [TextT, "gray"], restricted: [Hand, "orange"], muted: [BellOff, "gray"],
  content: [Sparkle, "pink"], theme: [Brush, "purple"], language: [Globe, "cyan"], accessibility: [Eye, "blue"],
  data: [Download, "green"], "account-type": [Store, "yellow"], payments: [PriceTag, "green"], orders: [Box, "brown"],
  help: [Help, "blue"], "privacy-policy": [Lock, "gray"], terms: [TextT, "gray"], about: [Info, "gray"],
};

export function rowById(id) {
  for (const group of SETTING_GROUPS) {
    const row = group.rows.find((item) => item.id === id);
    if (row) return row;
  }
  return null;
}

export function SettingIcon({ id, size = 30 }) {
  const [Icon, tone] = ICONS[id] || [Settings, "gray"];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: TONES[tone], alignItems: "center", justifyContent: "center" }}>
      <Icon size={size * 0.6} weight="fill" color="#fff" />
    </View>
  );
}

export function settingValue(id, store) {
  const prefs = store.prefs;
  const count = (list) => (list?.length ? String(list.length) : "");
  switch (id) {
    case "privacy": return prefs.private ? t("Privato") : t("Pubblico");
    case "notifications": {
      const on = Object.values(prefs.notes || {}).filter(Boolean).length;
      return on ? t("{n} attive", { n: on }) : t("Spente");
    }
    case "time": return prefs.timeLimit === "off" ? t("Spento") : prefs.timeLimit === "60" ? t("1 h") : t("{n} min", { n: prefs.timeLimit });
    case "close": return count(prefs.closeFriends);
    case "blocked": return count(prefs.blocked);
    case "muted": return count(prefs.muted);
    case "restricted": return count(prefs.restricted);
    case "words": return count(prefs.hiddenWords);
    case "saved": return count(store.saves);
    case "data": return prefs.dataSaver ? t("Attivo") : t("Spento");
    case "theme": return prefs.appearance === "light" ? t("Chiaro") : prefs.appearance === "dark" ? t("Scuro") : t("Automatico");
    case "language": return LANGS.find((lang) => lang.id === store.language)?.label || "";
    case "account-type": return store.accountType === "creator" ? t("Creator") : store.accountType === "business" ? t("Azienda") : t("Personale");
    case "orders": return count(store.orders);
    default: return "";
  }
}

// A rounded group of rows, like the web app's st-card.
export function Card({ children, style }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card }, style]}>{children}</View>;
}

export function Kicker({ children }) {
  const theme = useTheme();
  return <T size={13} weight="600" color={theme.text2} style={styles.kicker}>{children}</T>;
}

export function Divider({ inset = 16 }) {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line, marginLeft: inset }} />;
}

export function Row({ icon, label, meta, value, onPress, right, chevron = true, first }) {
  const theme = useTheme();
  return (
    <>
      {first ? null : <Divider inset={icon ? 60 : 16} />}
      <Pressable onPress={onPress ? () => { tap(); onPress(); } : undefined} style={({ pressed }) => [styles.row, pressed && onPress ? { backgroundColor: theme.fill } : null]}>
        {icon}
        <View style={{ flex: 1, gap: 1 }}>
          <T size={15.5}>{label}</T>
          {meta ? <T size={12.5} color={theme.text2}>{meta}</T> : null}
        </View>
        {value ? <T size={14} color={theme.text2}>{value}</T> : null}
        {right}
        {chevron && onPress && !right ? <ChevronRight size={14} weight="bold" color={theme.text3} /> : null}
      </Pressable>
    </>
  );
}

export function ToggleRow({ on, label, meta, onPress, first }) {
  return <Row first={first} label={label} meta={meta} onPress={onPress} right={<Toggle on={on} />} />;
}

export function Pick({ on }) {
  const theme = useTheme();
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 1.5, borderColor: theme.text3, backgroundColor: on ? theme.blue : "transparent", alignItems: "center", justifyContent: "center" }}>
      {on ? <Check size={14} weight="bold" color="#fff" /> : null}
    </View>
  );
}

export function ChoiceList({ value, options, onPick }) {
  return (
    <Card>
      {options.map((option, index) => (
        <Row key={option.id} first={index === 0} label={option.label} meta={option.meta} onPress={() => onPick(option.id)} right={<Pick on={value === option.id} />} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: INSET, borderRadius: 14, overflow: "hidden" },
  kicker: { paddingHorizontal: INSET + 4, paddingTop: 22, paddingBottom: 7 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, minHeight: 50, paddingVertical: 10 },
});
