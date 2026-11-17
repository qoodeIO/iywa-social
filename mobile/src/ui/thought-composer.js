// The Pensieri composer: threads, photos, polls, mentions, quotes and replies (web ThoughtComposer).
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle } from "react-native-svg";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR, PEOPLE } from "../data";
import { DEMO_GALLERY, TIME, agoLabel } from "../lib/profile-data";
import { AtSign, Feather, Globe, Hash, ImageIcon, Plus, Poll, Trash, Users, Verified, X } from "./icons-profile";
import { T, tap } from "./kit";
import { ActionSheet } from "./profile-kit";
import { QuotedThought, buildThoughts } from "./thoughts";
import { showToast } from "./feedEcho";
import { keepAll } from "../lib/media-store";
import { t, tk } from "../lib/i18n";

const LIMIT = 500;
const DRAFT_KEY = "space-thought-draft";
const AUDIENCES = ["everyone", "follow", "mention"];
const AUDIENCE_LABEL = {
  everyone: tk("Tutti possono rispondere"),
  follow: tk("Rispondono i profili che segui"),
  mention: tk("Rispondono solo i profili menzionati"),
};

function CounterRing({ used }) {
  const theme = useTheme();
  const left = LIMIT - used;
  if (!used) return null;
  const ratio = Math.min(1, used / LIMIT);
  const r = 9;
  const c = 2 * Math.PI * r;
  const warn = left <= 20;
  const size = warn ? 30 : 24;
  const stroke = left < 0 ? theme.red : warn ? "#ffad1f" : theme.blue;
  return (
    <View style={{ marginLeft: "auto", width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityLabel={`${left}`}>
      <Svg width={size} height={size} viewBox="0 0 24 24" style={[StyleSheet.absoluteFill, { transform: [{ rotate: "-90deg" }] }]}>
        <Circle cx="12" cy="12" r={r} stroke={theme.line} strokeWidth={2.4} fill="none" />
        <Circle cx="12" cy="12" r={r} stroke={stroke} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - ratio)} />
      </Svg>
      {warn ? <T size={9} weight="600" color={left < 0 ? theme.red : theme.text2}>{left}</T> : null}
    </View>
  );
}

export default function ThoughtComposer({ replyId, quoteId }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { byId } = buildThoughts(store);
  const replyTo = replyId ? byId.get(String(replyId)) : null;
  const quote = quoteId ? byId.get(String(quoteId)) : null;
  const plain = !replyTo && !quote;
  const myHandle = String(store.profile.handle || "").replace(/^@/, "");
  const me = store.profile.src || AVATAR;
  const [parts, setParts] = useState([{ id: 0, text: "", images: [] }]);
  const [active, setActive] = useState(0);
  const [poll, setPoll] = useState(null);
  const [audience, setAudience] = useState("everyone");
  const [tray, setTray] = useState(false);
  const [mention, setMention] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const areas = useRef([]);
  const caret = useRef({});
  const nextId = useRef(1);

  // A saved draft comes back when you open a plain new thought.
  useEffect(() => {
    if (!plain) return;
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      const saved = JSON.parse(raw || "null");
      if (Array.isArray(saved) && saved.length) {
        nextId.current = saved.length;
        setParts(saved.map((text, index) => ({ id: index, text, images: [] })));
      }
    }).catch(() => {});
  }, [plain]);

  const filled = parts.some((part) => part.text.trim() || part.images.length);
  const over = parts.some((part) => part.text.length > LIMIT);
  const pollOk = !poll || poll.options.filter((option) => option.trim()).length >= 2;
  const ready = Boolean((filled || (poll && pollOk)) && !over && pollOk && (parts[0].text.trim() || parts[0].images.length || poll));

  function update(index, patch) {
    setParts((prev) => prev.map((part, at) => (at === index ? { ...part, ...patch } : part)));
  }

  function onType(index, value) {
    update(index, { text: value });
    const at = caret.current[index] ?? value.length;
    const before = value.slice(0, Math.min(value.length, at + 1));
    const match = before.match(/(^|\s)@([\w.]*)$/) || value.match(/(^|\s)@([\w.]*)$/);
    setMention(match ? { index, query: match[2].toLowerCase(), at: (match.index || 0) + match[1].length } : null);
  }

  function pickMention(person) {
    if (!mention) return;
    const part = parts[mention.index];
    const before = part.text.slice(0, mention.at);
    const after = part.text.slice(mention.at + 1 + mention.query.length);
    update(mention.index, { text: `${before}@${person.handle} ${after.replace(/^\s/, "")}` });
    setMention(null);
  }

  function insert(text) {
    const part = parts[active];
    const at = caret.current[active] ?? part.text.length;
    const glue = at > 0 && !/\s$/.test(part.text.slice(0, at)) ? " " : "";
    const next = `${part.text.slice(0, at)}${glue}${text}${part.text.slice(at)}`;
    update(active, { text: next });
    caret.current[active] = at + glue.length + text.length;
    if (text === "@") setMention({ index: active, query: "", at: at + glue.length });
    setTimeout(() => areas.current[active]?.focus(), 0);
  }

  function addImages(list) {
    setParts((prev) => prev.map((part, at) => (at === active ? { ...part, images: [...part.images, ...list].slice(0, 4) } : part)));
    setPoll(null);
  }

  async function fromDevice() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 4, quality: 0.8 });
      if (!result.canceled && result.assets?.length) addImages(await keepAll(result.assets.map((asset) => asset.uri)));
    } catch {
      // picker unavailable
    }
    setTray(false);
  }

  function addPart() {
    const id = nextId.current++;
    setParts((prev) => [...prev, { id, text: "", images: [] }]);
    setActive(parts.length);
    setTimeout(() => areas.current[parts.length]?.focus(), 60);
  }

  function removePart(index) {
    setParts((prev) => prev.filter((_, at) => at !== index));
    setActive(Math.max(0, index - 1));
  }

  function close(save) {
    if (plain) {
      if (save && filled) AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(parts.map((part) => part.text))).catch(() => {});
      else AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    }
    setLeaving(false);
    router.back();
  }

  function cancel() {
    if (plain && filled) setLeaving(true);
    else close(false);
  }

  function publish() {
    if (!ready) return;
    tap("medium");
    const now = Date.now();
    const clean = parts.filter((part) => part.text.trim() || part.images.length);
    const [first, ...rest] = clean.length ? clean : [{ text: "", images: [] }];
    const thought = {
      id: `me-${now.toString(36)}`,
      created: now,
      likes: 0,
      reposts: 0,
      text: first.text.trim(),
      images: first.images,
      audience,
      mine: true,
      ...(poll ? { poll: { options: poll.options.filter((option) => option.trim()).map((text) => ({ text: text.trim(), votes: 0 })), endsAt: now + poll.days * TIME.DAY } } : {}),
      ...(quote ? { quote: quote.id } : {}),
      ...(replyTo ? { replyTo: replyTo.handle } : {}),
    };
    const chain = rest.map((part, index) => ({ id: `${thought.id}-c${index}`, created: now + index + 1, likes: 0, text: part.text.trim(), images: part.images, mine: true, chained: true }));
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    if (replyTo) store.addThoughtReply(replyTo.id, thought);
    else {
      store.addThoughtChain(thought, chain);
      echo(store, thought);
    }
    showToast({ text: replyTo ? t("Risposta pubblicata") : t("Pensiero pubblicato") });
    router.back();
  }

  const people = mention ? PEOPLE.filter((person) => !mention.query || person.handle.includes(mention.query) || person.name.toLowerCase().includes(mention.query)).slice(0, 5) : [];
  const AudienceIcon = audience === "everyone" ? Globe : audience === "follow" ? Users : AtSign;
  const lastPart = parts[parts.length - 1];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.bar, { borderBottomColor: theme.line }]}>
        <Pressable onPress={cancel} hitSlop={8} style={{ flex: 1 }}><T size={15.5}>{t("Annulla")}</T></Pressable>
        <T size={16} weight="700">{replyTo ? t("Rispondi") : quote ? t("Cita") : t("Nuovo pensiero")}</T>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}>
        {replyTo ? (
          <View style={styles.part}>
            <View style={styles.side}>
              <Image source={{ uri: replyTo.src || AVATAR }} style={styles.face} />
              <View style={[styles.line, { backgroundColor: theme.line }]} />
            </View>
            <View style={{ flex: 1, paddingBottom: 8 }}>
              <View style={styles.head}><T size={14.5} weight="700">{replyTo.handle}</T><T size={14} color={theme.text3}>{agoLabel(replyTo.created)}</T></View>
              <T size={15} color={theme.text2} style={{ lineHeight: 21, marginTop: 2 }}>{replyTo.text}</T>
            </View>
          </View>
        ) : null}
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          const on = active === index;
          return (
            <Pressable key={part.id} onPress={() => setActive(index)} style={[styles.part, { opacity: on ? 1 : 0.55 }]}>
              <View style={styles.side}>
                <Image source={{ uri: me }} style={styles.face} />
                {!last || part.text.trim() || part.images.length ? <View style={[styles.line, { backgroundColor: theme.line }]} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.head}>
                  <T size={14.5} weight="700">{myHandle}</T>
                  {index > 0 ? <Pressable accessibilityLabel={t("Rimuovi")} hitSlop={8} style={{ marginLeft: "auto" }} onPress={() => removePart(index)}><X size={14} weight="bold" color={theme.text2} /></Pressable> : null}
                </View>
                <TextInput
                  ref={(node) => { areas.current[index] = node; }}
                  multiline
                  autoFocus={index === 0}
                  value={part.text}
                  onChangeText={(value) => onType(index, value)}
                  onSelectionChange={(event) => { caret.current[index] = event.nativeEvent.selection.start; }}
                  onFocus={() => setActive(index)}
                  placeholder={index === 0 ? (replyTo ? t("Rispondi a {handle}…", { handle: replyTo.handle }) : t("Cosa c'è di nuovo?")) : t("Aggiungi altro…")}
                  placeholderTextColor={theme.text3}
                  accessibilityLabel={t("Testo del pensiero")}
                  style={{ color: theme.text, fontSize: 15.5, lineHeight: 22, minHeight: 24, marginTop: 2, padding: 0 }}
                />
                {mention && mention.index === index && people.length ? (
                  <View style={[styles.mentions, { backgroundColor: theme.scheme === "dark" ? "#1c1c1e" : "#fff", borderColor: theme.line }]}>
                    {people.map((person) => (
                      <Pressable key={person.handle} onPress={() => pickMention(person)} style={({ pressed }) => [styles.mentionRow, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
                        <Image source={{ uri: person.src }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><T size={14} weight="600">{person.handle}</T>{person.verified ? <Verified size={13} weight="fill" color={theme.blue} /> : null}</View>
                          <T size={13} color={theme.text2}>{person.name}</T>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {part.images.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 10 }}>
                    {part.images.map((src, at) => (
                      <View key={`${at}-${String(src).slice(-16)}`} style={[styles.image, part.images.length === 1 ? { width: 230, height: 260 } : null]}>
                        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        <Pressable accessibilityLabel={t("Rimuovi foto")} onPress={() => update(index, { images: part.images.filter((_, i) => i !== at) })} style={styles.imageX}><X size={12} weight="bold" color="#fff" /></Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
                {index === 0 && poll ? (
                  <View style={{ gap: 7, marginTop: 10 }}>
                    {poll.options.map((option, at) => (
                      <View key={at} style={[styles.pollRow, { borderColor: theme.line }]}>
                        <TextInput
                          value={option}
                          maxLength={40}
                          placeholder={at < 2 ? t("Opzione {n}", { n: at + 1 }) : t("Facoltativa")}
                          placeholderTextColor={theme.text3}
                          onChangeText={(value) => setPoll((prev) => ({ ...prev, options: prev.options.map((item, i) => (i === at ? value : item)) }))}
                          style={{ flex: 1, height: "100%", color: theme.text, fontSize: 14.5 }}
                        />
                        {at >= 2 ? <Pressable accessibilityLabel={t("Rimuovi opzione")} hitSlop={6} style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }} onPress={() => setPoll((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== at) }))}><X size={14} weight="bold" color={theme.text2} /></Pressable> : null}
                      </View>
                    ))}
                    {poll.options.length < 4 ? (
                      <Pressable onPress={() => setPoll((prev) => ({ ...prev, options: [...prev.options, ""] }))} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 4 }}>
                        <Plus size={15} weight="bold" color={theme.blue} /><T size={14} weight="600" color={theme.blue}>{t("Aggiungi opzione")}</T>
                      </Pressable>
                    ) : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <T size={13} color={theme.text2}>{t("Termina tra")}</T>
                      {[1, 3, 7].map((days) => {
                        const sel = poll.days === days;
                        return (
                          <Pressable key={days} onPress={() => setPoll((prev) => ({ ...prev, days }))} style={[styles.dayChip, { borderColor: sel ? theme.text : theme.line, backgroundColor: sel ? theme.text : "transparent" }]}>
                            <T size={13} weight="600" color={sel ? theme.bg : theme.text}>{days === 1 ? t("1 giorno") : t("{n} giorni", { n: days })}</T>
                          </Pressable>
                        );
                      })}
                      <Pressable onPress={() => setPoll(null)} style={{ paddingHorizontal: 4 }}><T size={13} weight="600" color={theme.red}>{t("Rimuovi sondaggio")}</T></Pressable>
                    </View>
                  </View>
                ) : null}
                {index === 0 && quote ? <QuotedThought thought={quote} /> : null}
                {on ? (
                  <View style={styles.tools}>
                    <Tool label={t("Aggiungi foto")} icon={ImageIcon} pressed={tray} disabled={part.images.length >= 4} onPress={() => setTray((value) => !value)} />
                    <Tool label={t("Menziona")} icon={AtSign} onPress={() => insert("@")} />
                    <Tool label={t("Hashtag")} icon={Hash} onPress={() => insert("#")} />
                    {index === 0 && !replyTo ? <Tool label={t("Sondaggio")} icon={Poll} pressed={Boolean(poll)} disabled={part.images.length > 0} onPress={() => setPoll((prev) => (prev ? null : { options: ["", ""], days: 1 }))} /> : null}
                    <CounterRing used={part.text.length} />
                  </View>
                ) : null}
                {on && tray ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginRight: -INSET, marginTop: 4, marginBottom: 6 }} contentContainerStyle={{ gap: 6, paddingRight: INSET }}>
                    <Pressable onPress={fromDevice} style={[styles.trayItem, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center", gap: 4 }]}>
                      <ImageIcon size={22} color={theme.text} /><T size={11.5} weight="600">{t("Libreria")}</T>
                    </Pressable>
                    {DEMO_GALLERY.slice(0, 10).map((src) => (
                      <Pressable key={src} onPress={() => { addImages([src]); setTray(false); }} style={({ pressed }) => [styles.trayItem, { backgroundColor: theme.fill, opacity: pressed ? 0.8 : 1 }]}>
                        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {!replyTo && (lastPart.text.trim() || lastPart.images.length) && parts.length < 10 ? (
          <Pressable onPress={addPart} style={styles.add}>
            <View style={{ width: 40, alignItems: "center" }}><Image source={{ uri: me }} style={{ width: 22, height: 22, borderRadius: 11, opacity: 0.6 }} /></View>
            <T size={14.5} color={theme.text3}>{t("Aggiungi al thread")}</T>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={[styles.foot, { borderTopColor: theme.line, backgroundColor: theme.bg, paddingBottom: 14 + (Platform.OS === "ios" ? 0 : insets.bottom) }]}>
        <Pressable style={styles.audience} onPress={() => { tap(); setAudience((value) => AUDIENCES[(AUDIENCES.indexOf(value) + 1) % AUDIENCES.length]); }}>
          <AudienceIcon size={16} color={theme.text2} />
          <T size={13.5} color={theme.text2} lines={1} style={{ flexShrink: 1 }}>{t(AUDIENCE_LABEL[audience])}</T>
        </Pressable>
        <Pressable disabled={!ready} onPress={publish} style={({ pressed }) => [styles.post, { backgroundColor: theme.text, opacity: ready ? (pressed ? 0.8 : 1) : 0.35 }]}>
          <T size={15} weight="700" color={theme.bg}>{replyTo ? t("Rispondi") : t("Pubblica")}</T>
        </Pressable>
      </View>
      <ActionSheet
        open={leaving}
        onClose={() => setLeaving(false)}
        cancel={t("Continua a scrivere")}
        items={[
          { icon: Feather, label: t("Salva bozza"), onPress: () => close(true) },
          { icon: Trash, label: t("Elimina"), danger: true, onPress: () => close(false) },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

function Tool({ icon: Icon, label, pressed, disabled, onPress }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityLabel={label} accessibilityState={{ selected: Boolean(pressed), disabled: Boolean(disabled) }} disabled={disabled} onPress={() => { tap(); onPress(); }} style={({ pressed: down }) => [styles.tool, { opacity: disabled ? 0.35 : 1, backgroundColor: down ? theme.fill : "transparent", transform: [{ scale: down ? 0.88 : 1 }] }]}>
      <Icon size={20} color={pressed ? theme.blue : theme.text2} />
    </Pressable>
  );
}

// The demo answers like the web app: a like after a few seconds, and a reply from anyone mentioned.
function echo(store, thought) {
  const fans = PEOPLE.filter((person) => !store.prefs.blocked?.includes(person.name));
  const fan = fans[Math.floor(Math.random() * fans.length)];
  if (fan && store.pushNote) setTimeout(() => store.pushNote({ type: "like", name: fan.name, src: fan.src, text: t("ha messo mi piace al tuo pensiero."), target: { kind: "thought", id: thought.id } }), 5000);
  const handles = (String(thought.text || "").match(/@[\w.]+/g) || []).map((item) => item.slice(1).replace(/\.$/, ""));
  for (const person of PEOPLE.filter((entry) => handles.includes(entry.handle))) {
    setTimeout(() => {
      const text = t("Ci sono! Grazie per la menzione 🙌");
      store.addThoughtReply(thought.id, { id: `echo-${Date.now().toString(36)}-${person.handle}`, name: person.name, handle: person.handle, src: person.src, verified: Boolean(person.verified), created: Date.now(), likes: 0, text });
      store.pushNote?.({ type: "reply", name: person.name, src: person.src, text: t("ha risposto al tuo pensiero: “{text}”", { text }), target: { kind: "thought", id: thought.id } });
    }, 8000);
  }
}

const styles = StyleSheet.create({
  bar: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  part: { flexDirection: "row", gap: 12, paddingTop: 8, paddingHorizontal: INSET },
  side: { width: 40, alignItems: "center" },
  face: { width: 38, height: 38, borderRadius: 19 },
  line: { flex: 1, width: 2, minHeight: 18, marginTop: 6, marginBottom: -2, borderRadius: 99 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 },
  mentions: { marginVertical: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  mentionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  image: { width: 150, height: 190, borderRadius: 12, overflow: "hidden" },
  imageX: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  pollRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingLeft: 14, paddingRight: 6, borderRadius: 12, borderWidth: 1 },
  dayChip: { height: 28, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tools: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, marginBottom: 4, marginLeft: -6 },
  tool: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  trayItem: { width: 72, height: 92, borderRadius: 10, overflow: "hidden" },
  add: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: INSET },
  foot: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, paddingHorizontal: INSET, borderTopWidth: StyleSheet.hairlineWidth },
  audience: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  post: { height: 36, paddingHorizontal: 18, borderRadius: 99, alignItems: "center", justifyContent: "center" },
});
