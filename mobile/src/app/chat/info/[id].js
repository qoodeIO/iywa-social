import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { CONTACTS, PEOPLE, AVATAR } from "../../../data";
import { useStore } from "../../../lib/store";
import { useLive } from "../../../live/LiveStore";
import { personOf, useThreads } from "../../../live/threads";
import { personHidden, seenText } from "../../../live/format";
import { placeCall } from "../../../live/actions";
import { fileToDataUrl } from "../../../live/media";
import { requestFind } from "../../../live/chatBus";
import { ChatPrefs, Face, GroupAvatar, HeadAction, Hint, SheetRow, SubHead, Toast, VoiceBubble, useChatTheme, useFlash } from "../../../ui/chat";
import { Archive, Bell, BellOff, Camera, Close, Eraser, LogOut, Phone, Search, Trash, UserMinus, UserPlus, Video } from "../../../ui/chatIcons";
import { Sheet, T, tap } from "../../../ui/kit";
import { CheckRow, ToneRow } from "../../../ui/chatPick";
import { INSET } from "../../../theme";
import { keepMedia } from "../../../lib/media-store";

export default function Info() {
  const { id } = useLocalSearchParams();
  const threads = useThreads();
  const thread = threads.find((item) => item.id === id);
  const theme = useChatTheme();
  useEffect(() => {
    if (!thread && router.canGoBack()) router.back();
  }, [thread]);
  if (!thread) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return thread.group || thread.members ? <GroupInfo thread={thread} /> : <ChatInfo thread={thread} />;
}

function toSearch(thread) {
  requestFind(thread.id);
  router.back();
}

function Hero({ face, title, meta, metaBlue, actions }) {
  const theme = useChatTheme();
  return (
    <View style={[styles.hero, { backgroundColor: theme.bg }]}>
      <Animated.View entering={FadeIn.duration(320)} style={{ marginBottom: 8 }}>{face}</Animated.View>
      <T size={21} weight="700" style={{ letterSpacing: -0.4, textAlign: "center" }}>{title}</T>
      {meta ? <T size={14} color={metaBlue ? theme.blue : theme.text2}>{meta}</T> : null}
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable key={action.label} onPress={() => { tap(); action.run(); }} style={({ pressed }) => [styles.action, { backgroundColor: theme.fill, transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
            <action.icon size={22} weight={action.weight || "fill"} color={action.on ? theme.red : theme.blue} />
            <T size={12} weight="600" color={action.on ? theme.red : theme.blue}>{action.label}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Tabs({ tabs, tab, setTab }) {
  const theme = useChatTheme();
  const [width, setWidth] = useState(0);
  const index = tabs.findIndex(([key]) => key === tab);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(index * (width / tabs.length), { damping: 20, stiffness: 220 });
  }, [index, width, tabs.length, x]);
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.tabs, { backgroundColor: theme.bg, borderBottomColor: theme.line }]}>
      {tabs.map(([key, label]) => (
        <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => { tap(); setTab(key); }} style={styles.tab}>
          <T size={14} weight="600" color={tab === key ? theme.blue : theme.text2}>{label}</T>
        </Pressable>
      ))}
      <Animated.View style={[styles.tabBar, { width: width / tabs.length, backgroundColor: theme.blue }, bar]} />
    </View>
  );
}

function MediaGrid({ media, voices, tab, voiceLabel }) {
  const theme = useChatTheme();
  if (tab === "media") {
    return media.length ? (
      <View style={[styles.media, { backgroundColor: theme.bg }]}>
        {media.map((src, index) => <Image key={`${index}-${String(src).slice(-16)}`} source={{ uri: src }} recyclingKey={String(src).slice(-32)} style={styles.mediaCell} contentFit="cover" transition={120} />)}
      </View>
    ) : <T size={14} color={theme.text2} style={styles.empty}>Ancora nessuna foto condivisa.</T>;
  }
  return voices.length ? (
    <View style={{ backgroundColor: theme.bg }}>
      {voices.map((message, index) => (
        <View key={message.id || index} style={[styles.voice, { borderBottomColor: theme.line }]}>
          <VoiceBubble message={message} color={theme.text} knob={theme.fill} />
          <T size={12.5} color={theme.text2}>{voiceLabel(message)} · {message.time}</T>
        </View>
      ))}
    </View>
  ) : <T size={14} color={theme.text2} style={styles.empty}>Ancora nessun messaggio vocale.</T>;
}

function Line({ children, label, onPress, first }) {
  const theme = useChatTheme();
  const Box = onPress ? Pressable : View;
  return (
    <Box onPress={onPress ? () => { tap(); onPress(); } : undefined} style={({ pressed } = {}) => [styles.line, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }, pressed && { backgroundColor: theme.fill }]}>
      {children}
      {label ? <T size={13} color={theme.text2}>{label}</T> : null}
    </Box>
  );
}

function Confirm({ open, onClose, text, action, icon, onConfirm }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <Hint center>{text}</Hint>
      <SheetRow icon={icon} danger label={action} onPress={onConfirm} />
      <SheetRow center label="Annulla" onPress={onClose} />
    </Sheet>
  );
}

function ChatInfo({ thread }) {
  const store = useStore();
  const live = useLive();
  const theme = useChatTheme();
  const prefs = store.prefs;
  const flags = store.dmFlags?.[thread.id] || {};
  const [tab, setTab] = useState("media");
  const [confirm, setConfirm] = useState(null);
  const [note, flash] = useFlash();
  const person = personOf(thread, PEOPLE, CONTACTS);
  const status = thread.live
    ? (prefs.activity === false ? "" : thread.online ? "online" : seenText(thread.other))
    : (prefs.activity === false ? "" : "visto di recente");
  const handle = person?.handle ? `@${String(person.handle).replace(/^@/, "")}` : "";
  const media = (thread.messages || []).filter((message) => message.kind === "image" && !message.unsent).map((message) => message.image).reverse();
  const voices = (thread.messages || []).filter((message) => message.kind === "audio" && !message.unsent).reverse();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title="Info" />
      <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={{ paddingBottom: 30 }}>
        <Hero
          face={<Face src={thread.src} name={thread.name} size={96} online={thread.online && prefs.activity !== false} dot={18} ring={3} />}
          title={thread.name}
          meta={status}
          metaBlue={thread.online}
          actions={[
            { label: "Chiama", icon: Phone, run: () => placeCall(live, thread, "voice") },
            { label: "Video", icon: Video, run: () => placeCall(live, thread, "video") },
            { label: flags.muted ? "Riattiva" : "Silenzia", icon: flags.muted ? BellOff : Bell, on: flags.muted, run: () => store.setDmFlag(thread.id, "muted", !flags.muted) },
            { label: "Cerca", icon: Search, weight: "bold", run: () => toSearch(thread) },
          ]}
        />
        <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
          {person?.bio ? <Line first label="Bio"><T size={15} style={{ lineHeight: 21 }}>{person.bio}</T></Line> : null}
          {handle ? <Line first={!person?.bio} label="Nome utente" onPress={() => { Clipboard.setStringAsync(handle).catch(() => {}); flash("Nome utente copiato"); }}><T size={15} color={theme.blue}>{handle}</T></Line> : null}
          {person?.craft ? <Line label="Mestiere"><T size={15}>{person.craft}{person.city ? ` · ${person.city}` : ""}</T></Line> : null}
          {person && !person.live ? <Line onPress={() => router.push(`/person/${person.handle}`)}><T size={15} color={theme.blue}>Visualizza profilo</T></Line> : null}
        </View>
        <ChatPrefs id={thread.id} />
        <Tabs tabs={[["media", "Media"], ["voice", "Vocali"]]} tab={tab} setTab={setTab} />
        <MediaGrid media={media} voices={voices} tab={tab} voiceLabel={(message) => (message.from === "me" ? "Tu" : thread.name)} />
        <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
          <Line first onPress={() => { store.setDmFlag(thread.id, "archivedAt", flags.archivedAt ? null : Date.now()); flash(flags.archivedAt ? "Riportata nelle chat" : "Chat archiviata"); }}>
            <View style={styles.plain}><Archive size={20} color={theme.blue} /><T size={15} weight="500" color={theme.blue}>{flags.archivedAt ? "Ripristina chat" : "Archivia chat"}</T></View>
          </Line>
          {!thread.live ? (
            <Line onPress={() => setConfirm("clear")}>
              <View style={styles.plain}><Eraser size={20} color={theme.red} /><T size={15} weight="500" color={theme.red}>Svuota cronologia</T></View>
            </Line>
          ) : null}
          <Line onPress={() => setConfirm("delete")}>
            <View style={styles.plain}><Trash size={20} color={theme.red} /><T size={15} weight="500" color={theme.red}>Elimina chat</T></View>
          </Line>
        </View>
      </ScrollView>
      <Toast text={note} />
      <Confirm
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        text={confirm === "clear" ? `Svuotare tutti i messaggi con ${thread.name}? Non si può annullare.` : `Eliminare la chat con ${thread.name}?`}
        icon={confirm === "clear" ? Eraser : Trash}
        action={confirm === "clear" ? "Svuota cronologia" : "Elimina chat"}
        onConfirm={() => {
          if (confirm === "clear") {
            store.updateChat(thread.id, { messages: [], preview: "", unread: false, cleared: true });
            setConfirm(null);
            flash("Cronologia svuotata");
            return;
          }
          setConfirm(null);
          if (thread.live) store.setDmFlag(thread.id, "hiddenAt", Date.now());
          else store.deleteChat(thread.id);
          router.dismissTo("/messages");
        }}
      />
    </View>
  );
}

async function pickGroupPhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.25 });
  if (result.canceled || !result.assets?.[0]) return null;
  // Live groups keep the photo as a small data URL (the hub's limit is 160 kB).
  const url = await fileToDataUrl(result.assets[0].uri, "image/jpeg").catch(() => null);
  return url && url.length <= 160_000 ? url : keepMedia(result.assets[0].uri, "group");
}

function GroupInfo({ thread }) {
  const store = useStore();
  const live = useLive();
  const theme = useChatTheme();
  const prefs = store.prefs;
  const me = live?.me?.handle;
  const owner = thread.live ? thread.owner === me : true;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.name);
  const [about, setAbout] = useState(thread.about || "");
  const [photo, setPhoto] = useState(thread.photo || "");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState(() => new Set());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tab, setTab] = useState("members");
  const [note, flash] = useFlash();
  const flags = store.dmFlags?.[thread.id] || {};
  const muted = Boolean(flags.muted);
  const members = thread.live ? thread.conv.members : [{ name: store.profile?.name || "Tu", src: store.profile?.src || AVATAR, me: true }, ...(thread.members || [])];
  const online = thread.live ? members.filter((member) => member.online).length : 0;
  const inGroup = new Set(members.map((member) => member.handle || member.name));
  const candidates = thread.live
    ? Object.values(live.people).filter((person) => person.handle !== me && !inGroup.has(person.handle) && !personHidden(prefs, person.name, true)).map((person) => ({ key: person.handle, name: person.name, src: person.src, meta: seenText(person) }))
    : CONTACTS.filter((person) => !inGroup.has(person.name)).map((person) => ({ key: person.name, name: person.name, src: person.src, meta: person.meta }));
  const media = (thread.messages || []).filter((message) => message.kind === "image" && !message.unsent).map((message) => message.image).reverse();
  const voices = (thread.messages || []).filter((message) => message.kind === "audio" && !message.unsent).reverse();
  const link = `space.app/+${String(thread.id).replace(/[^a-z0-9]/gi, "").slice(-10)}`;

  function save() {
    const patch = {};
    if (title.trim() && title.trim() !== thread.name) patch.title = title.trim();
    if (about.trim() !== (thread.about || "")) patch.about = about.trim();
    if (photo !== (thread.photo || "")) patch.photo = photo;
    if (Object.keys(patch).length) {
      if (thread.live) live.updateGroup(thread.id, patch);
      else store.updateChat(thread.id, { ...(patch.title ? { name: patch.title } : {}), ...(patch.about != null ? { about: patch.about } : {}), ...(patch.photo != null ? { photo: patch.photo } : {}) });
      flash("Salvato");
    }
    setEditing(false);
  }

  function addPicked() {
    const list = [...toAdd];
    if (!list.length) return;
    if (thread.live) live.updateGroup(thread.id, { add: list });
    else {
      const added = CONTACTS.filter((person) => list.includes(person.name));
      store.updateChat(thread.id, {
        members: [...(thread.members || []), ...added],
        messages: [...(thread.messages || []), { from: "system", text: `Hai aggiunto ${added.map((person) => person.name.split(" ")[0]).join(", ")}.` }],
      });
    }
    setToAdd(new Set());
    setAdding(false);
    flash("Membri aggiunti");
  }

  function remove(member) {
    tap();
    if (thread.live) live.updateGroup(thread.id, { remove: [member.handle] });
    else store.updateChat(thread.id, { members: (thread.members || []).filter((item) => item.name !== member.name) });
  }

  const right = owner ? (
    editing ? <HeadAction title="Salva" disabled={!title.trim()} onPress={save} /> : <HeadAction title="Modifica" onPress={() => { setTitle(thread.name); setAbout(thread.about || ""); setPhoto(thread.photo || ""); setEditing(true); }} />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={editing ? "Modifica gruppo" : "Info gruppo"} right={right} backIcon={editing ? Close : undefined} onBack={editing ? () => setEditing(false) : undefined} />
      <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {editing ? (
          <View style={{ paddingTop: 6, paddingBottom: 10, backgroundColor: theme.bg }}>
            <Pressable accessibilityLabel="Cambia foto" onPress={async () => { tap(); const next = await pickGroupPhoto(); if (next) setPhoto(next); }} style={{ alignSelf: "center", marginTop: 10, marginBottom: 12 }}>
              <GroupAvatar photo={photo} title={title || thread.name} size={96} />
              <View style={[styles.badgeCam, { backgroundColor: theme.blue, borderColor: theme.bg }]}><Camera size={12} weight="fill" color="#fff" /></View>
            </Pressable>
            <ToneRow photo={photo} title={title} onPick={setPhoto} />
            <View style={styles.field}>
              <T size={13} weight="600" color={theme.blue}>Nome</T>
              <TextInput value={title} maxLength={40} onChangeText={setTitle} accessibilityLabel="Nome del gruppo" style={[styles.input, { backgroundColor: theme.fill, color: theme.text }]} />
            </View>
            <View style={styles.field}>
              <T size={13} weight="600" color={theme.blue}>Descrizione</T>
              <TextInput value={about} maxLength={255} multiline onChangeText={setAbout} placeholder="Di cosa parla questo gruppo?" placeholderTextColor={theme.text2} style={[styles.input, { backgroundColor: theme.fill, color: theme.text, minHeight: 72, textAlignVertical: "top" }]} />
            </View>
          </View>
        ) : (
          <>
            <Hero
              face={<GroupAvatar photo={thread.photo} title={thread.name} size={96} />}
              title={thread.name}
              meta={`${members.length} membri${thread.live ? `, ${online} online` : ""}`}
              actions={[
                { label: "Chiama", icon: Phone, run: () => placeCall(live, thread, "voice") },
                { label: "Video", icon: Video, run: () => placeCall(live, thread, "video") },
                { label: muted ? "Riattiva" : "Silenzia", icon: muted ? BellOff : Bell, on: muted, run: () => store.setDmFlag(thread.id, "muted", !muted) },
                { label: "Cerca", icon: Search, weight: "bold", run: () => toSearch(thread) },
              ]}
            />
            <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
              {thread.about ? (
                <Line first label="Descrizione"><T size={15} style={{ lineHeight: 21 }}>{thread.about}</T></Line>
              ) : owner ? (
                <Line first onPress={() => setEditing(true)}><T size={15} color={theme.blue}>Aggiungi una descrizione</T></Line>
              ) : null}
              <Line first={!thread.about && !owner} label="Link di invito · tocca per copiare" onPress={() => { Clipboard.setStringAsync(`https://${link}`).catch(() => {}); flash("Link di invito copiato"); }}>
                <T size={15} color={theme.blue}>{link}</T>
              </Line>
            </View>
          </>
        )}
        {!editing ? (
          <>
            <ChatPrefs id={thread.id} />
            <Tabs tabs={[["members", "Membri"], ["media", "Media"], ["voice", "Vocali"]]} tab={tab} setTab={setTab} />
            {tab === "members" ? (
              <View style={{ backgroundColor: theme.bg }}>
                {owner ? (
                  <Pressable onPress={() => { tap(); setAdding((value) => !value); }} style={({ pressed }) => [styles.add, pressed && { backgroundColor: theme.fill }]}>
                    <View style={[styles.addIcon, { backgroundColor: theme.dark ? "#0a2236" : "#e3f2fe" }]}><UserPlus size={20} weight="bold" color={theme.blue} /></View>
                    <T size={15} weight="600" color={theme.blue}>Aggiungi membri</T>
                  </Pressable>
                ) : null}
                {adding ? (
                  <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line, paddingBottom: 8 }}>
                    {candidates.length ? candidates.map((person) => (
                      <CheckRow key={person.key} on={toAdd.has(person.key)} src={person.src} name={person.name} meta={person.meta} onPress={() => setToAdd((prev) => { const next = new Set(prev); if (next.has(person.key)) next.delete(person.key); else next.add(person.key); return next; })} />
                    )) : <Hint>Ci sono già tutti.</Hint>}
                    {toAdd.size ? (
                      <Pressable onPress={() => { tap(); addPicked(); }} style={[styles.addGo, { backgroundColor: theme.blue }]}><T size={14} weight="600" color="#fff">{`Aggiungi ${toAdd.size}`}</T></Pressable>
                    ) : null}
                  </View>
                ) : null}
                {[...members].sort((x, y) => Number(Boolean(y.online)) - Number(Boolean(x.online))).map((member) => {
                  const isMe = member.me || (member.handle && member.handle === me);
                  const isOwner = thread.live ? member.handle === thread.owner : member.me;
                  return (
                    <View key={member.handle || member.name} style={styles.member}>
                      <Face src={member.src} name={member.name} size={46} online={member.online} dot={13} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T size={15} weight="600" lines={1}>{isMe ? `${member.name} (tu)` : member.name}</T>
                        <T size={13.5} lines={1} color={member.online ? theme.blue : theme.text2}>{thread.live ? (member.online ? "online" : seenText(member)) : (member.meta || "")}</T>
                      </View>
                      {isOwner ? <T size={12.5} weight="600" color={theme.blue}>proprietario</T> : owner && !isMe ? (
                        <Pressable accessibilityLabel={`Rimuovi ${member.name}`} onPress={() => remove(member)} hitSlop={8} style={{ padding: 8 }}><UserMinus size={18} color={theme.text3} /></Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <MediaGrid media={media} voices={voices} tab={tab} voiceLabel={(message) => message.senderName || (message.from === "me" ? "Tu" : "")} />
            )}
            <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
              {thread.live ? (
                <Line first onPress={() => setConfirmLeave(true)}>
                  <View style={styles.plain}><LogOut size={20} color={theme.red} /><T size={15} weight="500" color={theme.red}>Esci dal gruppo</T></View>
                </Line>
              ) : <Hint style={{ marginVertical: 12 }}>Gruppo demo: salvato solo su questo dispositivo.</Hint>}
            </View>
          </>
        ) : null}
      </ScrollView>
      <Toast text={note} />
      <Confirm
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        text="Uscire dal gruppo? Non riceverai più i suoi messaggi."
        icon={LogOut}
        action="Esci dal gruppo"
        onConfirm={() => { setConfirmLeave(false); live.leaveGroup(thread.id); router.dismissTo("/messages"); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 3, paddingTop: 14, paddingHorizontal: INSET, paddingBottom: 16 },
  actions: { flexDirection: "row", gap: 8, width: "100%", marginTop: 14 },
  action: { flex: 1, alignItems: "center", gap: 4, paddingTop: 10, paddingBottom: 8, borderRadius: 12 },
  line: { gap: 2, paddingVertical: 11, paddingHorizontal: INSET },
  plain: { flexDirection: "row", alignItems: "center", gap: 10 },
  tabs: { flexDirection: "row", marginTop: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: 42, alignItems: "center", justifyContent: "center" },
  tabBar: { position: "absolute", left: 0, bottom: -1, height: 2.5, borderTopLeftRadius: 99, borderTopRightRadius: 99 },
  media: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  mediaCell: { width: "32.9%", aspectRatio: 1 },
  voice: { gap: 4, paddingVertical: 8, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { textAlign: "center", paddingVertical: 28 },
  add: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, paddingHorizontal: INSET },
  addIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  addGo: { height: 40, marginTop: 6, marginHorizontal: INSET, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  member: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 7, paddingHorizontal: INSET },
  checkMark: { position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  badgeCam: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  tones: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, paddingTop: 6, paddingHorizontal: INSET, paddingBottom: 10 },
  field: { gap: 4, marginTop: 10, marginHorizontal: INSET },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, fontSize: 15 },
});
