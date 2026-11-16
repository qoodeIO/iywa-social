import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStore } from "../../lib/store";
import { useInboxRules, useThreads } from "../../live/threads";
import { defaultFolders, isGroupChat } from "../../live/format";
import { requestFolder } from "../../live/chatBus";
import { HeadAction, Hint, SubHead, ThreadFace, ToggleCell, useChatTheme } from "../../ui/chat";
import { CheckRow } from "../../ui/chatPick";
import { AddCircle, BellOff, CheckCheck, Close, Users } from "../../ui/chatIcons";
import { T, tap } from "../../ui/kit";
import { Card, Cap } from "./folders";

export default function FolderEdit() {
  const theme = useChatTheme();
  const store = useStore();
  const threads = useThreads();
  const { hiddenOut } = useInboxRules();
  const { id } = useLocalSearchParams();
  const folders = store.dmFolders || defaultFolders();
  const existing = id ? folders.find((entry) => entry.id === id) : null;
  const [draft, setDraft] = useState(() => (existing
    ? { ...existing, chats: [...(existing.chats || [])] }
    : { id: `f-${Date.now().toString(36)}`, name: "", people: false, groups: false, noMuted: false, noRead: false, chats: [], fresh: true }));
  const [picking, setPicking] = useState(false);
  const patch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const toggleChat = (chatId) => patch({ chats: draft.chats.includes(chatId) ? draft.chats.filter((value) => value !== chatId) : [...draft.chats, chatId] });
  const valid = Boolean(draft.name.trim() && (draft.people || draft.groups || draft.chats.length || draft.unreadOnly));
  const alive = threads.filter((item) => !hiddenOut(item));
  const border = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line };

  function save() {
    if (!valid) return;
    const clean = { ...draft, name: draft.name.trim() };
    delete clean.fresh;
    const exists = folders.some((entry) => entry.id === clean.id);
    store.setDmFolders(exists ? folders.map((entry) => (entry.id === clean.id ? clean : entry)) : [...folders, clean]);
    requestFolder(clean.id);
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={draft.fresh ? "Nuova cartella" : "Modifica cartella"} backIcon={Close} right={<HeadAction title="Salva" disabled={!valid} onPress={save} />} />
      <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Cap>Nome della cartella</Cap>
        <Card>
          <TextInput value={draft.name} maxLength={16} autoFocus={draft.fresh} onChangeText={(name) => patch({ name })} placeholder="Nome della cartella" placeholderTextColor={theme.text2} accessibilityLabel="Nome della cartella" style={{ height: 46, paddingHorizontal: 14, color: theme.text, fontSize: 16 }} />
        </Card>
        <Cap>Chat incluse</Cap>
        <Card>
          <ToggleCell first on={draft.people} icon={Users} tone="blue" label="Chat personali" onPress={() => patch({ people: !draft.people })} />
          <ToggleCell on={draft.groups} icon={Users} tone="green" label="Gruppi" onPress={() => patch({ groups: !draft.groups })} />
          <Pressable onPress={() => { tap(); setPicking((value) => !value); }} style={({ pressed }) => [styles.cell, border, pressed && { backgroundColor: theme.fill }]}>
            <AddCircle size={22} weight="fill" color={theme.blue} />
            <View style={{ flex: 1 }}>
              <T size={15.5} weight="500" color={theme.blue}>Aggiungi chat</T>
              {draft.chats.length ? <T size={13} color={theme.text2}>{draft.chats.length} selezionate</T> : null}
            </View>
          </Pressable>
          {picking ? alive.map((item) => (
            <View key={item.id} style={border}>
              <CheckRow on={draft.chats.includes(item.id)} name={item.name} meta={isGroupChat(item) ? "Gruppo" : "Personale"} face={<ThreadFace thread={{ ...item, online: false }} size={46} />} onPress={() => toggleChat(item.id)} />
            </View>
          )) : null}
        </Card>
        <Cap>Chat escluse</Cap>
        <Card>
          <ToggleCell first on={draft.noMuted} icon={BellOff} tone="red" label="Silenziate" onPress={() => patch({ noMuted: !draft.noMuted })} />
          <ToggleCell on={draft.noRead} icon={CheckCheck} iconWeight="bold" tone="teal" label="Lette" onPress={() => patch({ noRead: !draft.noRead })} />
        </Card>
        <Hint style={{ marginHorizontal: 30 }}>La cartella mostra le chat incluse, tolte quelle escluse.</Hint>
        {!draft.fresh ? (
          <Card>
            <Pressable onPress={() => { tap(); store.setDmFolders(folders.filter((entry) => entry.id !== draft.id)); router.back(); }} style={({ pressed }) => [styles.cell, { justifyContent: "center" }, pressed && { backgroundColor: theme.fill }]}>
              <T size={15.5} weight="500" color={theme.red}>Elimina cartella</T>
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingVertical: 4, paddingHorizontal: 14 },
});
