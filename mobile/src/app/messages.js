import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { INSET } from "../theme";
import { useStore } from "../lib/store";
import { PEOPLE } from "../data";
import { useLive } from "../live/LiveStore";
import { useInboxRules, useThreads } from "../live/threads";
import { callStamp, demoTime, isGroupChat, listTime, previewOf, tickFor } from "../live/format";
import { placeCall } from "../live/actions";
import { takeFolder } from "../live/chatBus";
import { EmptyState, SheetRow, Spinner, ThreadFace, Toast, useChatTheme, useFlash } from "../ui/chat";
import { Archive, Bell, BellOff, Check, CheckCheck, ClearIcon, Clock, Close, Folder, ImageIcon, MarkRead, MessageCircle, Mic, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Pin, Search, Sliders, SquarePen, Trash, Users, Verified, Video } from "../ui/chatIcons";
import { Sheet, T, tap } from "../ui/kit";
import { t, tk } from "../lib/i18n";

const PREVIEW_ICONS = { image: ImageIcon, mic: Mic, video: Video, phone: Phone };
const RECENT_CALLS = [
  { id: "seed-adele", threadId: "t3", call: "video", from: "them", duration: 0, time: tk("Ieri") },
  { id: "seed-leo", threadId: "t1", call: "voice", from: "me", duration: 184, time: tk("Lun") },
  { id: "seed-marta", threadId: "t2", call: "voice", from: "them", duration: 46, time: tk("Dom") },
];
const VERIFIED = new Set(PEOPLE.filter((person) => person.verified).map((person) => person.name));

export default function Messages() {
  const theme = useChatTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const live = useLive();
  const threads = useThreads();
  const rules = useInboxRules();
  const { flags, folders, hiddenOut, isMuted, unreadOf, isArchived, inFolder } = rules;
  const receipts = store.prefs.readReceipts !== false;
  const [query, setQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [box, setBox] = useState("chats");
  const [folder, setFolder] = useState("all");
  const [folderDir, setFolderDir] = useState(0);
  const [selecting, setSelecting] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [hint, flash] = useFlash();
  const listRef = useRef(null);
  const needle = query.trim().toLowerCase();

  // A folder just saved in the folder editor becomes the active one (as on the web).
  useFocusEffect(useCallback(() => {
    const id = takeFolder();
    if (id) {
      setBox("chats");
      setFolder(id);
    }
  }, []));

  const visible = useMemo(() => threads.filter((item) => {
    const kinds = (item.messages || []).map((message) => message.kind || "").join(" ");
    const blob = `${item.name} ${item.kind} ${item.preview} ${(item.messages || []).map((message) => message.text || "").join(" ")} ${kinds} ${kinds.includes("image") ? "photo foto" : ""} ${kinds.includes("audio") ? "voice vocale audio" : ""} ${kinds.includes("call") ? "call chiamata video" : ""} ${(item.members || []).map((member) => member.name).join(" ")}`.toLowerCase();
    if (!item.live && !item.members && (store.prefs.blocked || []).includes(item.name)) return false;
    return !needle || blob.includes(needle);
  }), [threads, needle, store.prefs.blocked]);

  const alive = visible.filter((item) => !hiddenOut(item));
  const archived = alive.filter(isArchived);
  const countIn = (key) => alive.filter((item) => inFolder(item, key) && unreadOf(item) > 0 && !isMuted(item)).length;
  const activeFolder = folder === "all" || folders.some((entry) => entry.id === folder) ? folder : "all";
  const listed = alive
    .filter((item) => inFolder(item, activeFolder))
    .map((item, order) => ({ item, order, pinned: Boolean(flags[item.id]?.pinned) }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
  const sheetItem = sheet ? threads.find((item) => item.id === sheet) : null;
  const connecting = live && (live.status === "connecting" || live.status === "reconnecting");

  const callRows = useMemo(() => [
    ...threads.flatMap((item) => (item.messages || []).flatMap((message, index) => (
      message.kind === "call"
        ? [{ key: `${item.id}-${message.id || index}-${message.time}`, thread: item, call: message.call === "video" ? "video" : "voice", from: message.from, duration: message.duration || 0, time: item.live ? listTime(message.created) : message.time, at: message.created || 0 }]
        : []
    ))).sort((a, b) => b.at - a.at),
    ...RECENT_CALLS.flatMap((item) => {
      const found = threads.find((entry) => entry.id === item.threadId);
      return found ? [{ ...item, key: item.id, thread: found }] : [];
    }),
  ].filter((item) => !needle || item.thread.name.toLowerCase().includes(needle)), [threads, needle]);

  function openThread(id) {
    const item = threads.find((entry) => entry.id === id);
    if (item && !item.live && item.unread) store.readChat(id);
    router.push(`/chat/${id}`);
  }

  function hideThread(item) {
    if (item.live) store.setDmFlag(item.id, "hiddenAt", Date.now());
    else store.deleteChat(item.id);
    setSheet(null);
  }

  function archiveIds(ids, on) {
    store.setDmFlags(ids, "archivedAt", on ? Date.now() : null);
    flash(on ? (ids.length > 1 ? t("{n} chat archiviate", { n: ids.length }) : t("Chat archiviata")) : t("Riportata nelle chat"), 2200);
  }

  function readIds(ids) {
    for (const id of ids) {
      const item = threads.find((entry) => entry.id === id);
      if (!item) continue;
      if (item.live) live.markRead(id);
      else if (item.unread) store.readChat(id);
    }
  }

  const toggleSelect = useCallback((id) => {
    setSelecting((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const tabs = [{ id: "all", name: tk("Tutte") }, ...folders, { id: "calls", name: tk("Chiamate") }];
  const selectedIds = [...(selecting || [])];
  const activeTab = box === "calls" ? "calls" : activeFolder;

  function pickTab(id) {
    const order = tabs.map((entry) => entry.id);
    const from = order.indexOf(activeTab);
    const to = order.indexOf(id);
    if (from === to) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    setFolderDir(to > from ? 1 : -1);
    if (id === "calls") setBox("calls");
    else {
      setBox("chats");
      setFolder(id);
    }
  }

  const rowTime = (item) => {
    if (item.live) {
      const label = listTime(item.updatedAt);
      return label ? label.charAt(0).toUpperCase() + label.slice(1).replace(".", "") : "";
    }
    return demoTime(item.time);
  };

  const data = [{ type: "search", key: "search" }, { type: "tabs", key: "tabs" }];
  if (box === "chats") {
    if (activeFolder === "all" && archived.length && !needle && !selecting) data.push({ type: "archive", key: "archive" });
    for (const entry of listed) data.push({ type: "row", key: entry.item.id, ...entry });
    if (!listed.length) data.push({ type: "empty", key: "empty" });
  } else {
    callRows.forEach((entry) => data.push({ type: "call", key: entry.key, entry }));
    if (!callRows.length) data.push({ type: "empty-calls", key: "empty-calls" });
  }

  const renderItem = ({ item: cell }) => {
    switch (cell.type) {
      case "search":
        return <SearchBar value={query} onChange={setQuery} focus={searchFocus} setFocus={setSearchFocus} />;
      case "tabs":
        return (
          <FolderTabs
            tabs={tabs}
            active={activeTab}
            counts={Object.fromEntries(tabs.map((entry) => [entry.id, entry.id === "calls" ? 0 : countIn(entry.id)]))}
            onPick={pickTab}
            onEdit={(id) => { if (folders.some((entry) => entry.id === id)) router.push({ pathname: "/chat/folder", params: { id } }); }}
            onManage={() => router.push("/chat/folders")}
          />
        );
      case "archive":
        return (
          <Pressable onPress={() => { tap(); router.push("/chat/archive"); }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}>
            <LinearGradient colors={["#b0b6bd", "#7d848c"]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={styles.archiveFace}><Archive size={21} weight="fill" color="#fff" /></LinearGradient>
            <View style={[styles.body, { borderBottomColor: theme.line }]}>
              <T size={15.5} weight="600" lines={1}>{t("Chat archiviate")}</T>
              <View style={styles.l2}>
                <T size={14} color={theme.text2} lines={1} style={{ flex: 1 }}>{archived.map((item) => item.name.split(" ")[0]).join(", ")}</T>
                {archived.some((item) => unreadOf(item)) ? <View style={[styles.badge, { backgroundColor: theme.text3 }]}><T size={12} weight="600" color="#fff">{archived.filter((item) => unreadOf(item)).length}</T></View> : null}
              </View>
            </View>
          </Pressable>
        );
      case "row":
        return (
          <Animated.View key={`${activeFolder}-${cell.item.id}`} entering={folderDir ? FadeIn.duration(260) : undefined}>
            <InboxRow
              item={cell.item}
              pinned={cell.pinned}
              time={rowTime(cell.item)}
              count={unreadOf(cell.item)}
              muted={isMuted(cell.item)}
              room={cell.item.live ? live?.call.rooms[cell.item.id] : null}
              tick={rowTick(cell.item, receipts)}
              selecting={Boolean(selecting)}
              selected={Boolean(selecting?.has(cell.item.id))}
              onOpen={() => (selecting ? toggleSelect(cell.item.id) : openThread(cell.item.id))}
              onLongPress={() => (selecting ? null : setSheet(cell.item.id))}
              onMute={() => store.setDmFlag(cell.item.id, "muted", !isMuted(cell.item))}
              onDelete={() => hideThread(cell.item)}
              onArchive={() => archiveIds([cell.item.id], true)}
            />
          </Animated.View>
        );
      case "call":
        return <CallRow entry={cell.entry} onCall={() => placeCall(live, cell.entry.thread, cell.entry.call)} />;
      case "empty":
        return (
          <EmptyState
            icon={needle ? Search : MessageCircle}
            title={needle ? t("Nessun risultato") : activeFolder !== "all" ? t("Questa cartella è vuota") : t("Nessun messaggio")}
            text={needle ? t("Nessuna chat con questo nome.") : activeFolder !== "all" ? t("Qui compaiono le chat che rispettano le regole della cartella.") : t("Inizia una chat con chi segui.")}
          />
        );
      case "empty-calls":
        return <EmptyState icon={Phone} title={t("Ancora nessuna chiamata")} />;
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={styles.head}>
        <Pressable onPress={() => { tap(); setSelecting((prev) => (prev ? null : new Set())); }} style={({ pressed }) => [styles.pill, { backgroundColor: selecting ? theme.blue : theme.fill, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <T size={16} weight={selecting ? "600" : "500"} color={selecting ? "#fff" : theme.text}>{selecting ? t("Fine") : t("Modifica")}</T>
        </Pressable>
        <View style={styles.title} pointerEvents="none">
          {selecting ? (
            <T size={17} weight="700">{selectedIds.length ? t("{n} selezionate", { n: selectedIds.length }) : t("Seleziona chat")}</T>
          ) : connecting ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Spinner color={theme.blue} size={18} /><T size={17} weight="700">{t("Connessione…")}</T></View>
          ) : <T size={17} weight="700">{t("Chat")}</T>}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityLabel={t("Nuovo gruppo")} onPress={() => { tap(); router.push("/chat/group"); }} style={({ pressed }) => [styles.round, { backgroundColor: theme.fill, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
            <Users size={19} weight="bold" color={theme.text} />
          </Pressable>
          <Pressable accessibilityLabel={t("Nuovo messaggio")} onPress={() => { tap(); router.push("/chat/new"); }} style={({ pressed }) => [styles.round, { backgroundColor: theme.blue, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
            <SquarePen size={19} weight="bold" color="#fff" />
          </Pressable>
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(cell) => cell.key}
        renderItem={renderItem}
        stickyHeaderIndices={[1]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={11}
        contentContainerStyle={{ paddingBottom: selecting ? 80 : 18 }}
      />
      {selecting ? (
        <View style={[styles.actions, { borderTopColor: theme.line }]}>
          <BlurView intensity={60} tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          {[
            { label: tk("Leggi"), icon: MarkRead, run: () => { readIds(selectedIds); setSelecting(null); } },
            { label: tk("Archivia"), icon: Archive, run: () => { archiveIds(selectedIds, true); setSelecting(null); } },
            { label: tk("Silenzia"), icon: BellOff, run: () => { store.setDmFlags(selectedIds, "muted", true); setSelecting(null); } },
            { label: tk("Elimina"), icon: Trash, danger: true, run: () => { for (const id of selectedIds) { const item = threads.find((entry) => entry.id === id); if (item) hideThread(item); } setSelecting(null); } },
          ].map((action) => (
            <Pressable key={action.label} disabled={!selectedIds.length} onPress={() => { tap(); action.run(); }} style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4, opacity: selectedIds.length ? 1 : 0.35 }}>
              <action.icon size={22} color={action.danger ? theme.red : theme.blue} />
              <T size={12} weight="600" color={action.danger ? theme.red : theme.blue}>{t(action.label)}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Toast text={hint} />
      <Sheet open={Boolean(sheetItem)} onClose={() => setSheet(null)}>
        {sheetItem ? (
          <View>
            <View style={[styles.sheetHead, { borderBottomColor: theme.line }]}>
              <ThreadFace thread={sheetItem} size={40} />
              <T size={15} weight="600" lines={1} style={{ flex: 1 }}>{sheetItem.name}</T>
            </View>
            <SheetRow icon={Pin} label={flags[sheetItem.id]?.pinned ? t("Rimuovi dai fissati") : t("Fissa")} onPress={() => { store.setDmFlag(sheetItem.id, "pinned", !flags[sheetItem.id]?.pinned); setSheet(null); }} />
            {unreadOf(sheetItem) ? (
              <SheetRow icon={MarkRead} label={t("Segna come letta")} onPress={() => { readIds([sheetItem.id]); setSheet(null); }} />
            ) : !sheetItem.live ? (
              <SheetRow icon={MessageCircle} label={t("Segna come da leggere")} onPress={() => { store.markChatUnread(sheetItem.id); setSheet(null); }} />
            ) : null}
            <SheetRow icon={flags[sheetItem.id]?.muted ? Bell : BellOff} label={flags[sheetItem.id]?.muted ? t("Riattiva notifiche") : t("Silenzia")} onPress={() => { store.setDmFlag(sheetItem.id, "muted", !flags[sheetItem.id]?.muted); setSheet(null); }} />
            <SheetRow icon={Archive} label={isArchived(sheetItem) ? t("Ripristina") : t("Archivia")} onPress={() => { archiveIds([sheetItem.id], !isArchived(sheetItem)); setSheet(null); }} />
            {folders.filter((entry) => !entry.people || !entry.groups).map((entry) => {
              const inside = (entry.chats || []).includes(sheetItem.id);
              return (
                <SheetRow
                  key={entry.id}
                  icon={Folder}
                  label={inside ? t("Togli da «{name}»", { name: t(entry.name) }) : t("Aggiungi a «{name}»", { name: t(entry.name) })}
                  onPress={() => { store.setDmFolders(folders.map((item) => (item.id === entry.id ? { ...item, chats: inside ? item.chats.filter((value) => value !== sheetItem.id) : [...(item.chats || []), sheetItem.id] } : item))); setSheet(null); }}
                />
              );
            })}
            <SheetRow icon={Trash} danger label={t("Elimina")} onPress={() => hideThread(sheetItem)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function rowTick(item, receipts) {
  const last = item.messages?.[item.messages.length - 1];
  if (!last || last.from !== "me" || last.kind === "call") return null;
  return tickFor(last, item, receipts);
}

function SearchBar({ value, onChange, focus, setFocus }) {
  const theme = useChatTheme();
  const active = focus || Boolean(value);
  return (
    <View style={{ paddingTop: 4, paddingBottom: 8, paddingHorizontal: INSET, backgroundColor: theme.bg }}>
      <View style={[styles.search, { backgroundColor: theme.fill, justifyContent: active ? "flex-start" : "center" }]}>
        <Search size={19} color={theme.text2} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={t("Cerca")}
          placeholderTextColor={theme.text2}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t("Cerca nei messaggi")}
          style={[{ color: theme.text, fontSize: 16, paddingVertical: 0, height: "100%" }, active ? { flex: 1 } : { width: 56 }]}
        />
        {value ? <Pressable onPress={() => onChange("")} hitSlop={8}><ClearIcon size={17} weight="fill" color={theme.text3} /></Pressable> : null}
      </View>
    </View>
  );
}

// Telegram-style folder bar: a pill with a sliding highlight under the active folder.
function FolderTabs({ tabs, active, counts, onPick, onEdit, onManage }) {
  const theme = useChatTheme();
  const layouts = useRef({});
  const scroll = useRef(null);
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ease = Easing.bezier(0.32, 0.72, 0, 1);

  const place = useCallback((animate) => {
    const box = layouts.current[active];
    if (!box) return;
    x.value = animate ? withTiming(box.x, { duration: 420, easing: ease }) : box.x;
    w.value = animate ? withTiming(box.width, { duration: 420, easing: ease }) : box.width;
    if (width) scroll.current?.scrollTo({ x: Math.max(0, box.x - (width - box.width) / 2), animated: animate });
  }, [active, width, x, w, ease]);

  useEffect(() => { place(true); }, [active, place]);
  const mark = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));

  return (
    <View style={[styles.tabsWrap, { backgroundColor: theme.bg }]}>
      <View style={[styles.tabsPill, { backgroundColor: theme.fill }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
          <Animated.View style={[styles.tabsMark, { backgroundColor: theme.mark }, mark]} />
          {tabs.map((entry) => {
            const on = active === entry.id;
            const count = counts[entry.id];
            return (
              <Pressable
                key={entry.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onLayout={(event) => {
                  layouts.current[entry.id] = event.nativeEvent.layout;
                  if (entry.id === active) place(false);
                }}
                onPress={() => { tap(); onPick(entry.id); }}
                onLongPress={() => { tap("medium"); onEdit(entry.id); }}
                delayLongPress={520}
                style={({ pressed }) => [styles.tab, pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <T size={14} weight="600" color={on ? theme.text : theme.text2} style={{ letterSpacing: -0.15 }}>{t(entry.name)}</T>
                {count ? <View style={[styles.tabBadge, { backgroundColor: on ? theme.blue : theme.text3 }]}><T size={10.5} weight="700" color="#fff">{count}</T></View> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Pressable accessibilityLabel={t("Modifica cartelle")} onPress={() => { tap(); onManage(); }} style={({ pressed }) => [styles.tabsEdit, { backgroundColor: theme.fill, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
        <Sliders size={17} weight="bold" color={theme.text2} />
      </Pressable>
    </View>
  );
}

const ACTION_W = 66;

export const InboxRow = memo(function InboxRow({ item, pinned, time, count, muted, room, tick, selecting, selected, onOpen, onLongPress, onMute, onDelete, onArchive, onUnarchive }) {
  const theme = useChatTheme();
  const swipe = useRef(null);
  const preview = previewOf(item);
  const group = isGroupChat(item);
  const last = item.messages?.[item.messages.length - 1];
  const solo = !group && last?.from === "me";
  const mePrefix = t("Tu: {text}", { text: "" });
  const raw = String(preview.text || "");
  const text = room ? t("Chiamata in corso · Tocca per entrare") : solo ? (mePrefix && raw.startsWith(mePrefix) ? raw.slice(mePrefix.length) : raw.replace(/^(Tu|You): /, "")) : preview.text;
  const sender = group && !preview.typing && !room ? String(preview.text || "").match(/^([^:]{1,24}): /) : null;
  const PreviewIcon = room ? Video : preview.icon ? PREVIEW_ICONS[preview.icon] : null;
  const actions = [
    { key: "mute", color: "#ff9500", icon: muted ? Bell : BellOff, label: muted ? t("Riattiva") : t("Silenzia"), run: onMute },
    { key: "delete", color: "#ff3b30", icon: Trash, label: t("Elimina"), run: onDelete },
    onUnarchive
      ? { key: "unarchive", color: "#8e8e93", icon: Archive, label: t("Ripristina"), run: onUnarchive }
      : { key: "archive", color: "#8e8e93", icon: Archive, label: t("Archivia"), run: onArchive },
  ];
  const renderRight = () => (
    <View style={{ flexDirection: "row", width: ACTION_W * actions.length }}>
      {actions.map((action) => (
        <Pressable key={action.key} onPress={() => { tap(); swipe.current?.close(); action.run(); }} style={{ width: ACTION_W, backgroundColor: action.color, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <action.icon size={19} weight="fill" color="#fff" />
          <T size={11} weight="600" color="#fff">{action.label}</T>
        </Pressable>
      ))}
    </View>
  );
  const timeColor = count && !muted ? theme.blue : theme.text2;
  return (
    <Swipeable ref={swipe} enabled={!selecting} friction={1.4} rightThreshold={ACTION_W * 1.2} overshootRight={false} renderRightActions={renderRight}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onPress={() => { tap(); onOpen(); }}
        onLongPress={() => { tap("medium"); onLongPress(); }}
        delayLongPress={480}
        style={({ pressed }) => [styles.row, { backgroundColor: selected ? (theme.dark ? "#0b1622" : "#eef6fe") : pressed ? theme.fill : theme.bg }]}
      >
        {selecting ? (
          <Animated.View entering={FadeIn.duration(200)} style={[styles.check, { borderColor: selected ? theme.blue : theme.text3, backgroundColor: selected ? theme.blue : "transparent" }]}>
            {selected ? <Check size={13} weight="bold" color="#fff" /> : null}
          </Animated.View>
        ) : null}
        <View style={{ alignSelf: "center" }}><ThreadFace thread={item} size={46} /></View>
        <View style={[styles.body, { borderBottomColor: theme.line }]}>
          <View style={styles.l1}>
            <T size={15.5} weight={count ? "700" : "600"} lines={1} style={{ flexShrink: 1, letterSpacing: -0.15 }}>{item.name}</T>
            {VERIFIED.has(item.name) ? <Verified size={16} weight="fill" color={theme.blue} /> : null}
            {muted ? <BellOff size={14} weight="fill" color={theme.text3} /> : null}
            <View style={{ flex: 1 }} />
            {tick === "pending" ? <Clock size={15} weight="bold" color={theme.text3} />
              : tick === "failed" ? <Close size={15} weight="bold" color={theme.red} />
                : tick === "read" ? <CheckCheck size={15} weight="bold" color={theme.blue} />
                  : tick === "sent" ? <Check size={15} weight="bold" color={theme.text3} /> : null}
            <T size={13} color={timeColor} style={{ fontVariant: ["tabular-nums"] }}>{time}</T>
          </View>
          <View style={styles.l2}>
            <T size={14} lines={1} color={preview.typing ? theme.blue : room ? "#1cd14f" : theme.text2} weight={room ? "600" : "400"} style={{ flex: 1, lineHeight: 18.5 }}>
              {sender ? <T size={14} weight="500" color={theme.text}>{sender[1]}: </T> : null}
              {PreviewIcon ? <PreviewIcon size={14} weight="fill" color={room ? "#1cd14f" : theme.text3} /> : null}
              {PreviewIcon ? " " : ""}
              {sender ? text.slice(sender[0].length) : text}
            </T>
            {count ? (
              <View style={[styles.badge, { backgroundColor: muted ? theme.text3 : theme.blue }]}><T size={12} weight="600" color="#fff">{count}</T></View>
            ) : pinned ? <View style={{ transform: [{ rotate: "45deg" }] }}><Pin size={15} weight="fill" color={theme.text3} /></View> : null}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
});

function CallRow({ entry, onCall }) {
  const theme = useChatTheme();
  const missed = entry.from === "them" && !entry.duration;
  const label = entry.call === "video" ? t("Video") : t("Vocale");
  const way = entry.from === "me" ? t("In uscita") : missed ? t("Persa") : t("In entrata");
  const WayIcon = entry.from === "me" ? PhoneOutgoing : missed ? PhoneMissed : PhoneIncoming;
  return (
    <View style={[styles.row, { minHeight: 56 }]}>
      <View style={{ alignSelf: "center" }}><ThreadFace thread={entry.thread} size={46} /></View>
      <View style={[styles.body, { borderBottomColor: theme.line }]}>
        <View style={styles.l1}>
          <T size={15.5} weight="600" lines={1} color={missed ? theme.red : theme.text} style={{ flexShrink: 1 }}>{entry.thread.name}</T>
          <View style={{ flex: 1 }} />
          <T size={13} color={theme.text2}>{t(entry.time)}</T>
        </View>
        <View style={styles.l2}>
          <WayIcon size={14} weight="bold" color={missed ? theme.red : theme.text3} />
          <T size={14} color={theme.text2} lines={1} style={{ flex: 1 }}>{way} · {label}{entry.duration ? ` · ${callStamp(entry.duration)}` : ""}</T>
          <Pressable accessibilityLabel={entry.call === "video" ? t("Videochiamata") : t("Chiama")} hitSlop={8} onPress={() => { tap(); onCall(); }} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", marginTop: -14 }}>
            {entry.call === "video" ? <Video size={20} weight="fill" color={theme.blue} /> : <Phone size={20} weight="fill" color={theme.blue} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  pill: { height: 36, paddingHorizontal: 15, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  search: { height: 36, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14 },
  tabsWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 10, paddingHorizontal: INSET },
  tabsPill: { flex: 1, minWidth: 0, height: 38, padding: 3, borderRadius: 19 },
  tabsMark: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tab: { height: 32, paddingHorizontal: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 5 },
  tabBadge: { minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  tabsEdit: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "stretch", gap: 11, paddingLeft: 10, minHeight: 56 },
  archiveFace: { alignSelf: "center", width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0, justifyContent: "center", gap: 1, paddingVertical: 6, paddingRight: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  l1: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  l2: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  check: { alignSelf: "center", width: 24, height: 24, borderRadius: 12, borderWidth: 1.6, alignItems: "center", justifyContent: "center" },
  actions: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 6, flexDirection: "row", paddingTop: 6, paddingHorizontal: 8, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4, paddingHorizontal: 14, paddingBottom: 12, marginBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});
