import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useStore } from "../../../lib/store";
import { t } from "../../../lib/i18n";
import { useLive } from "../../../live/LiveStore";
import { useThreads } from "../../../live/threads";
import { seenText } from "../../../live/format";
import { placeCall } from "../../../live/actions";
import { fileToDataUrl } from "../../../live/media";
import { requestFind } from "../../../live/chatBus";
import { ChatPrefs, Face, GroupAvatar, HeadAction, Hint, SheetRow, SubHead, Toast, VoiceBubble, useChatTheme, useFlash } from "../../../ui/chat";
import { Archive, Bell, BellOff, Camera, Close, LogOut, Phone, Search, Trash, UserMinus, UserPlus, Video } from "../../../ui/chatIcons";
import { Sheet, T, tap } from "../../../ui/kit";
import { CheckRow, ToneRow } from "../../../ui/chatPick";
import { INSET } from "../../../theme";
import { usePeople } from "../../../live/people";
import { useProfile } from "../../../lib/social";
import { openTab } from "../../../lib/tabs";

export default function Info() {
  const { id } = useLocalSearchParams();
  const threads = useThreads();
  const thread = threads.find((item) => item.id === id);
  const theme = useChatTheme();
  useEffect(() => {
    if (!thread && router.canGoBack()) router.back();
  }, [thread]);
  if (!thread) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return thread.group ? <GroupInfo thread={thread} /> : <ChatInfo thread={thread} />;
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
    ) : <T size={14} color={theme.text2} style={styles.empty}>{t("Ancora nessuna foto condivisa.")}</T>;
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
  ) : <T size={14} color={theme.text2} style={styles.empty}>{t("Ancora nessun messaggio vocale.")}</T>;
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
      <SheetRow center label={t("Annulla")} onPress={onClose} />
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
  const otherHandle = thread.other?.handle || "";
  const { data: profile } = useProfile(otherHandle);
  const status = prefs.activity === false ? "" : thread.online ? t("online") : seenText(thread.other);
  const handle = otherHandle ? `@${otherHandle}` : "";
  const bio = profile?.bio || "";
  const media = (thread.messages || []).filter((message) => message.kind === "image" && !message.unsent).map((message) => message.image).reverse();
  const voices = (thread.messages || []).filter((message) => message.kind === "audio" && !message.unsent).reverse();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={t("Info")} />
      <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={{ paddingBottom: 30 }}>
        <Hero
          face={<Face src={thread.src || profile?.avatar} name={thread.name} size={96} online={thread.online && prefs.activity !== false} dot={18} ring={3} />}
          title={thread.name}
          meta={status}
          metaBlue={thread.online}
          actions={[
            { label: t("Chiama"), icon: Phone, run: () => placeCall(live, thread, "voice") },
            { label: t("Video"), icon: Video, run: () => placeCall(live, thread, "video") },
            { label: flags.muted ? t("Riattiva") : t("Silenzia"), icon: flags.muted ? BellOff : Bell, on: flags.muted, run: () => store.setDmFlag(thread.id, "muted", !flags.muted) },
            { label: t("Cerca"), icon: Search, weight: "bold", run: () => toSearch(thread) },
          ]}
        />
        <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
          {bio ? <Line first label={t("Bio")}><T size={15} style={{ lineHeight: 21 }}>{bio}</T></Line> : null}
          {handle ? <Line first={!bio} label={t("Nome utente")} onPress={() => { Clipboard.setStringAsync(handle).catch(() => {}); flash(t("Nome utente copiato")); }}><T size={15} color={theme.blue}>{handle}</T></Line> : null}
          {otherHandle ? <Line onPress={() => router.push(`/person/${otherHandle}`)}><T size={15} color={theme.blue}>{t("Visualizza profilo")}</T></Line> : null}
        </View>
        <ChatPrefs id={thread.id} />
        <Tabs tabs={[["media", t("Media")], ["voice", t("Vocali")]]} tab={tab} setTab={setTab} />
        <MediaGrid media={media} voices={voices} tab={tab} voiceLabel={(message) => (message.from === "me" ? t("Tu") : thread.name)} />
        <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
          <Line first onPress={() => { store.setDmFlag(thread.id, "archivedAt", flags.archivedAt ? null : Date.now()); flash(flags.archivedAt ? t("Riportata nelle chat") : t("Chat archiviata")); }}>
            <View style={styles.plain}><Archive size={20} color={theme.blue} /><T size={15} weight="500" color={theme.blue}>{flags.archivedAt ? t("Ripristina chat") : t("Archivia chat")}</T></View>
          </Line>
          <Line onPress={() => setConfirm("delete")}>
            <View style={styles.plain}><Trash size={20} color={theme.red} /><T size={15} weight="500" color={theme.red}>{t("Elimina chat")}</T></View>
          </Line>
        </View>
      </ScrollView>
      <Toast text={note} />
      <Confirm
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        text={t("Eliminare la chat con {name}?", { name: thread.name })}
        icon={Trash}
        action={t("Elimina chat")}
        onConfirm={() => {
          setConfirm(null);
          store.setDmFlag(thread.id, "hiddenAt", Date.now());
          openTab("messages");
        }}
      />
    </View>
  );
}

// The hub keeps a group photo as a small data URL (160 kB at most); "" when it doesn't fit.
async function pickGroupPhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({ preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,  mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.25 });
  if (result.canceled || !result.assets?.[0]) return null;
  const url = await fileToDataUrl(result.assets[0].uri, "image/jpeg").catch(() => null);
  return url && url.length <= 160_000 ? url : "";
}

function GroupInfo({ thread }) {
  const store = useStore();
  const live = useLive();
  const theme = useChatTheme();
  const me = live?.me?.handle;
  const owner = thread.owner === me;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.name);
  const [about, setAbout] = useState(thread.about || "");
  const [photo, setPhoto] = useState(thread.photo || "");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState(() => new Set());
  const [addQuery, setAddQuery] = useState("");
  const people = usePeople(adding ? addQuery : "");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tab, setTab] = useState("members");
  const [note, flash] = useFlash();
  const flags = store.dmFlags?.[thread.id] || {};
  const muted = Boolean(flags.muted);
  const members = thread.conv.members;
  const online = members.filter((member) => member.online).length;
  const inGroup = new Set(members.map((member) => member.handle));
  const candidates = (people.searching ? people.results : [...people.following, ...people.suggested])
    .filter((person) => !inGroup.has(person.handle))
    .map((person) => ({ key: person.handle, name: person.name, src: person.src, meta: person.meta }));
  const media = (thread.messages || []).filter((message) => message.kind === "image" && !message.unsent).map((message) => message.image).reverse();
  const voices = (thread.messages || []).filter((message) => message.kind === "audio" && !message.unsent).reverse();
  const link = `iywa.app/+${String(thread.id).replace(/[^a-z0-9]/gi, "").slice(-10)}`;

  function save() {
    const patch = {};
    if (title.trim() && title.trim() !== thread.name) patch.title = title.trim();
    if (about.trim() !== (thread.about || "")) patch.about = about.trim();
    if (photo !== (thread.photo || "")) patch.photo = photo;
    if (Object.keys(patch).length) {
      live.updateGroup(thread.id, patch);
      flash(t("Salvato"));
    }
    setEditing(false);
  }

  function addPicked() {
    const list = [...toAdd];
    if (!list.length) return;
    live.updateGroup(thread.id, { add: list });
    setToAdd(new Set());
    setAddQuery("");
    setAdding(false);
    flash(t("Membri aggiunti"));
  }

  function remove(member) {
    tap();
    live.updateGroup(thread.id, { remove: [member.handle] });
  }

  const right = owner ? (
    editing ? <HeadAction title={t("Salva")} disabled={!title.trim()} onPress={save} /> : <HeadAction title={t("Modifica")} onPress={() => { setTitle(thread.name); setAbout(thread.about || ""); setPhoto(thread.photo || ""); setEditing(true); }} />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={editing ? t("Modifica gruppo") : t("Info gruppo")} right={right} backIcon={editing ? Close : undefined} onBack={editing ? () => setEditing(false) : undefined} />
      <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {editing ? (
          <View style={{ paddingTop: 6, paddingBottom: 10, backgroundColor: theme.bg }}>
            <Pressable accessibilityLabel={t("Cambia foto")} onPress={async () => { tap(); const next = await pickGroupPhoto(); if (next) setPhoto(next); else if (next === "") flash(t("Foto troppo grande, scegline una più piccola.")); }} style={{ alignSelf: "center", marginTop: 10, marginBottom: 12 }}>
              <GroupAvatar photo={photo} title={title || thread.name} size={96} />
              <View style={[styles.badgeCam, { backgroundColor: theme.blue, borderColor: theme.bg }]}><Camera size={12} weight="fill" color="#fff" /></View>
            </Pressable>
            <ToneRow photo={photo} title={title} onPick={setPhoto} />
            <View style={styles.field}>
              <T size={13} weight="600" color={theme.blue}>{t("Nome")}</T>
              <TextInput value={title} maxLength={40} onChangeText={setTitle} accessibilityLabel={t("Nome del gruppo")} style={[styles.input, { backgroundColor: theme.fill, color: theme.text }]} />
            </View>
            <View style={styles.field}>
              <T size={13} weight="600" color={theme.blue}>{t("Descrizione")}</T>
              <TextInput value={about} maxLength={255} multiline onChangeText={setAbout} placeholder={t("Di cosa parla questo gruppo?")} placeholderTextColor={theme.text2} style={[styles.input, { backgroundColor: theme.fill, color: theme.text, minHeight: 72, textAlignVertical: "top" }]} />
            </View>
          </View>
        ) : (
          <>
            <Hero
              face={<GroupAvatar photo={thread.photo} title={thread.name} size={96} />}
              title={thread.name}
              meta={t("{n} membri, {online} online", { n: members.length, online })}
              actions={[
                { label: t("Chiama"), icon: Phone, run: () => placeCall(live, thread, "voice") },
                { label: t("Video"), icon: Video, run: () => placeCall(live, thread, "video") },
                { label: muted ? t("Riattiva") : t("Silenzia"), icon: muted ? BellOff : Bell, on: muted, run: () => store.setDmFlag(thread.id, "muted", !muted) },
                { label: t("Cerca"), icon: Search, weight: "bold", run: () => toSearch(thread) },
              ]}
            />
            <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
              {thread.about ? (
                <Line first label={t("Descrizione")}><T size={15} style={{ lineHeight: 21 }}>{thread.about}</T></Line>
              ) : owner ? (
                <Line first onPress={() => setEditing(true)}><T size={15} color={theme.blue}>{t("Aggiungi una descrizione")}</T></Line>
              ) : null}
              <Line first={!thread.about && !owner} label={t("Link di invito · tocca per copiare")} onPress={() => { Clipboard.setStringAsync(`https://${link}`).catch(() => {}); flash(t("Link di invito copiato")); }}>
                <T size={15} color={theme.blue}>{link}</T>
              </Line>
            </View>
          </>
        )}
        {!editing ? (
          <>
            <ChatPrefs id={thread.id} />
            <Tabs tabs={[["members", t("Membri")], ["media", t("Media")], ["voice", t("Vocali")]]} tab={tab} setTab={setTab} />
            {tab === "members" ? (
              <View style={{ backgroundColor: theme.bg }}>
                {owner ? (
                  <Pressable onPress={() => { tap(); setAdding((value) => !value); }} style={({ pressed }) => [styles.add, pressed && { backgroundColor: theme.fill }]}>
                    <View style={[styles.addIcon, { backgroundColor: theme.dark ? "#0a2236" : "#e3f2fe" }]}><UserPlus size={20} weight="bold" color={theme.blue} /></View>
                    <T size={15} weight="600" color={theme.blue}>{t("Aggiungi membri")}</T>
                  </Pressable>
                ) : null}
                {adding ? (
                  <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line, paddingBottom: 8 }}>
                    <TextInput value={addQuery} onChangeText={setAddQuery} placeholder={t("Cerca persone")} placeholderTextColor={theme.text2} autoCorrect={false} autoCapitalize="none" accessibilityLabel={t("Cerca persone")} style={[styles.input, { backgroundColor: theme.fill, color: theme.text, marginHorizontal: INSET, marginBottom: 6 }]} />
                    {people.loading ? <Hint center>{t("Caricamento…")}</Hint> : candidates.length ? candidates.map((person) => (
                      <CheckRow key={person.key} on={toAdd.has(person.key)} src={person.src} name={person.name} meta={person.meta} onPress={() => setToAdd((prev) => { const next = new Set(prev); if (next.has(person.key)) next.delete(person.key); else next.add(person.key); return next; })} />
                    )) : <Hint>{people.searching ? t("Nessun account trovato.") : t("Cerca le persone da aggiungere per nome o nome utente.")}</Hint>}
                    {toAdd.size ? (
                      <Pressable onPress={() => { tap(); addPicked(); }} style={[styles.addGo, { backgroundColor: theme.blue }]}><T size={14} weight="600" color="#fff">{t("Aggiungi {n}", { n: toAdd.size })}</T></Pressable>
                    ) : null}
                  </View>
                ) : null}
                {[...members].sort((x, y) => Number(Boolean(y.online)) - Number(Boolean(x.online))).map((member) => {
                  const isMe = member.handle === me;
                  const isOwner = member.handle === thread.owner;
                  return (
                    <View key={member.handle} style={styles.member}>
                      <Pressable disabled={isMe} accessibilityLabel={member.name} onPress={() => { tap(); router.push(`/person/${member.handle}`); }} style={styles.memberMain}>
                        <Face src={member.src} name={member.name} size={46} online={member.online} dot={13} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <T size={15} weight="600" lines={1}>{isMe ? t("{name} (tu)", { name: member.name }) : member.name}</T>
                          <T size={13.5} lines={1} color={member.online ? theme.blue : theme.text2}>{member.online ? t("online") : seenText(member)}</T>
                        </View>
                      </Pressable>
                      {isOwner ? <T size={12.5} weight="600" color={theme.blue}>{t("proprietario")}</T> : owner && !isMe ? (
                        <Pressable accessibilityLabel={t("Rimuovi {name}", { name: member.name })} onPress={() => remove(member)} hitSlop={8} style={{ padding: 8 }}><UserMinus size={18} color={theme.text3} /></Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <MediaGrid media={media} voices={voices} tab={tab} voiceLabel={(message) => message.senderName || (message.from === "me" ? t("Tu") : "")} />
            )}
            <View style={{ marginTop: 10, backgroundColor: theme.bg }}>
              <Line first onPress={() => setConfirmLeave(true)}>
                <View style={styles.plain}><LogOut size={20} color={theme.red} /><T size={15} weight="500" color={theme.red}>{t("Esci dal gruppo")}</T></View>
              </Line>
            </View>
          </>
        ) : null}
      </ScrollView>
      <Toast text={note} />
      <Confirm
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        text={t("Uscire dal gruppo? Non riceverai più i suoi messaggi.")}
        icon={LogOut}
        action={t("Esci dal gruppo")}
        onConfirm={() => { setConfirmLeave(false); live.leaveGroup(thread.id); openTab("messages"); }}
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
  memberMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 14 },
  checkMark: { position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  badgeCam: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  tones: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, paddingTop: 6, paddingHorizontal: INSET, paddingBottom: 10 },
  field: { gap: 4, marginTop: 10, marginHorizontal: INSET },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, fontSize: 15 },
});
