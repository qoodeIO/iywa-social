// The inbox as the web app builds it: live conversations from the hub first (newest
// first), then the local demo threads, with the chat flags (mute, pin, archive, hide)
// and folders applied.

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
  const demoTyping = live?.demoTyping;
  return useMemo(() => {
    const liveThreads = convs
      ? Object.values(convs)
        .map((conv) => liveThread(conv, me, typing))
        .filter((item) => item.group || !personHidden(prefs, item.name, true))
        .sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
    const demo = store.chats.map((item) => (demoTyping?.[item.id] ? { ...item, typing: [item.name.split(" ")[0]] } : item));
    return [...liveThreads, ...demo];
  }, [convs, me, typing, demoTyping, store.chats, prefs]);
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
  const unreadOf = (item) => (item.live ? item.unread : (item.unread ? 1 : 0));
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

// Who a 1:1 thread is, for the chat intro and chat info.
export function personOf(item, people, contacts) {
  if (!item || item.group || item.members) return null;
  if (item.live) return { name: item.name, handle: item.other?.handle, src: item.src, live: true };
  const found = people.find((person) => person.name === item.name);
  if (found) return found;
  const contact = contacts.find((person) => person.name === item.name);
  return { name: item.name, src: item.src, handle: item.name.toLowerCase().replace(/\s+/g, "."), craft: contact?.meta?.split(" · ")[0], city: contact?.meta?.split(" · ")[1], followers: 0, bio: "" };
}
