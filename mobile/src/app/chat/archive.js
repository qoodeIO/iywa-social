import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { useLive } from "../../live/LiveStore";
import { useInboxRules, useThreads } from "../../live/threads";
import { demoTime, listTime, tickFor } from "../../live/format";
import { EmptyState, Hint, SubHead, Toast, useChatTheme, useFlash } from "../../ui/chat";
import { Archive } from "../../ui/chatIcons";
import { InboxRow } from "../messages";

export default function ArchivedChats() {
  const theme = useChatTheme();
  const store = useStore();
  const live = useLive();
  const threads = useThreads();
  const { hiddenOut, isArchived, isMuted, unreadOf } = useInboxRules();
  const [hint, flash] = useFlash();
  const blocked = store.prefs.blocked || [];
  const archived = threads.filter((item) => !hiddenOut(item) && isArchived(item) && (item.live || item.members || !blocked.includes(item.name)));
  const receipts = store.prefs.readReceipts !== false;

  function rowTick(item) {
    const last = item.messages?.[item.messages.length - 1];
    if (!last || last.from !== "me" || last.kind === "call") return null;
    return tickFor(last, item, receipts);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={t("Chat archiviate")} meta={`${archived.length}`} />
      <FlatList
        data={archived}
        keyExtractor={(item) => item.id}
        style={{ backgroundColor: theme.page }}
        ListHeaderComponent={<Hint>{t("Le chat archiviate restano qui. Quelle non silenziate tornano quando arriva un nuovo messaggio.")}</Hint>}
        ListEmptyComponent={<EmptyState icon={Archive} title={t("Nessuna chat archiviata")} />}
        renderItem={({ item }) => (
          <InboxRow
            item={item}
            pinned={false}
            time={item.live ? listTime(item.updatedAt) : demoTime(item.time)}
            count={unreadOf(item)}
            muted={isMuted(item)}
            room={item.live ? live?.call.rooms[item.id] : null}
            tick={rowTick(item)}
            selecting={false}
            selected={false}
            onOpen={() => { if (!item.live && item.unread) store.readChat(item.id); router.push(`/chat/${item.id}`); }}
            onLongPress={() => {}}
            onMute={() => store.setDmFlag(item.id, "muted", !isMuted(item))}
            onDelete={() => (item.live ? store.setDmFlag(item.id, "hiddenAt", Date.now()) : store.deleteChat(item.id))}
            onUnarchive={() => { store.setDmFlags([item.id], "archivedAt", null); flash(t("Riportata nelle chat"), 2200); }}
          />
        )}
      />
      <Toast text={hint} />
    </View>
  );
}
