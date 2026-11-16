// Pure helpers shared by Messages, chat and calls. Ported from src/App.jsx (Italian copy).

export const AVATAR_TONES = [["#ff6a5c", "#7a1d3b"], ["#ffb347", "#8a3b12"], ["#5ad1c9", "#1d4f7a"], ["#9b8cff", "#3b1d7a"], ["#7ee08a", "#1d5a3b"], ["#ff8fc7", "#7a1d5a"]];
export const GROUP_TONES = [
  ["#5ec4ff", "#2a7bf2"], ["#ff8a65", "#e8505b"], ["#b388ff", "#6e3cf0"], ["#4dd0a7", "#13917a"],
  ["#ffd54f", "#f29a1d"], ["#f48fb1", "#d6336c"], ["#80deea", "#2e9bb5"], ["#a5d66f", "#4e9a2d"],
];
export const DM_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];
export const VOICE_WAVE = [28, 46, 72, 40, 90, 58, 34, 76, 96, 48, 36, 82, 62, 42, 88, 54, 32, 70, 44, 84, 38, 66, 50, 78, 34, 60];
export const WALLPAPERS = [
  { id: "sky", it: "Cielo" },
  { id: "night", it: "Notte" },
  { id: "peach", it: "Pesca" },
  { id: "mint", it: "Menta" },
  { id: "lavender", it: "Lavanda" },
  { id: "plain", it: "Semplice" },
];
export const CALL_NOTICES = {
  denied: "Consenti microfono e fotocamera per chiamare",
  "no-device": "Nessun microfono o fotocamera",
  "in-use": "Fotocamera o microfono già in uso",
  insecure: "Le chiamate richiedono HTTPS",
  media: "Impossibile aprire il microfono",
  offline: "Sei offline",
  "no-answer": "Nessuna risposta",
  declined: "Chiamata rifiutata",
  busy: "Occupato in un'altra chiamata",
  full: "Chiamata piena (6 persone)",
  ended: "La chiamata è terminata",
  moved: "Risposto su un altro dispositivo",
  failed: "Chiamata non riuscita",
  "missed-while-busy": "Chiamata persa mentre eri occupato",
};

export function initialsOf(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
}

export function toneOf(name) {
  let hash = 0;
  for (const char of String(name || "?").trim()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function groupToneOf(photo, title) {
  const index = photo && String(photo).startsWith("tone:")
    ? Number(String(photo).slice(5)) % GROUP_TONES.length
    : [...String(title || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % GROUP_TONES.length;
  return GROUP_TONES[index];
}

export function callStamp(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function clockOf(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function clockNow() {
  return clockOf(Date.now());
}

const WEEKDAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function dayOf(ms) {
  const date = new Date(ms);
  const today = new Date();
  const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Ieri";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${diff > 300 ? ` ${date.getFullYear()}` : ""}`;
}

const pad = (n) => String(n).padStart(2, "0");

export function listTime(ms) {
  if (!ms) return "";
  const diff = Math.round((Date.now() - ms) / 86_400_000);
  const date = new Date(ms);
  if (date.toDateString() === new Date().toDateString()) return clockOf(ms);
  if (diff < 7) return WEEKDAYS[date.getDay()];
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// Labels of the demo threads ("2h", "3g", "1sett", "Ieri", "ora") as clock or date, like the web's demoTime.
export function demoTime(label) {
  const value = String(label || "");
  if (!value || value === "Now" || value === "ora") return clockNow();
  const hours = value.match(/^(\d+)h$/);
  if (hours) return clockOf(Date.now() - Number(hours[1]) * 3_600_000);
  const weeks = value.match(/^(\d+)\s*(sett|w)/);
  if (weeks) {
    const at = new Date(Date.now() - Number(weeks[1]) * 7 * 86_400_000);
    return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}`;
  }
  const days = value.match(/^(\d+)[gd]$/);
  if (days) {
    const at = new Date(Date.now() - Number(days[1]) * 86_400_000);
    if (Number(days[1]) < 7) {
      const text = WEEKDAYS[at.getDay()];
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}`;
  }
  return value;
}

export function seenText(person) {
  if (!person) return "";
  if (person.online) return "online";
  if (!person.lastSeen) return "offline";
  const sameDay = new Date(person.lastSeen).toDateString() === new Date().toDateString();
  const when = sameDay ? clockOf(person.lastSeen) : `${dayOf(person.lastSeen).toLowerCase()} ${clockOf(person.lastSeen)}`;
  return `ultimo accesso ${sameDay ? "alle " : ""}${when}`;
}

export function nameIn(conv, handle, me) {
  if (handle === me) return "Tu";
  return conv?.members.find((member) => member.handle === handle)?.name || handle;
}

export function systemText(message, conv, me) {
  const mine = message.by === me;
  const by = nameIn(conv, message.by, me);
  const who = message.who === me ? "te" : nameIn(conv, message.who, me);
  switch (message.event) {
    case "created": return mine ? `Hai creato il gruppo «${message.title}».` : `${by} ha creato il gruppo «${message.title}».`;
    case "renamed": return mine ? `Hai rinominato il gruppo in «${message.title}».` : `${by} ha rinominato il gruppo in «${message.title}».`;
    case "added": return mine ? `Hai aggiunto ${who}.` : `${by} ha aggiunto ${who}.`;
    case "removed": return mine ? `Hai rimosso ${who}.` : `${by} ha rimosso ${who}.`;
    case "left": return message.who === me ? "Hai lasciato il gruppo." : `${who} ha lasciato il gruppo.`;
    case "pinned": return mine ? "Hai fissato un messaggio." : `${by} ha fissato un messaggio.`;
    default: return message.text || "";
  }
}

// Shape a live conversation like the local demo threads used by the UI.
export function liveThread(conv, me, typing) {
  const others = conv.members.filter((member) => member.handle !== me);
  const group = conv.kind === "group";
  const other = others[0];
  const face = (member) => ({ handle: member.handle, name: member.name, meta: seenText(member), src: member.src || "", online: member.online });
  const members = group ? others.map(face) : undefined;
  const name = group ? conv.title : (other?.name || "Chat");
  const typers = Object.keys(typing?.[conv.id] || {}).filter((handle) => handle !== me).map((handle) => nameIn(conv, handle, me).split(" ")[0]);
  const messages = conv.messages.map((message) => ({
    ...message,
    from: message.from === me ? "me" : message.from === "system" ? "system" : "them",
    sender: message.from,
    senderName: nameIn(conv, message.from, me),
    time: clockOf(message.created),
    text: message.kind === "system" ? systemText(message, conv, me) : message.text,
  }));
  const last = messages[messages.length - 1];
  return {
    id: conv.id,
    live: true,
    conv,
    name,
    kind: group ? "Gruppo" : "Chat",
    src: group ? (members[0]?.src || "") : (other?.src || ""),
    members: group && members.length > 1 ? members : undefined,
    people: group ? members : other ? [face(other)] : [],
    other,
    group,
    owner: conv.owner,
    photo: group ? (conv.photo || "") : "",
    about: conv.about || "",
    pinned: conv.pinned || null,
    online: !group && Boolean(other?.online),
    typing: typers,
    messages,
    unread: conv.unread || 0,
    time: listTime(conv.updatedAt),
    updatedAt: conv.updatedAt || 0,
    preview: last ? "" : "Nuova chat",
  };
}

export function tickFor(message, thread, receipts) {
  if (!thread.live) return receipts ? "read" : "sent";
  if (message.status === "failed") return "failed";
  if (!message.id) return "pending";
  if (!receipts) return "sent";
  const others = thread.conv.members.filter((member) => member.handle !== message.sender);
  const read = others.length > 0 && others.every((member) => member.readAt != null && member.readAt >= message.created);
  return read ? "read" : "sent";
}

export function onlyEmoji(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 16) return false;
  try {
    const all = new RegExp("^(?:\\p{Extended_Pictographic}|\\p{Emoji_Component}|\\u200d|\\ufe0f|\\s)+$", "u");
    const any = new RegExp("\\p{Extended_Pictographic}", "u");
    return all.test(value) && any.test(value);
  } catch {
    // Engines without Unicode property escapes: surrogate pairs and symbols only.
    return /^(?:[\ud83c-\udbff][\udc00-\udfff]|[☀-➿]|‍|️|\s)+$/.test(value);
  }
}

export function reactionGroups(reactions) {
  const groups = new Map();
  for (const emoji of Object.values(reactions || {})) groups.set(emoji, (groups.get(emoji) || 0) + 1);
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

export function personHidden(prefs, name, blockOnly = false) {
  if (!name) return false;
  const blocked = Array.isArray(prefs?.blocked) && prefs.blocked.includes(name);
  if (blocked || blockOnly) return blocked;
  return Array.isArray(prefs?.muted) && prefs.muted.includes(name);
}

export function textHidden(prefs, text) {
  const blob = String(text || "").toLowerCase();
  const words = Array.isArray(prefs?.hiddenWords) ? prefs.hiddenWords : [];
  return words.some((word) => {
    const needle = String(word || "").trim().toLowerCase();
    return needle && blob.includes(needle);
  });
}

export function defaultFolders() {
  return [
    { id: "unread", name: "Non lette", unreadOnly: true, chats: [] },
    { id: "people", name: "Personali", people: true, chats: [] },
    { id: "groups", name: "Gruppi", groups: true, chats: [] },
  ];
}

export function folderSummary(entry) {
  const parts = [];
  if (entry.people) parts.push("chat personali");
  if (entry.groups) parts.push("gruppi");
  if (entry.chats?.length) parts.push(`${entry.chats.length} chat`);
  if (entry.unreadOnly) parts.push("nuovi messaggi da tutte le chat");
  let text = parts.join(", ") || "vuota";
  if (entry.noMuted) text += ", senza silenziate";
  if (entry.noRead && !entry.unreadOnly) text += ", solo non lette";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function previewOf(item) {
  if (item.typing?.length) return { icon: null, text: "sta scrivendo…", typing: true };
  const last = item.messages?.[item.messages.length - 1];
  const mine = last?.from === "me" ? "Tu: " : item.group && last?.from === "them" ? `${String(last.senderName || "").split(" ")[0]}: ` : "";
  if (!last) return { icon: null, text: item.preview || "Nuova chat" };
  if (last.from === "system") return { icon: null, text: last.text || item.preview };
  if (last.kind === "image") return { icon: "image", text: `${mine}${last.text || "Foto"}` };
  if (last.kind === "audio") return { icon: "mic", text: `${mine}Messaggio vocale` };
  if (last.kind === "call") {
    const label = last.call === "video" ? "Videochiamata" : "Chiamata";
    const detail = last.duration ? callStamp(last.duration) : last.from === "me" ? "Nessuna risposta" : "Persa";
    return { icon: last.call === "video" ? "video" : "phone", text: `${label} · ${detail}` };
  }
  return { icon: null, text: `${mine}${last.text || item.preview}` };
}

export function isGroupChat(item) {
  return Boolean(item?.group || item?.members);
}
