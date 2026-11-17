// The Pensieri composer: a thought (or a thread of several), photos, a poll, mentions and replies.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle } from "react-native-svg";
import { INSET, useTheme } from "../theme";
import { createPost, usePost, useSearch } from "../lib/social";
import { useMe } from "../lib/session";
import { errorText } from "../lib/api";
import { AtSign, Feather, Hash, ImageIcon, Plus, Poll, Trash, Verified, X } from "./icons-profile";
import { T, tap } from "./kit";
import { ActionSheet } from "./profile-kit";
import { Face, QuotedThought } from "./thoughts";
import { showToast } from "./feedEcho";
import { t } from "../lib/i18n";

const LIMIT = 500;
const MAX_PHOTOS = 4;
const MAX_PARTS = 10;
const DRAFT_KEY = "space-thought-draft";
const HOUR = 3_600_000;
const DURATIONS = [[HOUR, "1 ora"], [24 * HOUR, "1 giorno"], [3 * 24 * HOUR, "3 giorni"], [7 * 24 * HOUR, "7 giorni"]];

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

// replyId: answer that thought. quoteId: start a new thought that links to that one.
export default function ThoughtComposer({ replyId, quoteId }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const reply = usePost(replyId ? String(replyId) : null);
  const replyTo = replyId ? reply.data?.post : null;
  const plain = !replyId && !quoteId;
  const [parts, setParts] = useState(() => [{ id: 0, text: quoteId ? `\nhttps://iywa.app/t/${quoteId}` : "", images: [] }]);
  const [active, setActive] = useState(0);
  const [poll, setPoll] = useState(null);
  const [mention, setMention] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(null); // { step, of, progress }
  const [failure, setFailure] = useState("");
  // After a partial failure: the last published part, so the rest continues the thread.
  const [resumeFrom, setResumeFrom] = useState(null);
  const areas = useRef([]);
  const caret = useRef({});
  const nextId = useRef(1);
  const found = useSearch(mention?.query || "");

  // A saved draft comes back when you open a plain new thought.
  useEffect(() => {
    if (!plain) return;
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      const saved = JSON.parse(raw || "null");
      if (Array.isArray(saved) && saved.length) {
        nextId.current = saved.length;
        setParts(saved.map((text, index) => ({ id: index, text: String(text || ""), images: [] })));
      }
    }).catch(() => {});
  }, [plain]);

  const filled = parts.some((part) => part.text.trim() || part.images.length);
  const over = parts.some((part) => part.text.length > LIMIT);
  const pollOk = !poll || poll.options.filter((option) => option.trim()).length >= 2;
  const ready = Boolean(!busy && !over && pollOk && (parts[0].text.trim() || parts[0].images.length || poll) && (!replyId || replyTo));

  function update(index, patch) {
    setParts((prev) => prev.map((part, at) => (at === index ? { ...part, ...patch } : part)));
  }

  function onType(index, value) {
    update(index, { text: value });
    setFailure("");
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

  async function pickPhotos() {
    const room = MAX_PHOTOS - parts[active].images.length;
    if (room <= 0) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,  mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets.map((asset) => ({ uri: asset.uri, mime: asset.mimeType || undefined, w: asset.width, h: asset.height }));
      const index = active;
      setParts((prev) => prev.map((part, at) => (at === index ? { ...part, images: [...part.images, ...picked].slice(0, MAX_PHOTOS) } : part)));
      if (index === 0) setPoll(null);
    } catch {
      showToast({ text: t("Non è stato possibile aprire le foto.") });
    }
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
    if (busy) return;
    if (plain && filled) setLeaving(true);
    else close(false);
  }

  // Posts the parts one after another, each as a reply to the one before. If one fails, the
  // parts already published leave the editor and the rest stay, ready to retry.
  async function publish() {
    if (!ready) return;
    tap("medium");
    setFailure("");
    setMention(null);
    const queue = parts.filter((part, index) => index === 0 || part.text.trim() || part.images.length);
    const start = replyId ? String(replyId) : null;
    let parent = resumeFrom || start;
    let first = null;
    for (let i = 0; i < queue.length; i += 1) {
      const part = queue[i];
      setBusy({ step: i + 1, of: queue.length, progress: 0 });
      try {
        const post = await createPost({
          kind: "thought",
          text: part.text.trim(),
          media: part.images.map((image) => ({ uri: image.uri, mime: image.mime, type: "image", w: image.w, h: image.h })),
          poll: i === 0 && poll && !resumeFrom ? { options: poll.options.map((option) => option.trim()).filter(Boolean), durationMs: poll.duration } : undefined,
          parent: parent || undefined,
          onProgress: (progress) => setBusy({ step: i + 1, of: queue.length, progress }),
        });
        first = first || post;
        parent = post.id;
      } catch (error) {
        const left = queue.slice(i);
        setParts(left);
        setResumeFrom(parent !== start ? parent : null);
        setActive(0);
        if (i > 0) setPoll(null);
        setBusy(null);
        setFailure(errorText(error, t));
        return;
      }
    }
    if (plain) AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    setBusy(null);
    showToast({ text: replyId ? t("Risposta pubblicata") : t("Pensiero pubblicato") });
    router.back();
  }

  const people = mention && mention.query ? (found.data?.people || []).slice(0, 5) : [];
  const lastPart = parts[parts.length - 1];
  const myHandle = me?.handle || "";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.bar, { borderBottomColor: theme.line }]}>
        <Pressable onPress={cancel} hitSlop={8} style={{ flex: 1 }}><T size={15.5} color={busy ? theme.text3 : theme.text}>{t("Annulla")}</T></Pressable>
        <T size={16} weight="700">{replyId ? t("Rispondi") : t("Nuovo pensiero")}</T>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}>
        {replyId ? (
          replyTo ? (
            <View style={{ paddingHorizontal: INSET, paddingBottom: 6 }}><QuotedThought thought={replyTo} /></View>
          ) : reply.loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color={theme.text2} />
          ) : (
            <View style={{ paddingHorizontal: INSET, paddingBottom: 6 }}><QuotedThought thought={null} /></View>
          )
        ) : null}
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          const on = active === index;
          return (
            <Pressable key={part.id} onPress={() => setActive(index)} style={[styles.part, { opacity: on ? 1 : 0.55 }]}>
              <View style={styles.side}>
                <Face person={me} size={38} />
                {!last || part.text.trim() || part.images.length ? <View style={[styles.line, { backgroundColor: theme.line }]} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.head}>
                  <T size={14.5} weight="700">{myHandle}</T>
                  {index > 0 && !busy ? <Pressable accessibilityLabel={t("Rimuovi")} hitSlop={8} style={{ marginLeft: "auto" }} onPress={() => removePart(index)}><X size={14} weight="bold" color={theme.text2} /></Pressable> : null}
                </View>
                <TextInput
                  ref={(node) => { areas.current[index] = node; }}
                  multiline
                  autoFocus={index === 0}
                  editable={!busy}
                  value={part.text}
                  onChangeText={(value) => onType(index, value)}
                  onSelectionChange={(event) => { caret.current[index] = event.nativeEvent.selection.start; }}
                  onFocus={() => setActive(index)}
                  placeholder={index === 0 ? (replyTo ? t("Rispondi a {handle}…", { handle: replyTo.author?.handle || "" }) : t("Cosa c'è di nuovo?")) : t("Aggiungi altro…")}
                  placeholderTextColor={theme.text3}
                  accessibilityLabel={t("Testo del pensiero")}
                  style={{ color: theme.text, fontSize: 15.5, lineHeight: 22, minHeight: 24, marginTop: 2, padding: 0 }}
                />
                {mention && mention.index === index && people.length ? (
                  <View style={[styles.mentions, { backgroundColor: theme.scheme === "dark" ? "#1c1c1e" : "#fff", borderColor: theme.line }]}>
                    {people.map((person) => (
                      <Pressable key={person.handle} onPress={() => pickMention(person)} style={({ pressed }) => [styles.mentionRow, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
                        <Face person={person} size={32} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><T size={14} weight="600">{person.handle}</T>{person.verified ? <Verified size={13} weight="fill" color={theme.blue} /> : null}</View>
                          {person.name ? <T size={13} color={theme.text2}>{person.name}</T> : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {part.images.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 10 }}>
                    {part.images.map((image, at) => (
                      <View key={`${at}-${String(image.uri).slice(-16)}`} style={[styles.image, part.images.length === 1 ? { width: 230, height: 260 } : null]}>
                        <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        {!busy ? <Pressable accessibilityLabel={t("Rimuovi foto")} onPress={() => update(index, { images: part.images.filter((_, i) => i !== at) })} style={styles.imageX}><X size={12} weight="bold" color="#fff" /></Pressable> : null}
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
                          editable={!busy}
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
                      {DURATIONS.map(([ms, label]) => {
                        const sel = poll.duration === ms;
                        return (
                          <Pressable key={ms} onPress={() => setPoll((prev) => ({ ...prev, duration: ms }))} style={[styles.dayChip, { borderColor: sel ? theme.text : theme.line, backgroundColor: sel ? theme.text : "transparent" }]}>
                            <T size={13} weight="600" color={sel ? theme.bg : theme.text}>{t(label)}</T>
                          </Pressable>
                        );
                      })}
                      <Pressable onPress={() => setPoll(null)} style={{ paddingHorizontal: 4 }}><T size={13} weight="600" color={theme.red}>{t("Rimuovi sondaggio")}</T></Pressable>
                    </View>
                  </View>
                ) : null}
                {on && !busy ? (
                  <View style={styles.tools}>
                    <Tool label={t("Aggiungi foto")} icon={ImageIcon} disabled={part.images.length >= MAX_PHOTOS || (index === 0 && Boolean(poll))} onPress={pickPhotos} />
                    <Tool label={t("Menziona")} icon={AtSign} onPress={() => insert("@")} />
                    <Tool label={t("Hashtag")} icon={Hash} onPress={() => insert("#")} />
                    {index === 0 && !replyId && !resumeFrom ? <Tool label={t("Sondaggio")} icon={Poll} pressed={Boolean(poll)} disabled={part.images.length > 0} onPress={() => setPoll((prev) => (prev ? null : { options: ["", ""], duration: 24 * HOUR }))} /> : null}
                    <CounterRing used={part.text.length} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {!busy && (lastPart.text.trim() || lastPart.images.length) && parts.length < MAX_PARTS ? (
          <Pressable onPress={addPart} style={styles.add}>
            <View style={{ width: 40, alignItems: "center" }}><Face person={me} size={22} style={{ opacity: 0.6 }} /></View>
            <T size={14.5} color={theme.text3}>{t("Aggiungi al thread")}</T>
          </Pressable>
        ) : null}
        {failure ? <T size={13.5} color={theme.red} style={{ marginHorizontal: INSET, marginTop: 10 }}>{failure}</T> : null}
      </ScrollView>
      <View style={[styles.foot, { borderTopColor: theme.line, backgroundColor: theme.bg, paddingBottom: 14 + (Platform.OS === "ios" ? 0 : insets.bottom) }]}>
        <View style={styles.status}>
          {busy ? (
            <>
              <ActivityIndicator size="small" color={theme.text2} />
              <T size={13.5} color={theme.text2} lines={1} style={{ flexShrink: 1 }}>
                {busy.of > 1 ? t("Pubblicazione {n} di {m}…", { n: busy.step, m: busy.of }) : t("Pubblicazione…")}
                {busy.progress > 0 && busy.progress < 1 ? ` ${Math.round(busy.progress * 100)}%` : ""}
              </T>
            </>
          ) : (
            <T size={13.5} color={theme.text3} lines={1}>{parts.length > 1 ? t("{n} parti nel thread", { n: parts.length }) : ""}</T>
          )}
        </View>
        <Pressable disabled={!ready} onPress={publish} style={({ pressed }) => [styles.post, { backgroundColor: theme.text, opacity: ready ? (pressed ? 0.8 : 1) : 0.35 }]}>
          <T size={15} weight="700" color={theme.bg}>{replyId ? t("Rispondi") : t("Pubblica")}</T>
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

const styles = StyleSheet.create({
  bar: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  part: { flexDirection: "row", gap: 12, paddingTop: 8, paddingHorizontal: INSET },
  side: { width: 40, alignItems: "center" },
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
  add: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: INSET },
  foot: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, paddingHorizontal: INSET, borderTopWidth: StyleSheet.hairlineWidth },
  status: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  post: { height: 36, paddingHorizontal: 18, borderRadius: 99, alignItems: "center", justifyContent: "center" },
});
