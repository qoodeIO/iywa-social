// The inbox: conversations from the hub, newest first, with the chat flags (mute, pin,
// archive, hide) and folders applied.

import { useMemo } from "react";
import { useStore } from "../lib/store";
import { useLive } from "./LiveStore";
import { defaultFolders, isGroupChat, liveThread, personHidden } from "./format";

export function useThreads() {
  const store = useStore();
  const live = useLive();
  const me = live?.me?.handle;
  const prefs = store.prefs;
  const convs = live?.convs;
  const typing = live?.typing;
  return useMemo(() => (convs
    ? Object.values(convs)
      .map((conv) => liveThread(conv, me, typing))
      .filter((item) => item.group || (!personHidden(prefs, item.name, true) && !personHidden(prefs, item.other?.handle, true)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    : []), [convs, me, typing, prefs]);
}

export function useInboxRules() {
  const store = useStore();
  const flags = store.dmFlags || {};
  const folders = store.dmFolders || defaultFolders();
  const hiddenOut = (item) => {
    const at = flags[item.id]?.hiddenAt;
    return Boolean(at && (item.updatedAt || 0) <= at);
  };
  const isMuted = (item) => Boolean(flags[item.id]?.muted);
  const unreadOf = (item) => item.unread || 0;
  // Archived chats come back when a new message arrives, unless they are muted (as in Telegram).
  const isArchived = (item) => {
    const at = flags[item.id]?.archivedAt;
    if (!at) return false;
    return !((item.updatedAt || 0) > at && !isMuted(item));
  };
  const inFolder = (item, key) => {
    if (key === "all") return !isArchived(item);
    const def = folders.find((entry) => entry.id === key);
    if (!def) return !isArchived(item);
    const included = def.unreadOnly || (def.chats || []).includes(item.id) || (def.people && !isGroupChat(item)) || (def.groups && isGroupChat(item));
    if (!included || isArchived(item)) return false;
    if (def.noMuted && isMuted(item)) return false;
    if ((def.noRead || def.unreadOnly) && !unreadOf(item)) return false;
    return true;
  };
  return { flags, folders, hiddenOut, isMuted, unreadOf, isArchived, inFolder };
}
