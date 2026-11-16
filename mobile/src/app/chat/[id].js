import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import seed from "../../data/seed.json";
import { CONTACTS, PEOPLE, PORTRAIT, POSTS, WORKS, compact } from "../../data";
import { INSET } from "../../theme";
import { useStore } from "../../lib/store";
import { useLive } from "../../live/LiveStore";
import { useThreads, personOf } from "../../live/threads";
import { DM_REACTIONS, clockOf, dayOf, nameIn, seenText, textHidden, tickFor } from "../../live/format";
import { placeCall, sendTo } from "../../live/actions";
import { useVoiceRecorder } from "../../live/recorder";
import { takeFind } from "../../live/chatBus";
import { ThreadFace, Face, GroupAvatar, TypingDots, Wallpaper, SearchField, wallColors, useChatTheme } from "../../ui/chat";
import { DmBubble } from "../../ui/chatBubble";
import { ArrowDown, BellOff, Camera, Check, ChevronDown, ChevronLeft, ChevronUp, Close, Copy, Eye, Forward, ImageIcon, Mic, PenLine, Phone, Pin, Reply, RotateCcw, Smile, Video } from "../../ui/chatIcons";
import { Sheet, T, tap } from "../../ui/kit";
import { keepMedia } from "../../lib/media-store";

const STORY_EMOJI = seed.STORY_EMOJI || [];
const DEMO_GALLERY = [...new Set([...WORKS.map((work) => work.src), PORTRAIT, ...(seed.PEOPLE || []).map((person) => person.src), ...POSTS.map((post) => post.image).filter(Boolean)])];

function mentionOf(draft) {
  try {
    return draft.match(new RegExp("(^|\\s)@([\\p{L}\\w.]*)$", "u"));
  } catch {
    return draft.match(/(^|\s)@([\w.]*)$/);
  }
}

export default function Chat() {
  const theme = useChatTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const live = useLive();
  const threads = useThreads();
  const { id } = useLocalSearchParams();
  const thread = threads.find((item) => item.id === id);
  const prefs = store.prefs;
  const receipts = prefs.readReceipts !== false;
  const flags = store.dmFlags || {};
  const me = live?.me?.handle;
  const myKey = thread?.live ? me : "me";

  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [focus, setFocus] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [forwardQuery, setForwardQuery] = useState("");
  const [zoom, setZoom] = useState(null);
  const [finding, setFinding] = useState(null);
  const [flashKey, setFlashKey] = useState(null);
  const [pop, setPop] = useState(null);
  const [hint, setHint] = useState("");
  const [rec, setRec] = useState(null);
  const [now, setNow] = useState(0);
  const [below, setBelow] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nearEnd = useRef(true);
  const hintTimer = useRef(0);
  const recRef = useRef({ origin: 0, started: 0, cancel: false });
  const voice = useVoiceRecorder();

  const flash = useCallback((text) => {
    clearTimeout(hintTimer.current);
    setHint(text);
    hintTimer.current = setTimeout(() => setHint(""), 2200);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); clearTimeout(hintTimer.current); };
  }, []);

  // Reads go out only while a live chat is really on screen; demo chats are read on open.
  useFocusEffect(useCallback(() => {
    if (thread?.live) live.setViewing(thread.id);
    if (thread && takeFind(thread.id)) setFinding({ q: "", at: 0 });
    return () => { if (thread?.live) live.setViewing(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.live]));

  useEffect(() => {
    if (!thread) return;
    if (thread.live && thread.unread) live.markRead(thread.id);
    if (!thread.live && thread.unread) store.readChat(thread.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.unread]);

  // A live chat that disappears (removed from the group, left) closes itself.
  const existed = useRef(false);
  useEffect(() => {
    if (thread) existed.current = true;
    else if (existed.current) {
      existed.current = false;
      if (router.canGoBack()) router.back();
    }
  }, [thread]);

  useEffect(() => {
    if (!rec) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [rec]);

  const lastKey = thread?.messages.length ? (thread.messages[thread.messages.length - 1].id || thread.messages[thread.messages.length - 1].clientId || thread.messages.length) : 0;
  const lastMine = thread?.messages.length && thread.messages[thread.messages.length - 1].from === "me";
  const firstKey = useRef(lastKey);
  useEffect(() => {
    if (!thread || lastKey === firstKey.current) return;
    firstKey.current = lastKey;
    if (nearEnd.current || lastMine) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      setUnseen(0);
    } else setUnseen((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey]);

  // ---- transcript ----
  const entries = useMemo(() => (thread ? thread.messages
    .map((message, index) => ({ message, index, key: message.id || message.clientId || `${thread.id}-${index}-${message.time || index}` }))
    .filter((entry) => !entry.message.unsent) : []), [thread]);

  const findQ = finding?.q.trim().toLowerCase() || "";
  const matches = findQ ? entries.filter((entry) => entry.message.from !== "system" && (entry.message.text || "").toLowerCase().includes(findQ)) : [];
  const current = matches.length ? matches[matches.length - 1 - Math.min(finding.at, matches.length - 1)] : null;

  const rows = useMemo(() => {
    if (!thread) return [];
    const out = [];
    if (!thread.live && entries.length) out.push({ type: "pill", key: "today", text: "Oggi" });
    if (thread.live && !entries.length) out.push({ type: "pill", key: "hello", text: "Saluta 👋 I messaggi arrivano in tempo reale." });
    const far = (a, b) => Boolean(a?.created && b?.created && b.created - a.created > 30 * 60 * 1000);
    const solo = (item) => item && item.from !== "system" && item.kind !== "call";
    entries.forEach((entry, at) => {
      const { message } = entry;
      const prev = entries[at - 1]?.message;
      const next = entries[at + 1]?.message;
      const stampHere = thread.live && message.created && (!prev?.created || far(prev, message));
      if (stampHere) out.push({ type: "pill", key: `stamp-${entry.key}`, text: `${dayOf(message.created)} ${clockOf(message.created)}` });
      if (message.from === "system") {
        out.push({ type: "pill", key: entry.key, text: message.text });
        return;
      }
      const sameAsPrev = solo(prev) && solo(message) && prev.from === message.from && prev.sender === message.sender && !stampHere && !message.reply;
      const sameAsNext = solo(next) && solo(message) && next.from === message.from && next.sender === message.sender && !far(message, next) && !next.reply;
      const face = message.from === "them" ? (thread.live ? (thread.people.find((p) => p.handle === message.sender) || { name: message.senderName }) : { src: thread.src, name: thread.name }) : null;
      out.push({
        type: "line",
        key: entry.key,
        entry,
        first: !sameAsPrev,
        last: !sameAsNext,
        face,
        fresh: (!message.id && message.created === 0) || (message.created && Date.now() - message.created < 4000),
      });
    });
    return out.reverse();
  }, [thread, entries]);

  const jumpTo = useCallback((key) => {
    const index = rows.findIndex((row) => row.key === key);
    if (index < 0) return;
    nearEnd.current = false;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 1400);
  }, [rows]);

  useEffect(() => {
    if (!current) return undefined;
    const timer = setTimeout(() => {
      const index = rows.findIndex((row) => row.key === current.key);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      nearEnd.current = false;
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  if (!thread) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  const isGroup = Boolean(thread.group || thread.members);
  const person = personOf(thread, PEOPLE, CONTACTS);
  const room = thread.live ? live?.call.rooms[thread.id] : null;
  const inThisCall = live?.call.convId === thread.id && live?.call.phase !== "idle";
  const muted = Boolean(flags[thread.id]?.muted);
  const subtitle = thread.typing?.length
    ? (thread.group ? `${thread.typing.join(", ")} sta scrivendo…` : "sta scrivendo…")
    : thread.live
      ? (thread.group
        ? `${thread.conv.members.length} membri · ${thread.people.filter((p) => p.online).length} online`
        : (prefs.activity === false ? "" : thread.online ? "Attivo/a ora" : seenText(thread.other)))
      : thread.members
        ? thread.members.map((member) => member.name.split(" ")[0]).join(", ")
        : (prefs.activity === false ? "" : "Attivo/a 12 min fa");
  const subtitleBlue = Boolean(thread.typing?.length) || (thread.online && prefs.activity !== false);
  const otherUnread = threads.filter((item) => item.id !== thread.id && !flags[item.id]?.muted).reduce((sum, item) => sum + (item.live ? item.unread || 0 : item.unread ? 1 : 0), 0);
  const showIntro = !(thread.live && thread.conv.hasMore);
  const focusEntry = focus ? entries.find((entry) => entry.key === focus) : null;
  const pinnedEntry = thread.live
    ? entries.find((entry) => entry.message.id && entry.message.id === thread.pinned?.id)
    : entries.find((entry) => entry.index === flags[thread.id]?.pin);
  const pinnedRaw = pinnedEntry?.message || (thread.live ? thread.pinned : null);
  const pinnedText = pinnedRaw ? (pinnedRaw.text || (pinnedRaw.kind === "image" ? "📷 Foto" : pinnedRaw.kind === "audio" ? "🎤 Messaggio vocale" : "…")) : "";
  const isPinned = (entry) => (thread.live ? Boolean(thread.pinned?.id) && thread.pinned.id === entry.message.id : flags[thread.id]?.pin === entry.index);
  const mention = isGroup ? mentionOf(draft) : null;
  const mentionList = mention
    ? (thread.live ? thread.people.map((p) => ({ key: p.handle, label: p.handle, name: p.name, src: p.src })) : (thread.members || []).map((m) => ({ key: m.name, label: m.name.split(" ")[0], name: m.name, src: m.src })))
      .filter((item) => !mention[2] || `${item.label} ${item.name}`.toLowerCase().includes(mention[2].toLowerCase()))
      .slice(0, 5)
    : [];
  const wallId = flags[thread.id]?.wall || "sky";
  const wall = wallColors(wallId, theme);
  const pillBg = wall.pill || (theme.dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.72)");
  const pillFg = wall.pillText || theme.text2;
  const elapsed = rec ? Math.max(0, Math.floor((now - recRef.current.started) / 1000)) : 0;
  const stamp = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  function quoteName(reply, mineMessage) {
    const fromMe = thread.live ? reply.from === me : reply.from === "me";
    const other = thread.live ? nameIn(thread.conv, reply.from, me).split(" ")[0] : (reply.name || thread.name || "").split(" ")[0];
    if (mineMessage) return fromMe ? "Hai risposto a te stesso" : `Hai risposto a ${other}`;
    return fromMe ? "Ha risposto a te" : `Ha risposto a ${other}`;
  }

  async function deliver(payload) {
    if (payload.kind === "text" && textHidden(prefs, payload.text)) {
      flash("Il messaggio contiene una parola nascosta.");
      return;
    }
    setDraft("");
    setTray(false);
    try {
      await sendTo({ live, store }, thread, payload);
    } catch (error) {
      flash(String(error?.message) === "too-big" ? "File troppo grande per la chat live." : "Impossibile inviare il file.");
      return;
    }
    if (!thread.live && !thread.members) live.answerLater(thread, payload);
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    tap();
    if (editing) {
      if (text !== editing.text) {
        if (thread.live) live.edit(thread.id, editing.id, text);
        else store.editChatMessage(thread.id, editing.index, text);
      }
      setEditing(null);
      setDraft("");
      return;
    }
    const payload = { kind: "text", text };
    if (replyTo) payload.reply = thread.live ? { id: replyTo.id, from: replyTo.from, kind: replyTo.kind, text: replyTo.text } : { from: replyTo.from, name: thread.name, kind: replyTo.kind, text: replyTo.text };
    deliver(payload);
    setReplyTo(null);
    setEmojiOpen(false);
  }

  function react(entry, emoji) {
    const currentEmoji = entry.message.reactions?.[myKey];
    const next = emoji === currentEmoji ? null : emoji;
    if (thread.live) live.react(thread.id, entry.message.id, next);
    else store.reactChatMessage(thread.id, entry.index, next);
    if (next) {
      setPop(entry.key);
      setTimeout(() => setPop(null), 700);
    }
  }

  function startReply(entry) {
    const message = entry.message;
    setEditing(null);
    setReplyTo({
      key: entry.key,
      id: message.id,
      from: thread.live ? message.sender : message.from,
      name: message.from === "me" ? "te stesso" : (message.senderName || thread.name || ""),
      kind: message.kind || "text",
      text: message.kind === "text" || !message.kind ? message.text : (message.text || ""),
    });
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function startEdit(entry) {
    setReplyTo(null);
    setEditing({ key: entry.key, index: entry.index, id: entry.message.id, text: entry.message.text || "" });
    setDraft(entry.message.text || "");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function togglePinned(entry) {
    if (thread.live) {
      const on = thread.pinned?.id === entry.message.id;
      live.pin(thread.id, on ? null : thread.conv.messages.find((message) => message.id === entry.message.id));
    } else {
      const on = flags[thread.id]?.pin === entry.index;
      store.setDmFlag(thread.id, "pin", on ? null : entry.index);
    }
  }

  function unsend(entry) {
    if (thread.live) live.unsend(thread.id, entry.message.id);
    else store.unsendChatMessage(thread.id, entry.index);
  }

  async function forwardTo(target) {
    const message = forwarding;
    if (!message || !target) return;
    const origin = message.fwd?.name || (message.from === "me" ? (live?.me?.name || store.profile?.name || "Tu") : (message.senderName || thread.name || ""));
    const base = message.kind === "image"
      ? { kind: "image", image: message.image, ...(message.text ? { text: message.text } : {}) }
      : message.kind === "audio"
        ? { kind: "audio", audio: message.audio, duration: message.duration, wave: message.wave }
        : { kind: "text", text: message.text };
    setForwarding(null);
    setForwardQuery("");
    try {
      await sendTo({ live, store }, target, { ...base, fwd: { name: origin } });
      flash(`Inoltrato a ${target.name}`);
    } catch {
      flash("Impossibile inoltrare.");
    }
  }

  async function pickPhoto() {
    tap();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: thread.live ? 0.35 : 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      deliver({ kind: "image", image: await keepMedia(result.assets[0].uri, "chat") });
    } catch {
      flash("Impossibile aprire la foto.");
    }
  }

  // ---- voice notes: hold the mic, slide left to cancel ----
  function beginRec(x) {
    recRef.current = { origin: x, started: Date.now(), cancel: false };
    setHint("");
    setNow(Date.now());
    setRec({ cancel: false });
    tap("medium");
    voice.start().then((ok) => {
      if (!ok && recRef.current.started) {
        recRef.current.started = 0;
        recRef.current.denied = true;
        setRec(null);
        flash("Consenti il microfono per i messaggi vocali.");
      }
    });
  }

  function moveRec(x) {
    if (!recRef.current.started) return;
    const cancel = recRef.current.origin - x > 72;
    if (cancel !== recRef.current.cancel) {
      recRef.current.cancel = cancel;
      setRec({ cancel });
      if (cancel) tap();
    }
  }

  async function endRec() {
    const r = recRef.current;
    if (!r.started) return;
    const held = Date.now() - r.started;
    const cancel = r.cancel || held < 450;
    const duration = Math.max(1, Math.min(120, Math.round(held / 1000)));
    r.started = 0;
    setRec(null);
    if (held < 450) flash("Tieni premuto");
    const result = await voice.stop(!cancel);
    if (cancel || !result) return;
    deliver({ kind: "audio", audio: result.uri, duration, wave: result.wave });
  }

  const renderRow = ({ item: row }) => {
    if (row.type === "pill") {
      return (
        <View style={{ alignItems: "center", marginVertical: 10 }}>
          <View style={[styles.pill, { backgroundColor: pillBg }]}>
            <T size={12.5} weight="500" color={pillFg} style={{ textAlign: "center" }}>{row.text}</T>
          </View>
        </View>
      );
    }
    const { entry } = row;
    const { message } = entry;
    const mine = message.from === "me";
    const tick = mine ? tickFor(message, thread, receipts) : null;
    const line = (
      <View style={[styles.line, { justifyContent: mine ? "flex-end" : "flex-start", marginTop: row.first ? 9 : 2, opacity: focus === entry.key ? 0 : 1 }]}>
        {!mine ? <View style={styles.face}>{row.last ? <Face src={row.face?.src} name={row.face?.name} size={28} /> : null}</View> : null}
        <DmBubble
          message={message}
          mine={mine}
          first={row.first}
          last={row.last}
          showName={Boolean(thread.group)}
          quoteLabel={quoteName}
          myKey={myKey}
          tick={tick}
          query={findQ}
          flash={flashKey === entry.key || current?.key === entry.key}
          pop={pop === entry.key}
          onZoom={setZoom}
          onCall={(kind) => placeCall(live, thread, kind)}
          onRetry={() => live.retry(thread.id, message)}
          onDiscard={() => live.discard(thread.id, message)}
          onReact={(emoji) => react(entry, emoji)}
          onReply={() => startReply(entry)}
          onMenu={() => { Keyboard.dismiss(); setFocus(entry.key); }}
        />
      </View>
    );
    return row.fresh ? <Animated.View entering={ZoomIn.springify().damping(16).stiffness(220)}>{line}</Animated.View> : line;
  };

  const intro = (
    <View>
      {thread.live && thread.conv.hasMore ? (
        <Pressable disabled={thread.conv.loading} onPress={() => { tap(); live.fetchOlder(thread.id); }} style={[styles.more, { backgroundColor: theme.fill }]}>
          <T size={13} weight="600">{thread.conv.loading ? "Caricamento…" : "Messaggi precedenti"}</T>
        </Pressable>
      ) : null}
      {showIntro ? (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.intro, { backgroundColor: wall.night ? "rgba(20,26,40,0.55)" : theme.dark ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.72)" }]}>
          <View style={styles.introFace}>
            {isGroup ? <GroupAvatar photo={thread.photo} title={thread.name} size={72} /> : <Face src={thread.src} name={thread.name} size={72} />}
          </View>
          <T size={17} weight="700" color={wall.night ? "#fff" : theme.text} style={{ textAlign: "center" }}>{thread.name}</T>
          <T size={13} color={wall.night ? "rgba(232,236,245,0.72)" : theme.text2} style={{ textAlign: "center" }}>
            {isGroup
              ? `${(thread.members || thread.people || []).length + 1} membri`
              : person?.live ? `@${person.handle} · Space` : `${person?.handle || ""} · ${person?.followers ? `${compact(person.followers)} follower` : "Space"}`}
          </T>
          {!isGroup && person?.craft ? <T size={13} color={wall.night ? "rgba(232,236,245,0.72)" : theme.text2}>{person.craft}{person.city ? ` · ${person.city}` : ""}</T> : null}
          {isGroup && thread.about ? <T size={13} color={wall.night ? "rgba(232,236,245,0.72)" : theme.text2} style={{ marginTop: 4, textAlign: "center", lineHeight: 18 }}>{thread.about}</T> : null}
          <Pressable onPress={() => { tap(); router.push(`/chat/info/${thread.id}`); }} style={({ pressed }) => [styles.introBtn, { backgroundColor: wall.night ? "rgba(120,160,255,0.18)" : "rgba(0,149,246,0.12)", transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <T size={13.5} weight="600" color={wall.night ? "#9cc0ff" : theme.blue}>{isGroup ? "Info gruppo" : "Info chat"}</T>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );

  const typingRow = thread.typing?.length ? (
    <Animated.View entering={FadeInDown.duration(220)} style={[styles.line, { marginTop: 9 }]}>
      <View style={styles.face}><Face src={thread.src} name={thread.name} size={28} /></View>
      <View style={[styles.typing, { backgroundColor: theme.them }]} accessibilityLabel="sta scrivendo"><TypingDots color={theme.text2} /></View>
    </Animated.View>
  ) : null;

  const headBg = theme.dark ? "rgba(0,0,0,0.86)" : "rgba(255,255,255,0.86)";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        <Wallpaper id={wallId} />
        <FlatList
          ref={listRef}
          inverted
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          ListHeaderComponent={typingRow}
          ListFooterComponent={intro}
          contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 + 52 + insets.top + (pinnedText ? 46 : 0) + (room && !inThisCall ? 58 : 0) }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={18}
          maxToRenderPerBatch={12}
          windowSize={15}
          maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 140 }}
          onScroll={(event) => {
            const y = event.nativeEvent.contentOffset.y;
            const near = y < 140;
            nearEnd.current = near;
            setBelow(!near && y > 320);
            if (near && unseen) setUnseen(0);
          }}
          scrollEventThrottle={64}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 250);
          }}
        />
        {below ? (
          <Animated.View entering={ZoomIn.duration(200)} style={styles.downWrap}>
            <Pressable accessibilityLabel="Ultimi messaggi" onPress={() => { tap(); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} style={[styles.down, { backgroundColor: theme.elev }]}>
              <ArrowDown size={18} weight="bold" color={theme.text} />
              {unseen ? <View style={[styles.downBadge, { backgroundColor: theme.blue }]}><T size={11} weight="700" color="#fff">{unseen}</T></View> : null}
            </Pressable>
          </Animated.View>
        ) : null}

        {/* header, floating over the wallpaper like Telegram */}
        <View style={styles.headWrap}>
          <BlurView intensity={50} tint={theme.dark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { backgroundColor: headBg }]} />
          <View style={{ paddingTop: insets.top }}>
            <View style={[styles.head, { borderBottomColor: theme.line }]}>
              <Pressable accessibilityLabel="Torna alle chat" hitSlop={8} onPress={() => { tap(); router.canGoBack() ? router.back() : router.replace("/messages"); }} style={styles.back}>
                <ChevronLeft size={24} weight="bold" color={theme.blue} />
                {otherUnread ? <View style={[styles.backBadge, { backgroundColor: theme.blue }]}><T size={12} weight="600" color="#fff">{otherUnread > 99 ? "99+" : otherUnread}</T></View> : null}
              </Pressable>
              <Pressable accessibilityLabel="Info chat" onPress={() => { tap(); router.push(`/chat/info/${thread.id}`); }} style={({ pressed }) => [styles.title, pressed && { backgroundColor: theme.fill }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                  <T size={16} weight="700" lines={1} style={{ letterSpacing: -0.16, flexShrink: 1 }}>{thread.name}</T>
                  {muted ? <BellOff size={13} weight="fill" color={theme.text3} /> : null}
                </View>
                {subtitle ? <T size={12.5} lines={1} color={subtitleBlue ? theme.blue : theme.text2}>{subtitle}</T> : null}
              </Pressable>
              <Pressable accessibilityLabel="Info chat" onPress={() => { tap(); router.push(`/chat/info/${thread.id}`); }} style={({ pressed }) => [styles.headFace, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
                <ThreadFace thread={thread} size={38} />
              </Pressable>
              {finding ? (
                <Animated.View entering={FadeIn.duration(180)} style={[styles.find, { backgroundColor: theme.bg }]}>
                  <SearchField autoFocus value={finding.q} onChangeText={(q) => setFinding({ q, at: 0 })} onSubmit={() => setFinding((prev) => ({ ...prev, at: Math.min(prev.at + 1, Math.max(0, matches.length - 1)) }))} style={{ flex: 1, height: 34 }} />
                  <T size={12} color={theme.text2} style={{ minWidth: 34, textAlign: "center", fontVariant: ["tabular-nums"] }}>{finding.q.trim() ? (matches.length ? `${matches.length - finding.at} / ${matches.length}` : "Nessun risultato") : ""}</T>
                  <Pressable accessibilityLabel="Precedente" disabled={finding.at >= matches.length - 1} onPress={() => setFinding((prev) => ({ ...prev, at: prev.at + 1 }))} style={{ padding: 6, opacity: finding.at >= matches.length - 1 ? 0.3 : 1 }}><ChevronUp size={18} weight="bold" color={theme.text} /></Pressable>
                  <Pressable accessibilityLabel="Successivo" disabled={finding.at <= 0} onPress={() => setFinding((prev) => ({ ...prev, at: prev.at - 1 }))} style={{ padding: 6, opacity: finding.at <= 0 ? 0.3 : 1 }}><ChevronDown size={18} weight="bold" color={theme.text} /></Pressable>
                  <Pressable onPress={() => setFinding(null)} hitSlop={6} style={{ paddingHorizontal: 4 }}><T size={15} weight="600" color={theme.blue}>Fine</T></Pressable>
                </Animated.View>
              ) : null}
            </View>
          </View>
          {pinnedText ? (
            <Pressable onPress={() => (pinnedEntry ? jumpTo(pinnedEntry.key) : null)} style={[styles.pinned, { backgroundColor: theme.bg, borderBottomColor: theme.line }]}>
              <View style={[styles.pinnedBar, { backgroundColor: theme.blue }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={13} weight="700" color={theme.blue}>Messaggio fissato</T>
                <T size={13.5} lines={1}>{pinnedText}</T>
              </View>
              <View style={{ transform: [{ rotate: "45deg" }] }}><Pin size={16} weight="fill" color={theme.text3} /></View>
            </Pressable>
          ) : null}
          {room && !inThisCall ? (
            <Pressable onPress={() => { tap(); live.calls.join(thread.id); }} style={[styles.join, { backgroundColor: theme.dark ? "#0a2a13" : "#e4f9ea" }]}>
              <View style={styles.joinIcon}>{room.video ? <Video size={16} weight="fill" color="#fff" /> : <Phone size={16} weight="fill" color="#fff" />}</View>
              <T size={14} style={{ flex: 1 }}>Chiamata in corso · {room.participants.length} in chiamata</T>
              <T size={14} weight="700" color="#1cd14f">Entra</T>
            </Pressable>
          ) : null}
        </View>
      </View>

      {tray ? (
        <Animated.View entering={FadeInDown.duration(260)} style={[styles.tray, { borderTopColor: theme.line, backgroundColor: theme.bg }]}>
          <View style={styles.trayHead}>
            <T size={14} weight="700">Recenti</T>
            <Pressable onPress={pickPhoto} hitSlop={8}><T size={14} weight="600" color={theme.blue}>Libreria</T></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 180, borderRadius: 10 }} contentContainerStyle={styles.trayGrid}>
            {DEMO_GALLERY.slice(0, 12).map((src) => (
              <Pressable key={src} onPress={() => { tap(); deliver({ kind: "image", image: src }); }} style={({ pressed }) => [styles.trayCell, { backgroundColor: theme.fill, opacity: pressed ? 0.8 : 1 }]}>
                <Image source={{ uri: src }} recyclingKey={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
      {hint ? <Animated.View entering={FadeIn.duration(200)}><T size={12.5} color={theme.text2} style={styles.hint}>{hint}</T></Animated.View> : null}
      {thread.live && live.status !== "open" ? <T size={12.5} color={theme.text2} style={styles.hint}>Riconnessione… i messaggi partiranno appena torni online.</T> : null}

      <View style={[styles.composer, { paddingBottom: (keyboard ? 0 : insets.bottom) + 10, borderTopColor: theme.line, backgroundColor: theme.bg }]}>
        {mentionList.length ? (
          <View style={[styles.mentions, { backgroundColor: theme.elev, borderColor: theme.line }]}>
            {mentionList.map((item) => (
              <Pressable key={item.key} onPress={() => { setDraft((value) => value.replace(/@[^\s@]*$/, `@${item.label} `)); inputRef.current?.focus(); }} style={({ pressed }) => [styles.mention, pressed && { backgroundColor: theme.fill }]}>
                <Face src={item.src} name={item.name} size={30} />
                <View><T size={14} weight="600">{item.name}</T><T size={12.5} color={theme.text2}>@{item.label}</T></View>
              </Pressable>
            ))}
          </View>
        ) : null}
        {editing ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.replybar}>
            <PenLine size={20} weight="fill" color={theme.blue} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={13} weight="600" color={theme.blue}>Modifica messaggio</T>
              <T size={13} color={theme.text2} lines={1}>{editing.text}</T>
            </View>
            <Pressable accessibilityLabel="Annulla modifica" hitSlop={8} onPress={() => { setEditing(null); setDraft(""); }} style={styles.replyClose}><Close size={16} weight="bold" color={theme.text2} /></Pressable>
          </Animated.View>
        ) : null}
        {replyTo ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.replybar}>
            <Reply size={20} weight="bold" color={theme.blue} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={13} weight="600" color={theme.blue}>Stai rispondendo a {replyTo.name.split(" ")[0]}</T>
              <T size={13} color={theme.text2} lines={1}>{replyTo.text || (replyTo.kind === "image" ? "Foto" : "Messaggio vocale")}</T>
            </View>
            <Pressable accessibilityLabel="Annulla risposta" hitSlop={8} onPress={() => setReplyTo(null)} style={styles.replyClose}><Close size={16} weight="bold" color={theme.text2} /></Pressable>
          </Animated.View>
        ) : null}
        {emojiOpen ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 2, paddingHorizontal: 4, paddingBottom: 8 }}>
            {STORY_EMOJI.slice(0, 24).map((emoji) => (
              <Pressable key={emoji} onPress={() => { tap(); setDraft((value) => `${value}${emoji}`); }} style={({ pressed }) => [styles.emoji, { transform: [{ scale: pressed ? 1.3 : 1 }] }]}>
                <T style={{ fontSize: 24 }}>{emoji}</T>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.pillRow, { backgroundColor: theme.fill }]}>
          <Pressable accessibilityLabel="Foto" accessibilityState={{ selected: tray }} onPress={() => { tap(); Keyboard.dismiss(); setTray((value) => !value); setEmojiOpen(false); }} style={({ pressed }) => [styles.cam, { backgroundColor: theme.blue, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
            <Camera size={20} weight="fill" color="#fff" />
          </Pressable>
          {rec ? (
            <View style={styles.rec}>
              <Blink />
              <T size={14} weight="600" style={{ fontVariant: ["tabular-nums"] }}>{stamp}</T>
              <T size={13} color={rec.cancel ? theme.red : theme.text2} lines={1} style={{ flex: 1 }}>{rec.cancel ? "Lascia per annullare" : "‹ Scorri per annullare"}</T>
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              value={draft}
              maxLength={2000}
              multiline
              onChangeText={(value) => {
                setDraft(value);
                if (thread.live && value.trim()) live.typing(thread.id);
              }}
              onFocus={() => setTray(false)}
              placeholder="Messaggio…"
              placeholderTextColor={theme.text2}
              accessibilityLabel={`Messaggio ${thread.name}`}
              style={[styles.input, { color: theme.text }]}
            />
          )}
          {draft.trim() && !rec ? (
            editing ? (
              <Pressable accessibilityLabel="Salva" onPress={submit} style={[styles.sendEdit, { backgroundColor: theme.blue }]}><Check size={17} weight="bold" color="#fff" /></Pressable>
            ) : (
              <Pressable accessibilityLabel="Invia" onPress={submit} hitSlop={6} style={styles.send}><T size={15} weight="700" color={theme.blue}>Invia</T></Pressable>
            )
          ) : (
            <>
              <View
                accessibilityLabel="Tieni premuto per registrare"
                onStartShouldSetResponder={() => true}
                onResponderTerminationRequest={() => false}
                onResponderGrant={(event) => beginRec(event.nativeEvent.pageX)}
                onResponderMove={(event) => moveRec(event.nativeEvent.pageX)}
                onResponderRelease={endRec}
                onResponderTerminate={endRec}
                style={[styles.tool, rec && { backgroundColor: theme.red, transform: [{ scale: 1.25 }] }]}
              >
                <Mic size={24} color={rec ? "#fff" : theme.text} />
              </View>
              {!rec ? (
                <>
                  <Pressable accessibilityLabel="Libreria" onPress={pickPhoto} style={styles.tool}><ImageIcon size={24} color={theme.text} /></Pressable>
                  <Pressable accessibilityLabel="Emoji" onPress={() => { tap(); setEmojiOpen((value) => !value); setTray(false); }} style={styles.tool}><Smile size={24} color={theme.text} /></Pressable>
                </>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* long-press menu */}
      <Modal visible={Boolean(focusEntry)} transparent animationType="fade" onRequestClose={() => setFocus(null)} statusBarTranslucent>
        {focusEntry ? (
          <Pressable style={styles.focus} onPress={() => setFocus(null)}>
            <BlurView intensity={40} tint={theme.dark ? "dark" : "light"} style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.45)" }]} />
            <Pressable onPress={() => {}} style={[styles.focusStack, { alignItems: focusEntry.message.from === "me" ? "flex-end" : "flex-start" }]}>
              <Animated.View entering={ZoomIn.springify().damping(15)} style={[styles.focusReact, { backgroundColor: theme.elev }]}>
                {DM_REACTIONS.map((emoji, index) => (
                  <Animated.View key={emoji} entering={ZoomIn.delay(60 + index * 30).springify().damping(12)}>
                    <Pressable onPress={() => { tap(); react(focusEntry, emoji); setFocus(null); }} style={({ pressed }) => [styles.focusEmoji, focusEntry.message.reactions?.[myKey] === emoji && { backgroundColor: theme.dark ? "rgba(245,245,245,0.14)" : "rgba(0,0,0,0.08)" }, pressed && { transform: [{ scale: 1.25 }, { translateY: -3 }] }]}>
                      <T style={{ fontSize: 27, lineHeight: 32 }}>{emoji}</T>
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
              <Animated.View entering={ZoomIn.springify().damping(16)}>
                <FocusBubble message={focusEntry.message} theme={theme} />
              </Animated.View>
              <T size={12} color={theme.text2} style={{ paddingHorizontal: 8 }}>{focusEntry.message.time || ""}</T>
              <Animated.View entering={ZoomIn.delay(40).springify().damping(16)} style={[styles.focusMenu, { backgroundColor: theme.elev }]}>
                {[
                  { label: "Rispondi", icon: Reply, run: () => startReply(focusEntry) },
                  focusEntry.message.from === "me" && (focusEntry.message.kind || "text") === "text" && (!thread.live || focusEntry.message.id) ? { label: "Modifica", icon: PenLine, run: () => startEdit(focusEntry) } : null,
                  !thread.live || focusEntry.message.id ? { label: isPinned(focusEntry) ? "Togli dai fissati" : "Fissa", icon: Pin, run: () => togglePinned(focusEntry) } : null,
                  { label: "Inoltra", icon: Forward, run: () => setForwarding(focusEntry.message) },
                  focusEntry.message.text ? { label: "Copia", icon: Copy, run: () => { Clipboard.setStringAsync(focusEntry.message.text).catch(() => {}); flash("Copiato"); } } : null,
                  focusEntry.message.kind === "image" ? { label: "Visualizza", icon: Eye, run: () => setZoom(focusEntry.message.image) } : null,
                  focusEntry.message.from === "me" && (!thread.live || focusEntry.message.id) ? { label: "Annulla l'invio", icon: RotateCcw, warn: true, run: () => unsend(focusEntry) } : null,
                ].filter(Boolean).map((item, index) => (
                  <Pressable key={item.label} onPress={() => { tap(); setFocus(null); item.run(); }} style={({ pressed }) => [styles.focusItem, index && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }, pressed && { backgroundColor: theme.fill }]}>
                    <T size={15} color={item.warn ? theme.red : theme.text}>{item.label}</T>
                    <item.icon size={20} color={item.warn ? theme.red : theme.text} />
                  </Pressable>
                ))}
              </Animated.View>
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>

      <Sheet open={Boolean(forwarding)} onClose={() => { setForwarding(null); setForwardQuery(""); }} title="Inoltra a…">
        <SearchField value={forwardQuery} onChangeText={setForwardQuery} />
        <ScrollView style={{ maxHeight: 420, marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {threads.filter((item) => !forwardQuery.trim() || item.name.toLowerCase().includes(forwardQuery.trim().toLowerCase())).map((item) => (
            <Pressable key={item.id} onPress={() => { tap(); forwardTo(item); }} style={({ pressed }) => [styles.forwardRow, pressed && { backgroundColor: theme.fill }]}>
              <ThreadFace thread={item} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={15} weight="600" lines={1}>{item.name}</T>
                <T size={13} color={theme.text2}>{item.group || item.members ? "Gruppo" : item.live ? "Su Space" : "Chat"}</T>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      <Modal visible={Boolean(zoom)} transparent animationType="fade" onRequestClose={() => setZoom(null)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: "#000" }} onPress={() => setZoom(null)}>
          {zoom ? <Animated.View entering={ZoomIn.springify().damping(16)} style={{ flex: 1 }}><Image source={{ uri: zoom }} style={{ flex: 1 }} contentFit="contain" transition={120} /></Animated.View> : null}
          <Pressable accessibilityLabel="Chiudi" onPress={() => setZoom(null)} style={[styles.zoomClose, { top: insets.top + 6 }]}><Close size={25} weight="bold" color="#fff" /></Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function FocusBubble({ message, theme }) {
  const mine = message.from === "me";
  const fg = mine ? "#fff" : theme.text;
  if (message.kind === "image") {
    return (
      <View style={{ borderRadius: 22, overflow: "hidden" }}>
        <Image source={{ uri: message.image }} style={{ width: 200, height: 240 }} contentFit="cover" />
        {message.text ? <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: mine ? "#3f6cf6" : theme.them }}><T size={15} color={fg}>{message.text}</T></View> : null}
      </View>
    );
  }
  const body = <T size={15} color={fg} style={{ lineHeight: 19.8 }}>{message.kind === "audio" ? "🎤 Messaggio vocale" : message.kind === "call" ? (message.call === "video" ? "Videochiamata" : "Chiamata vocale") : message.text}</T>;
  if (mine) {
    return <LinearGradientBox>{body}</LinearGradientBox>;
  }
  return <View style={{ maxWidth: 300, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 22, backgroundColor: theme.them }}>{body}</View>;
}

function LinearGradientBox({ children }) {
  return <LinearGradient colors={["#a334fa", "#3f6cf6"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ maxWidth: 300, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 22 }}>{children}</LinearGradient>;
}

function Blink() {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(0.25, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#ff3040" }, style]} />;
}

const styles = StyleSheet.create({
  headWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 3 },
  head: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 70, height: 36, flexDirection: "row", alignItems: "center", gap: 2 },
  backBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, minWidth: 0, alignItems: "center", gap: 1, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12 },
  headFace: { width: 70, alignItems: "flex-end" },
  find: { ...StyleSheet.absoluteFill, zIndex: 4, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
  pinned: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  pinnedBar: { width: 2.5, alignSelf: "stretch", borderRadius: 99 },
  join: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginHorizontal: INSET, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  joinIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#1cd14f", alignItems: "center", justifyContent: "center" },
  pill: { maxWidth: "80%", paddingVertical: 3, paddingHorizontal: 10, borderRadius: 99, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  more: { alignSelf: "center", marginVertical: 10, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 99 },
  intro: { alignSelf: "center", alignItems: "center", gap: 2, maxWidth: 250, marginTop: 24, marginBottom: 8, paddingTop: 18, paddingHorizontal: 22, paddingBottom: 14, borderRadius: 22, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  introFace: { marginBottom: 8, borderRadius: 36, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 4 } },
  introBtn: { marginTop: 10, height: 30, paddingHorizontal: 14, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  face: { width: 28, height: 28 },
  typing: { paddingVertical: 13, paddingHorizontal: 15, borderRadius: 22 },
  downWrap: { position: "absolute", right: 14, bottom: 16, zIndex: 4 },
  down: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  downBadge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  tray: { paddingTop: 8, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth },
  trayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingBottom: 8 },
  trayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  trayCell: { width: "24.5%", aspectRatio: 1, overflow: "hidden" },
  hint: { marginTop: 6, marginHorizontal: INSET, textAlign: "center" },
  composer: { paddingTop: 6, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth },
  mentions: { marginHorizontal: 4, marginBottom: 8, borderRadius: 14, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  mention: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: 12 },
  replybar: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, paddingRight: 8, paddingBottom: 10, paddingLeft: 14 },
  replyClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  emoji: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  pillRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, minHeight: 46, paddingVertical: 4, paddingLeft: 4, paddingRight: 6, borderRadius: 23 },
  cam: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 38, maxHeight: 120, paddingHorizontal: 6, paddingTop: 9, paddingBottom: 9, fontSize: 15 },
  tool: { width: 34, height: 38, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  send: { height: 38, paddingHorizontal: 10, justifyContent: "center" },
  sendEdit: { width: 34, height: 34, borderRadius: 17, marginBottom: 2, alignItems: "center", justifyContent: "center" },
  rec: { flex: 1, minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6 },
  focus: { flex: 1, justifyContent: "center", paddingHorizontal: 14 },
  focusStack: { width: "100%", gap: 10 },
  focusReact: { flexDirection: "row", gap: 2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 99, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  focusEmoji: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  focusMenu: { width: 230, borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 14 } },
  focusItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 16 },
  forwardRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10 },
  zoomClose: { position: "absolute", left: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
