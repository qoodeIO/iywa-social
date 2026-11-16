import { handlePayments, migratePayments } from "./payments.js";
// Space realtime hub: direct messages, groups, presence, typing, read receipts,
// call ringing and WebRTC signalling for mesh calls (up to 6 people).
// The call model is ported from Spinchat (VideoApp): the server only relays
// offers, answers and ICE candidates; media flows peer to peer (TURN optional).

const LIMITS = {
  text: 2000,
  image: 900_000, // data URL characters
  audio: 1_400_000, // data URL characters
  voiceSeconds: 120,
  groupMembers: 200,
  title: 40,
  about: 255,
  photo: 160_000,
  page: 40,
  signal: 24_000,
  callPeople: 6,
  ringMs: 45_000,
  aloneMs: 60_000,
};

const STUN = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

function cors(headers = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    ...headers,
  };
}

function json(data, status = 200) {
  if (status === 204 || data === null) return new Response(null, { status, headers: cors() });
  return new Response(JSON.stringify(data), { status, headers: cors({ "content-type": "application/json" }) });
}

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
// A group photo is a small data URL, or "tone:<n>" for a colour avatar.
const photoOf = (value) => {
  const photo = String(value || "");
  if (/^tone:\d{1,2}$/.test(photo)) return photo;
  if (/^data:image\/(jpeg|png|webp);base64,/.test(photo) && photo.length <= LIMITS.photo) return photo;
  return "";
};
const handleOf = (value) => clean(value, 40).toLowerCase().replace(/[^a-z0-9._-]/g, "");

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json(null, 204);
    const url = new URL(request.url);
    if (url.pathname === "/calls/health") return json({ ok: true });
    if (url.pathname === "/calls/hub") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "upgrade" }, 426);
      const hub = env.HUB.get(env.HUB.idFromName("space"));
      return hub.fetch(request);
    }
    if (url.pathname.startsWith("/calls/api/")) {
      const hub = env.HUB.get(env.HUB.idFromName("space"));
      return hub.fetch(request);
    }
    return json({ error: "not-found" }, 404);
  },
};

export class Hub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.sockets = new Map(); // socketId -> { ws, handle, bucket, at }
    this.rooms = new Map(); // convId -> call room
    this.inCall = new Map(); // handle -> convId
    this.ice = null;
    this.lastStamp = 0;
    this.migrate();
  }

  migrate() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        handle TEXT PRIMARY KEY, name TEXT NOT NULL, src TEXT, last_seen INTEGER NOT NULL DEFAULT 0,
        receipts INTEGER NOT NULL DEFAULT 1, show_online INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS convs (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT, owner TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS members (
        conv_id TEXT NOT NULL, handle TEXT NOT NULL, last_read_at INTEGER NOT NULL DEFAULT 0,
        joined_at INTEGER NOT NULL, PRIMARY KEY (conv_id, handle));
      CREATE INDEX IF NOT EXISTS members_by_handle ON members(handle);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conv_id TEXT NOT NULL, sender TEXT NOT NULL, client_id TEXT,
        kind TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_by_conv ON messages(conv_id, created_at);
      CREATE UNIQUE INDEX IF NOT EXISTS messages_client ON messages(sender, client_id);
      CREATE TABLE IF NOT EXISTS reactions (
        message_id TEXT NOT NULL, handle TEXT NOT NULL, emoji TEXT NOT NULL,
        PRIMARY KEY (message_id, handle));
    `);
    migratePayments(this.sql);
    // Columns added after the first release: ignore "duplicate column" on later boots.
    for (const column of ["about TEXT", "photo TEXT", "pinned TEXT"]) {
      try {
        this.sql.exec(`ALTER TABLE convs ADD COLUMN ${column}`);
      } catch {
        // already there
      }
    }
  }

  // ---------- helpers ----------

  stamp() {
    // Strictly increasing timestamps keep ordering and read marks unambiguous.
    const now = Date.now();
    this.lastStamp = now > this.lastStamp ? now : this.lastStamp + 1;
    return this.lastStamp;
  }

  rows(query, ...args) {
    return this.sql.exec(query, ...args).toArray();
  }

  one(query, ...args) {
    return this.rows(query, ...args)[0] || null;
  }

  socketsOf(handle) {
    return [...this.sockets.entries()].filter(([, s]) => s.handle === handle);
  }

  online(handle) {
    const user = this.one("SELECT show_online FROM users WHERE handle = ?", handle);
    return Boolean(user?.show_online) && this.socketsOf(handle).length > 0;
  }

  send(socketId, message) {
    const socket = this.sockets.get(socketId);
    if (!socket) return;
    try {
      socket.ws.send(JSON.stringify(message));
    } catch {
      this.drop(socketId);
    }
  }

  sendTo(handle, message) {
    for (const [id] of this.socketsOf(handle)) this.send(id, message);
  }

  sendAll(message) {
    for (const id of this.sockets.keys()) this.send(id, message);
  }

  memberHandles(convId) {
    return this.rows("SELECT handle FROM members WHERE conv_id = ?", convId).map((row) => row.handle);
  }

  isMember(convId, handle) {
    return Boolean(this.one("SELECT 1 AS ok FROM members WHERE conv_id = ? AND handle = ?", convId, handle));
  }

  person(handle) {
    const user = this.one("SELECT handle, name, src, last_seen, show_online, receipts FROM users WHERE handle = ?", handle);
    if (!user) return { handle, name: handle, src: "", online: false, lastSeen: 0 };
    const online = this.online(handle);
    return {
      handle: user.handle,
      name: user.name,
      src: user.src || "",
      online,
      lastSeen: user.show_online ? user.last_seen : 0,
    };
  }

  message(row) {
    const body = JSON.parse(row.body || "{}");
    const out = { id: row.id, convId: row.conv_id, from: row.sender, clientId: row.client_id || undefined, kind: row.kind, created: row.created_at, ...body };
    const reactions = this.reactionsOf(row.id);
    if (reactions) out.reactions = reactions;
    return out;
  }

  reactionsOf(messageId) {
    const rows = this.rows("SELECT handle, emoji FROM reactions WHERE message_id = ?", messageId);
    return rows.length ? Object.fromEntries(rows.map((row) => [row.handle, row.emoji])) : null;
  }

  conv(convId, viewer, withMessages = true) {
    const conv = this.one("SELECT * FROM convs WHERE id = ?", convId);
    if (!conv) return null;
    const viewerRow = this.one("SELECT receipts FROM users WHERE handle = ?", viewer);
    const viewerReceipts = Boolean(viewerRow?.receipts ?? 1);
    const members = this.rows(
      "SELECT m.handle, m.last_read_at, u.receipts FROM members m LEFT JOIN users u ON u.handle = m.handle WHERE m.conv_id = ?",
      convId,
    ).map((row) => ({
      ...this.person(row.handle),
      // Read receipts are two-way: hidden unless both sides share them.
      readAt: row.handle === viewer || (viewerReceipts && row.receipts) ? row.last_read_at : null,
    }));
    const mine = members.find((member) => member.handle === viewer);
    const lastRead = this.one("SELECT last_read_at FROM members WHERE conv_id = ? AND handle = ?", convId, viewer)?.last_read_at || 0;
    const unread = this.one(
      "SELECT count(*) AS n FROM messages WHERE conv_id = ? AND sender != ? AND sender != 'system' AND created_at > ?",
      convId, viewer, lastRead,
    )?.n || 0;
    const result = {
      id: conv.id,
      kind: conv.kind,
      title: conv.title || "",
      owner: conv.owner || "",
      about: conv.about || "",
      photo: conv.photo || "",
      pinned: conv.pinned ? (() => {
        const row = this.one("SELECT * FROM messages WHERE id = ? AND conv_id = ?", conv.pinned, convId);
        return row ? this.message(row) : null;
      })() : null,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      members,
      unread,
      lastReadAt: mine ? lastRead : 0,
    };
    if (withMessages) {
      const page = this.page(convId, null);
      result.messages = page.messages;
      result.hasMore = page.hasMore;
    }
    return result;
  }

  page(convId, before) {
    const rows = before
      ? this.rows("SELECT * FROM messages WHERE conv_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?", convId, before, LIMITS.page + 1)
      : this.rows("SELECT * FROM messages WHERE conv_id = ? ORDER BY created_at DESC LIMIT ?", convId, LIMITS.page + 1);
    const hasMore = rows.length > LIMITS.page;
    return { messages: rows.slice(0, LIMITS.page).reverse().map((row) => this.message(row)), hasMore };
  }

  convsOf(handle) {
    return this.rows(
      "SELECT c.id FROM convs c JOIN members m ON m.conv_id = c.id WHERE m.handle = ? ORDER BY c.updated_at DESC",
      handle,
    ).map((row) => this.conv(row.id, handle)).filter(Boolean);
  }

  pushConv(convId, handles = this.memberHandles(convId)) {
    for (const handle of handles) {
      const conv = this.conv(convId, handle);
      if (conv) this.sendTo(handle, { type: "conv", conv });
    }
  }

  directory() {
    return this.rows("SELECT handle FROM users ORDER BY name COLLATE NOCASE").map((row) => this.person(row.handle));
  }

  roomView(room) {
    if (!room) return null;
    return { convId: room.convId, callId: room.callId, video: room.video, caller: room.caller, participants: [...room.people.keys()], startedAt: room.startedAt || 0 };
  }

  async iceServers() {
    const id = this.env.TURN_KEY_ID;
    const token = this.env.TURN_KEY_API_TOKEN;
    if (!id || !token) return STUN;
    if (this.ice && this.ice.until > Date.now()) return this.ice.servers;
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ ttl: 86_400 }),
      });
      if (!response.ok) throw new Error(`turn ${response.status}`);
      const data = await response.json();
      // Browsers time out on port 53; drop those URLs.
      const servers = (data.iceServers ? [].concat(data.iceServers) : []).map((server) => ({
        ...server,
        urls: [].concat(server.urls).filter((url) => !/:53(\?|$)/.test(url)),
      }));
      this.ice = { servers, until: Date.now() + 43_200_000 };
      return servers;
    } catch {
      this.ice = { servers: STUN, until: Date.now() + 30_000 };
      return STUN;
    }
  }

  // ---------- sockets ----------

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/calls/api/")) return handlePayments(this, request, url);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const id = crypto.randomUUID();
    this.sockets.set(id, { ws: server, handle: null, tokens: 60, at: Date.now() });
    server.addEventListener("message", (event) => {
      this.onMessage(id, event.data).catch((error) => {
        this.send(id, { type: "error", code: "server", detail: String(error?.message || error) });
      });
    });
    server.addEventListener("close", () => this.drop(id));
    server.addEventListener("error", () => this.drop(id));
    return new Response(null, { status: 101, webSocket: client });
  }

  drop(socketId) {
    const socket = this.sockets.get(socketId);
    if (!socket) return;
    this.sockets.delete(socketId);
    try { socket.ws.close(1000, "bye"); } catch { /* already closed */ }
    const handle = socket.handle;
    if (!handle) return;
    const convId = this.inCall.get(handle);
    const room = convId && this.rooms.get(convId);
    if (room && room.people.get(handle) === socketId) this.leaveCall(handle, "disconnect");
    if (!this.socketsOf(handle).length) {
      const at = Date.now();
      this.sql.exec("UPDATE users SET last_seen = ? WHERE handle = ?", at, handle);
      this.sendAll({ type: "presence", person: this.person(handle) });
    }
  }

  allow(socket) {
    const now = Date.now();
    socket.tokens = Math.min(60, socket.tokens + ((now - socket.at) / 1000) * 25);
    socket.at = now;
    if (socket.tokens < 1) return false;
    socket.tokens -= 1;
    return true;
  }

  async onMessage(socketId, raw) {
    const socket = this.sockets.get(socketId);
    if (!socket || typeof raw !== "string") return;
    if (!this.allow(socket)) {
      this.send(socketId, { type: "error", code: "slow-down" });
      return;
    }
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "ping") {
      this.send(socketId, { type: "pong", at: Date.now() });
      return;
    }
    if (msg.type === "hello") {
      await this.hello(socketId, msg);
      return;
    }
    const me = socket.handle;
    if (!me) {
      this.send(socketId, { type: "error", code: "hello-first" });
      return;
    }
    switch (msg.type) {
      case "sync": return this.ready(socketId, me);
      case "prefs": return this.prefs(me, msg);
      case "dm_open": return this.openDm(socketId, me, msg);
      case "group_create": return this.createGroup(socketId, me, msg);
      case "group_update": return this.updateGroup(socketId, me, msg);
      case "group_leave": return this.leaveGroup(me, msg);
      case "send": return this.post(socketId, me, msg);
      case "fetch": return this.fetchPage(socketId, me, msg);
      case "read": return this.markRead(me, msg);
      case "typing": return this.typing(me, msg);
      case "react": return this.react(me, msg);
      case "unsend": return this.unsend(me, msg);
      case "edit": return this.edit(me, msg);
      case "pin": return this.pin(me, msg);
      case "call_start": return this.startCall(socketId, me, msg);
      case "call_join": return this.joinCall(socketId, me, msg);
      case "call_decline": return this.declineCall(me, msg);
      case "call_leave": return this.leaveCall(me, "hangup");
      case "call_signal": return this.signal(me, msg);
      case "call_media": return this.media(me, msg);
      default: this.send(socketId, { type: "error", code: "unknown", detail: msg.type });
    }
  }

  async hello(socketId, msg) {
    const handle = handleOf(msg.handle);
    if (!handle) {
      this.send(socketId, { type: "error", code: "handle" });
      return;
    }
    const socket = this.sockets.get(socketId);
    const first = !this.socketsOf(handle).length;
    socket.handle = handle;
    const name = clean(msg.name, 60) || handle;
    const src = typeof msg.src === "string" && msg.src.length < 40_000 ? msg.src : "";
    this.sql.exec(
      `INSERT INTO users (handle, name, src, last_seen, receipts, show_online) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(handle) DO UPDATE SET name = excluded.name, src = excluded.src, last_seen = excluded.last_seen,
       receipts = excluded.receipts, show_online = excluded.show_online`,
      handle, name, src, Date.now(), msg.receipts === false ? 0 : 1, msg.showOnline === false ? 0 : 1,
    );
    await this.ready(socketId, handle);
    if (first) this.sendAll({ type: "presence", person: this.person(handle) });
  }

  async ready(socketId, handle) {
    const convs = this.convsOf(handle);
    const rooms = convs.map((conv) => this.roomView(this.rooms.get(conv.id))).filter(Boolean);
    this.send(socketId, {
      type: "ready",
      me: this.person(handle),
      people: this.directory(),
      convs,
      rooms,
      iceServers: await this.iceServers(),
    });
    // A call may be ringing for this user right now (e.g. they just opened the app).
    for (const room of rooms) {
      const live = this.rooms.get(room.convId);
      if (live && !live.people.has(handle) && live.ringing.has(handle)) {
        this.send(socketId, { type: "call_ring", convId: live.convId, callId: live.callId, from: live.caller, video: live.video });
      }
    }
  }

  prefs(me, msg) {
    this.sql.exec(
      "UPDATE users SET receipts = ?, show_online = ? WHERE handle = ?",
      msg.receipts === false ? 0 : 1, msg.showOnline === false ? 0 : 1, me,
    );
    this.sendAll({ type: "presence", person: this.person(me) });
    for (const row of this.rows("SELECT conv_id FROM members WHERE handle = ?", me)) this.pushConv(row.conv_id);
  }

  // ---------- conversations ----------

  openDm(socketId, me, msg) {
    const other = handleOf(msg.handle);
    if (!other || other === me || !this.one("SELECT 1 AS ok FROM users WHERE handle = ?", other)) {
      this.send(socketId, { type: "error", code: "no-user" });
      return;
    }
    const id = `dm:${[me, other].sort().join("|")}`;
    if (!this.one("SELECT 1 AS ok FROM convs WHERE id = ?", id)) {
      const now = this.stamp();
      this.sql.exec("INSERT INTO convs (id, kind, title, owner, created_at, updated_at) VALUES (?, 'dm', '', '', ?, ?)", id, now, now);
      for (const handle of [me, other]) {
        this.sql.exec("INSERT OR IGNORE INTO members (conv_id, handle, last_read_at, joined_at) VALUES (?, ?, 0, ?)", id, handle, now);
      }
    }
    this.pushConv(id, [me]);
    this.send(socketId, { type: "opened", convId: id, ref: msg.ref });
  }

  system(convId, text, extra = {}) {
    const now = this.stamp();
    const id = crypto.randomUUID();
    this.sql.exec(
      "INSERT INTO messages (id, conv_id, sender, client_id, kind, body, created_at) VALUES (?, ?, 'system', NULL, 'system', ?, ?)",
      id, convId, JSON.stringify({ text, ...extra }), now,
    );
    this.sql.exec("UPDATE convs SET updated_at = ? WHERE id = ?", now, convId);
    return this.message(this.one("SELECT * FROM messages WHERE id = ?", id));
  }

  createGroup(socketId, me, msg) {
    const title = clean(msg.title, LIMITS.title);
    const picked = [...new Set((Array.isArray(msg.members) ? msg.members : []).map(handleOf))]
      .filter((handle) => handle && handle !== me && this.one("SELECT 1 AS ok FROM users WHERE handle = ?", handle));
    if (!title || !picked.length || picked.length + 1 > LIMITS.groupMembers) {
      this.send(socketId, { type: "error", code: "group", ref: msg.ref });
      return;
    }
    const id = `g:${crypto.randomUUID()}`;
    const now = this.stamp();
    this.sql.exec("INSERT INTO convs (id, kind, title, owner, created_at, updated_at, about, photo) VALUES (?, 'group', ?, ?, ?, ?, ?, ?)", id, title, me, now, now, clean(msg.about, LIMITS.about), photoOf(msg.photo));
    for (const handle of [me, ...picked]) {
      this.sql.exec("INSERT INTO members (conv_id, handle, last_read_at, joined_at) VALUES (?, ?, ?, ?)", id, handle, handle === me ? now : 0, now);
    }
    this.system(id, "created", { event: "created", by: me, title });
    this.pushConv(id);
    this.send(socketId, { type: "opened", convId: id, ref: msg.ref });
  }

  updateGroup(socketId, me, msg) {
    const convId = String(msg.convId || "");
    const conv = this.one("SELECT * FROM convs WHERE id = ? AND kind = 'group'", convId);
    if (!conv || !this.isMember(convId, me)) return this.send(socketId, { type: "error", code: "not-found" });
    if (conv.owner !== me) return this.send(socketId, { type: "error", code: "owner-only" });
    const notices = [];
    const before = this.memberHandles(convId);
    if (msg.title != null) {
      const title = clean(msg.title, LIMITS.title);
      if (title && title !== conv.title) {
        this.sql.exec("UPDATE convs SET title = ? WHERE id = ?", title, convId);
        notices.push(this.system(convId, "renamed", { event: "renamed", by: me, title }));
      }
    }
    if (msg.about != null) this.sql.exec("UPDATE convs SET about = ? WHERE id = ?", clean(msg.about, LIMITS.about), convId);
    if (msg.photo != null) this.sql.exec("UPDATE convs SET photo = ? WHERE id = ?", photoOf(msg.photo), convId);
    const add = (Array.isArray(msg.add) ? msg.add : []).map(handleOf)
      .filter((handle) => handle && !before.includes(handle) && this.one("SELECT 1 AS ok FROM users WHERE handle = ?", handle));
    const room = LIMITS.groupMembers - before.length;
    for (const handle of add.slice(0, Math.max(0, room))) {
      this.sql.exec("INSERT OR IGNORE INTO members (conv_id, handle, last_read_at, joined_at) VALUES (?, ?, 0, ?)", convId, handle, Date.now());
      notices.push(this.system(convId, "added", { event: "added", by: me, who: handle }));
    }
    const removed = (Array.isArray(msg.remove) ? msg.remove : []).map(handleOf).filter((handle) => handle !== me && before.includes(handle));
    for (const handle of removed) {
      this.sql.exec("DELETE FROM members WHERE conv_id = ? AND handle = ?", convId, handle);
      notices.push(this.system(convId, "removed", { event: "removed", by: me, who: handle }));
      if (this.inCall.get(handle) === convId) this.leaveCall(handle, "removed");
      this.sendTo(handle, { type: "conv_removed", convId });
    }
    for (const notice of notices) this.deliver(convId, notice);
    this.pushConv(convId);
  }

  leaveGroup(me, msg) {
    const convId = String(msg.convId || "");
    const conv = this.one("SELECT * FROM convs WHERE id = ? AND kind = 'group'", convId);
    if (!conv || !this.isMember(convId, me)) return;
    if (this.inCall.get(me) === convId) this.leaveCall(me, "left");
    this.sql.exec("DELETE FROM members WHERE conv_id = ? AND handle = ?", convId, me);
    this.sendTo(me, { type: "conv_removed", convId });
    const rest = this.memberHandles(convId);
    if (!rest.length) {
      this.sql.exec("DELETE FROM messages WHERE conv_id = ?", convId);
      this.sql.exec("DELETE FROM convs WHERE id = ?", convId);
      return;
    }
    if (conv.owner === me) {
      const next = this.one("SELECT handle FROM members WHERE conv_id = ? ORDER BY joined_at ASC LIMIT 1", convId).handle;
      this.sql.exec("UPDATE convs SET owner = ? WHERE id = ?", next, convId);
    }
    this.deliver(convId, this.system(convId, "left", { event: "left", who: me }));
    this.pushConv(convId);
  }

  deliver(convId, message) {
    for (const handle of this.memberHandles(convId)) this.sendTo(handle, { type: "message", message });
  }

  post(socketId, me, msg) {
    const convId = String(msg.convId || "");
    const clientId = clean(msg.clientId, 64);
    if (!clientId || !this.isMember(convId, me)) {
      this.send(socketId, { type: "send_failed", convId, clientId, code: "not-member" });
      return;
    }
    // Idempotent: a retry with the same clientId returns the stored message.
    const existing = this.one("SELECT * FROM messages WHERE sender = ? AND client_id = ?", me, clientId);
    if (existing) {
      this.send(socketId, { type: "message", message: this.message(existing) });
      return;
    }
    const kind = ["text", "image", "audio"].includes(msg.kind) ? msg.kind : "text";
    const body = {};
    if (kind === "text") {
      body.text = clean(msg.text, LIMITS.text);
      if (!body.text) return this.send(socketId, { type: "send_failed", convId, clientId, code: "empty" });
    } else if (kind === "image") {
      const image = String(msg.image || "");
      if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image) && !/^https:\/\//.test(image)) {
        return this.send(socketId, { type: "send_failed", convId, clientId, code: "image" });
      }
      if (image.length > LIMITS.image) return this.send(socketId, { type: "send_failed", convId, clientId, code: "too-big" });
      body.image = image;
      if (msg.text) body.text = clean(msg.text, LIMITS.text);
    } else {
      const audio = String(msg.audio || "");
      if (!/^data:audio\//.test(audio)) return this.send(socketId, { type: "send_failed", convId, clientId, code: "audio" });
      if (audio.length > LIMITS.audio) return this.send(socketId, { type: "send_failed", convId, clientId, code: "too-big" });
      body.audio = audio;
      body.duration = Math.max(1, Math.min(LIMITS.voiceSeconds, Math.round(Number(msg.duration) || 1)));
      if (Array.isArray(msg.wave)) body.wave = msg.wave.slice(0, 48).map((n) => Math.max(0, Math.min(100, Number(n) || 0)));
    }
    if (msg.fwd?.name) body.fwd = { name: clean(msg.fwd.name, 60) };
    // A reply keeps a short quote of the message it answers.
    if (msg.reply?.id) {
      const target = this.one("SELECT * FROM messages WHERE id = ? AND conv_id = ?", String(msg.reply.id), convId);
      if (target) {
        const quoted = JSON.parse(target.body || "{}");
        body.reply = { id: target.id, from: target.sender, kind: target.kind, text: clean(quoted.text || "", 140) };
      }
    }
    const now = this.stamp();
    const id = crypto.randomUUID();
    this.sql.exec(
      "INSERT INTO messages (id, conv_id, sender, client_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, convId, me, clientId, kind, JSON.stringify(body), now,
    );
    this.sql.exec("UPDATE convs SET updated_at = ? WHERE id = ?", now, convId);
    this.sql.exec("UPDATE members SET last_read_at = ? WHERE conv_id = ? AND handle = ?", now, convId, me);
    const first = (this.one("SELECT count(*) AS n FROM messages WHERE conv_id = ?", convId)?.n || 0) === 1;
    // The other side of a new DM learns about the chat with its first message.
    if (first) this.pushConv(convId);
    this.deliver(convId, this.message(this.one("SELECT * FROM messages WHERE id = ?", id)));
  }

  react(me, msg) {
    const convId = String(msg.convId || "");
    const messageId = String(msg.messageId || "");
    if (!this.isMember(convId, me)) return;
    const row = this.one("SELECT id FROM messages WHERE id = ? AND conv_id = ? AND kind != 'system'", messageId, convId);
    if (!row) return;
    const emoji = clean(msg.emoji || "", 16);
    if (emoji) {
      this.sql.exec("INSERT INTO reactions (message_id, handle, emoji) VALUES (?, ?, ?) ON CONFLICT(message_id, handle) DO UPDATE SET emoji = excluded.emoji", messageId, me, emoji);
    } else {
      this.sql.exec("DELETE FROM reactions WHERE message_id = ? AND handle = ?", messageId, me);
    }
    const reactions = this.reactionsOf(messageId) || {};
    for (const handle of this.memberHandles(convId)) this.sendTo(handle, { type: "reaction", convId, messageId, reactions, by: me, emoji });
  }

  edit(me, msg) {
    const convId = String(msg.convId || "");
    const messageId = String(msg.messageId || "");
    if (!this.isMember(convId, me)) return;
    const row = this.one("SELECT * FROM messages WHERE id = ? AND conv_id = ? AND sender = ? AND kind = 'text'", messageId, convId, me);
    const text = clean(msg.text, LIMITS.text);
    if (!row || !text) return;
    const body = { ...JSON.parse(row.body || "{}"), text, edited: Date.now() };
    this.sql.exec("UPDATE messages SET body = ? WHERE id = ?", JSON.stringify(body), messageId);
    const message = this.message(this.one("SELECT * FROM messages WHERE id = ?", messageId));
    for (const handle of this.memberHandles(convId)) this.sendTo(handle, { type: "edited", convId, message });
  }

  pin(me, msg) {
    const convId = String(msg.convId || "");
    if (!this.isMember(convId, me)) return;
    const messageId = msg.messageId ? String(msg.messageId) : null;
    if (messageId && !this.one("SELECT 1 AS ok FROM messages WHERE id = ? AND conv_id = ? AND kind != 'system'", messageId, convId)) return;
    this.sql.exec("UPDATE convs SET pinned = ? WHERE id = ?", messageId, convId);
    if (messageId) this.deliver(convId, this.system(convId, "pinned", { event: "pinned", by: me }));
    this.pushConv(convId);
  }

  unsend(me, msg) {
    const convId = String(msg.convId || "");
    const messageId = String(msg.messageId || "");
    if (!this.isMember(convId, me)) return;
    const row = this.one("SELECT id FROM messages WHERE id = ? AND conv_id = ? AND sender = ?", messageId, convId, me);
    if (!row) return;
    this.sql.exec("DELETE FROM reactions WHERE message_id = ?", messageId);
    this.sql.exec("DELETE FROM messages WHERE id = ?", messageId);
    this.sql.exec("UPDATE convs SET pinned = NULL WHERE id = ? AND pinned = ?", convId, messageId);
    for (const handle of this.memberHandles(convId)) this.sendTo(handle, { type: "unsent", convId, messageId });
  }

  fetchPage(socketId, me, msg) {
    const convId = String(msg.convId || "");
    if (!this.isMember(convId, me)) return;
    const page = this.page(convId, Number(msg.before) || null);
    this.send(socketId, { type: "page", convId, ...page });
  }

  markRead(me, msg) {
    const convId = String(msg.convId || "");
    if (!this.isMember(convId, me)) return;
    const last = this.one("SELECT max(created_at) AS at FROM messages WHERE conv_id = ?", convId)?.at || 0;
    const current = this.one("SELECT last_read_at FROM members WHERE conv_id = ? AND handle = ?", convId, me)?.last_read_at || 0;
    if (last <= current) return;
    this.sql.exec("UPDATE members SET last_read_at = ? WHERE conv_id = ? AND handle = ?", last, convId, me);
    const mine = this.one("SELECT receipts FROM users WHERE handle = ?", me);
    for (const handle of this.memberHandles(convId)) {
      if (handle === me) {
        this.sendTo(handle, { type: "read", convId, handle: me, at: last });
        continue;
      }
      const theirs = this.one("SELECT receipts FROM users WHERE handle = ?", handle);
      if (mine?.receipts && theirs?.receipts) this.sendTo(handle, { type: "read", convId, handle: me, at: last });
    }
  }

  typing(me, msg) {
    const convId = String(msg.convId || "");
    if (!this.isMember(convId, me)) return;
    for (const handle of this.memberHandles(convId)) {
      if (handle !== me) this.sendTo(handle, { type: "typing", convId, handle: me });
    }
  }

  // ---------- calls (mesh, Spinchat model) ----------

  broadcastRoom(convId) {
    const view = this.roomView(this.rooms.get(convId));
    for (const handle of this.memberHandles(convId)) {
      this.sendTo(handle, { type: "call_room", convId, room: view });
    }
  }

  armTimer(room, ms) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      const live = this.rooms.get(room.convId);
      if (live === room && room.people.size < 2) this.endRoom(room, room.startedAt ? "alone" : "no-answer");
    }, ms);
  }

  async startCall(socketId, me, msg) {
    const convId = String(msg.convId || "");
    if (!this.isMember(convId, me)) return this.send(socketId, { type: "call_error", convId, reason: "forbidden" });
    if (this.rooms.has(convId)) return this.joinCall(socketId, me, msg);
    if (this.inCall.has(me)) this.leaveCall(me, "switch");
    const conv = this.one("SELECT kind FROM convs WHERE id = ?", convId);
    const room = {
      convId,
      callId: crypto.randomUUID(),
      kind: conv.kind,
      video: msg.video !== false,
      caller: me,
      people: new Map([[me, socketId]]),
      ringing: new Set(),
      declined: new Set(),
      startedAt: 0,
      timer: null,
    };
    this.rooms.set(convId, room);
    this.inCall.set(me, convId);
    this.send(socketId, { type: "call_joined", convId, callId: room.callId, video: room.video, peers: [], iceServers: await this.iceServers() });
    const others = this.memberHandles(convId).filter((handle) => handle !== me);
    for (const handle of others) {
      const busy = this.inCall.has(handle);
      if (busy && room.kind === "dm") {
        this.send(socketId, { type: "call_declined", convId, handle, reason: "busy" });
        this.endRoom(room, "busy");
        return;
      }
      if (busy) continue;
      room.ringing.add(handle);
      this.sendTo(handle, { type: "call_ring", convId, callId: room.callId, from: me, video: room.video });
    }
    this.broadcastRoom(convId);
    this.armTimer(room, LIMITS.ringMs);
  }

  async joinCall(socketId, me, msg) {
    const convId = String(msg.convId || "");
    const room = this.rooms.get(convId);
    if (!room) return this.send(socketId, { type: "call_error", convId, reason: "ended" });
    if (!this.isMember(convId, me)) return this.send(socketId, { type: "call_error", convId, reason: "forbidden" });
    const previous = room.people.get(me);
    if (previous && previous !== socketId) {
      // Same person answered on another tab: hand the seat over.
      this.send(previous, { type: "call_ended", convId, callId: room.callId, reason: "moved" });
      room.people.delete(me);
      for (const handle of room.people.keys()) this.sendTo(handle, { type: "call_peer_left", callId: room.callId, handle: me });
    }
    if (room.people.size >= LIMITS.callPeople) return this.send(socketId, { type: "call_error", convId, reason: "full" });
    const elsewhere = this.inCall.get(me);
    if (elsewhere && elsewhere !== convId) this.leaveCall(me, "switch");
    const peers = [...room.people.keys()];
    room.people.set(me, socketId);
    room.ringing.delete(me);
    this.inCall.set(me, convId);
    if (room.people.size >= 2) {
      if (!room.startedAt) room.startedAt = Date.now();
      if (room.timer) clearTimeout(room.timer);
      room.timer = null;
    }
    this.send(socketId, { type: "call_joined", convId, callId: room.callId, video: room.video, peers, startedAt: room.startedAt, iceServers: await this.iceServers() });
    for (const handle of peers) this.send(room.people.get(handle), { type: "call_peer_joined", callId: room.callId, handle: me, startedAt: room.startedAt });
    // Stop the ringing on this person's other tabs.
    for (const [id] of this.socketsOf(me)) if (id !== socketId) this.send(id, { type: "call_dismiss", convId });
    this.broadcastRoom(convId);
  }

  declineCall(me, msg) {
    const convId = String(msg.convId || "");
    const room = this.rooms.get(convId);
    this.sendTo(me, { type: "call_dismiss", convId });
    if (!room || room.people.has(me)) return;
    room.ringing.delete(me);
    room.declined.add(me);
    for (const handle of room.people.keys()) this.sendTo(handle, { type: "call_declined", convId, handle: me, reason: "declined" });
    if (room.kind === "dm" && !room.startedAt) this.endRoom(room, "declined");
  }

  leaveCall(me, reason) {
    const convId = this.inCall.get(me);
    const room = convId && this.rooms.get(convId);
    this.inCall.delete(me);
    if (!room || !room.people.has(me)) return;
    room.people.delete(me);
    for (const socketId of room.people.values()) this.send(socketId, { type: "call_peer_left", callId: room.callId, handle: me });
    if (room.people.size === 0 || (room.kind === "dm" && (room.startedAt || me === room.caller))) {
      this.endRoom(room, reason === "hangup" && !room.startedAt ? "cancelled" : "ended");
      return;
    }
    if (room.people.size === 1) this.armTimer(room, LIMITS.aloneMs);
    this.broadcastRoom(convId);
  }

  endRoom(room, reason) {
    if (this.rooms.get(room.convId) !== room) return;
    if (room.timer) clearTimeout(room.timer);
    this.rooms.delete(room.convId);
    for (const [handle, socketId] of room.people) {
      if (this.inCall.get(handle) === room.convId) this.inCall.delete(handle);
      this.send(socketId, { type: "call_ended", convId: room.convId, callId: room.callId, reason });
    }
    for (const handle of room.ringing) this.sendTo(handle, { type: "call_dismiss", convId: room.convId });
    this.broadcastRoom(room.convId);
    if (!this.one("SELECT 1 AS ok FROM convs WHERE id = ?", room.convId)) return;
    const now = this.stamp();
    const id = crypto.randomUUID();
    const duration = room.startedAt ? Math.round((Date.now() - room.startedAt) / 1000) : 0;
    this.sql.exec(
      "INSERT INTO messages (id, conv_id, sender, client_id, kind, body, created_at) VALUES (?, ?, ?, NULL, 'call', ?, ?)",
      id, room.convId, room.caller, JSON.stringify({ call: room.video ? "video" : "voice", duration, reason }), now,
    );
    this.sql.exec("UPDATE convs SET updated_at = ? WHERE id = ?", now, room.convId);
    this.sql.exec("UPDATE members SET last_read_at = ? WHERE conv_id = ? AND handle = ?", now, room.convId, room.caller);
    this.deliver(room.convId, this.message(this.one("SELECT * FROM messages WHERE id = ?", id)));
  }

  signal(me, msg) {
    const convId = this.inCall.get(me);
    const room = convId && this.rooms.get(convId);
    const to = handleOf(msg.to);
    if (!room || !room.people.has(me) || !room.people.has(to)) return;
    const data = msg.data;
    if (!data || JSON.stringify(data).length > LIMITS.signal) return;
    this.send(room.people.get(to), { type: "call_signal", callId: room.callId, from: me, data });
  }

  media(me, msg) {
    const convId = this.inCall.get(me);
    const room = convId && this.rooms.get(convId);
    if (!room) return;
    for (const [handle, socketId] of room.people) {
      if (handle !== me) this.send(socketId, { type: "call_media", callId: room.callId, handle: me, mic: msg.mic !== false, cam: Boolean(msg.cam) });
    }
  }
}
