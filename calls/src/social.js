// iywa social API: accounts, sessions, profiles, follows, posts (photos, reels, thoughts),
// likes, saves, reposts, polls, comments, stories, highlights, notifications, search and media.
//
// Everything lives in the Hub Durable Object's SQLite, next to chats and payments, so the
// hub can push live events (notifications, follows) to the right sockets.
//
// Auth: email or username + password (PBKDF2-SHA256). A session is a random bearer token;
// only its SHA-256 is stored. No email confirmation yet.
//
// Media: uploaded to R2 (binding MEDIA) and served from /calls/media/<key>.

const ITERATIONS = 100_000; // the Workers runtime caps PBKDF2 at 100k
const PAGE = 24;
const STORY_MS = 24 * 3600 * 1000;
const MEDIA_MAX = 60 * 1024 * 1024;
const MEDIA_TYPES = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3",
};
const RESERVED = new Set(["admin", "iywa", "support", "help", "settings", "explore", "reels", "api", "calls", "me", "null", "undefined"]);

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const handleOf = (value) => clean(value, 40).toLowerCase().replace(/^@/, "").replace(/[^a-z0-9._]/g, "");
const emailOf = (value) => clean(value, 160).toLowerCase();
const validHandle = (handle) => /^[a-z0-9._]{3,30}$/.test(handle) && !/^[.]|[.]$|\.\./.test(handle) && !RESERVED.has(handle);
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const parse = (value, fallback) => {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
// Media URLs must be https (our bucket or elsewhere); plain http only for a local dev server.
const okUrl = (value) => /^https:\/\//.test(String(value || "")) || /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?\//.test(String(value || ""));
const id = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256);
  return b64url(new Uint8Array(bits));
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function migrateSocial(sql) {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      handle TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, salt TEXT NOT NULL,
      name TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
      private INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'personal', business TEXT,
      verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, handle TEXT NOT NULL, created_at INTEGER NOT NULL, used_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_by_handle ON sessions(handle);
    CREATE TABLE IF NOT EXISTS follows (
      follower TEXT NOT NULL, followee TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ok', created_at INTEGER NOT NULL,
      PRIMARY KEY (follower, followee));
    CREATE INDEX IF NOT EXISTS follows_by_followee ON follows(followee, status);
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY, author TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL DEFAULT '',
      media TEXT NOT NULL DEFAULT '[]', place TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
      products TEXT NOT NULL DEFAULT '[]', extra TEXT NOT NULL DEFAULT '{}', parent TEXT, root TEXT,
      archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS posts_by_author ON posts(author, created_at);
    CREATE INDEX IF NOT EXISTS posts_by_kind ON posts(kind, created_at);
    CREATE INDEX IF NOT EXISTS posts_by_parent ON posts(parent, created_at);
    CREATE TABLE IF NOT EXISTS post_tags (post_id TEXT NOT NULL, tag TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (tag, post_id));
    CREATE TABLE IF NOT EXISTS post_people (post_id TEXT NOT NULL, handle TEXT NOT NULL, PRIMARY KEY (handle, post_id));
    CREATE TABLE IF NOT EXISTS likes (post_id TEXT NOT NULL, handle TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (post_id, handle));
    CREATE TABLE IF NOT EXISTS saves (post_id TEXT NOT NULL, handle TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (handle, post_id));
    CREATE TABLE IF NOT EXISTS reposts (post_id TEXT NOT NULL, handle TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (post_id, handle));
    CREATE INDEX IF NOT EXISTS reposts_by_handle ON reposts(handle, created_at);
    CREATE TABLE IF NOT EXISTS votes (post_id TEXT NOT NULL, handle TEXT NOT NULL, choice INTEGER NOT NULL, PRIMARY KEY (post_id, handle));
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, parent TEXT, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_by_post ON comments(post_id, created_at);
    CREATE TABLE IF NOT EXISTS comment_likes (comment_id TEXT NOT NULL, handle TEXT NOT NULL, PRIMARY KEY (comment_id, handle));
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY, author TEXT NOT NULL, media TEXT NOT NULL, extra TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS stories_by_author ON stories(author, created_at);
    CREATE TABLE IF NOT EXISTS story_views (story_id TEXT NOT NULL, handle TEXT NOT NULL, liked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (story_id, handle));
    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY, author TEXT NOT NULL, title TEXT NOT NULL, cover TEXT NOT NULL DEFAULT '', frames TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, handle TEXT NOT NULL, actor TEXT NOT NULL, type TEXT NOT NULL, target TEXT,
      text TEXT NOT NULL DEFAULT '', read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS notifications_by_handle ON notifications(handle, created_at);
    CREATE TABLE IF NOT EXISTS reviews (
      seller TEXT NOT NULL, product_id TEXT NOT NULL, handle TEXT NOT NULL, stars INTEGER NOT NULL, text TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, PRIMARY KEY (seller, product_id, handle));
  `);
  try { sql.exec("ALTER TABLE pay_products ADD COLUMN data TEXT"); } catch { /* already there */ }
}

// ---------------------------------------------------------------------------------------------

export class Social {
  constructor(hub) {
    this.hub = hub;
    this.sql = hub.sql;
  }

  rows(q, ...a) { return this.hub.rows(q, ...a); }
  one(q, ...a) { return this.hub.one(q, ...a); }
  run(q, ...a) { this.sql.exec(q, ...a); }

  // At most 10 sign-in / sign-up attempts a minute from one address (brute force).
  allowAttempt(request, path) {
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const key = `${path}:${ip}`;
    const now = Date.now();
    this.attempts = this.attempts || new Map();
    const list = (this.attempts.get(key) || []).filter((at) => now - at < 60_000);
    if (list.length >= 10) return false;
    list.push(now);
    this.attempts.set(key, list);
    if (this.attempts.size > 5000) this.attempts.clear();
    return true;
  }

  // ----- sessions -----

  async me(request) {
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return this.handleForToken(token);
  }

  async handleForToken(token) {
    if (!token || token.length < 20) return null;
    const hash = await sha256(token);
    const row = this.one("SELECT handle, used_at FROM sessions WHERE token = ?", hash);
    if (!row) return null;
    if (Date.now() - row.used_at > 3600_000) this.run("UPDATE sessions SET used_at = ? WHERE token = ?", Date.now(), hash);
    return row.handle;
  }

  async openSession(handle) {
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const now = Date.now();
    this.run("INSERT INTO sessions (token, handle, created_at, used_at) VALUES (?, ?, ?, ?)", await sha256(token), handle, now, now);
    return token;
  }

  // ----- views -----

  account(handle) {
    return handle ? this.one("SELECT * FROM accounts WHERE handle = ?", handle) : null;
  }

  // Short person card used inside posts, comments, lists.
  card(handle) {
    const row = this.account(handle);
    if (!row) return { handle, name: handle, avatar: "", verified: false, gone: true };
    return { handle: row.handle, name: row.name, avatar: row.avatar, verified: Boolean(row.verified), kind: row.kind };
  }

  relation(me, handle) {
    if (!me || me === handle) return { isFollowing: false, requested: false, followsMe: false };
    const out = this.one("SELECT status FROM follows WHERE follower = ? AND followee = ?", me, handle);
    const back = this.one("SELECT status FROM follows WHERE follower = ? AND followee = ? AND status = 'ok'", handle, me);
    return { isFollowing: out?.status === "ok", requested: out?.status === "pending", followsMe: Boolean(back) };
  }

  canSee(me, handle) {
    const row = this.account(handle);
    if (!row) return false;
    if (!row.private || me === handle) return true;
    return Boolean(me && this.one("SELECT 1 AS ok FROM follows WHERE follower = ? AND followee = ? AND status = 'ok'", me, handle));
  }

  profile(me, handle) {
    const row = this.account(handle);
    if (!row) return null;
    const count = (q, ...a) => this.one(q, ...a)?.n || 0;
    const out = {
      handle: row.handle,
      name: row.name,
      bio: row.bio,
      avatar: row.avatar,
      website: row.website,
      verified: Boolean(row.verified),
      private: Boolean(row.private),
      kind: row.kind,
      business: row.kind === "business" ? parse(row.business, null) : null,
      createdAt: row.created_at,
      followers: count("SELECT count(*) AS n FROM follows WHERE followee = ? AND status = 'ok'", handle),
      following: count("SELECT count(*) AS n FROM follows WHERE follower = ? AND status = 'ok'", handle),
      posts: count("SELECT count(*) AS n FROM posts WHERE author = ? AND kind IN ('photo','reel') AND archived = 0", handle),
      shop: count("SELECT count(*) AS n FROM pay_products WHERE seller = ?", handle),
      ...this.relation(me, handle),
    };
    out.visible = this.canSee(me, handle);
    if (me === handle) out.email = row.email;
    return out;
  }

  post(me, row, depth = 0) {
    if (!row) return null;
    const count = (q) => this.one(q, row.id)?.n || 0;
    const extra = parse(row.extra, {});
    const out = {
      id: row.id,
      kind: row.kind,
      author: this.card(row.author),
      text: row.text,
      media: parse(row.media, []),
      place: row.place,
      tags: parse(row.tags, []),
      products: parse(row.products, []),
      parent: row.parent || null,
      root: row.root || null,
      archived: Boolean(row.archived),
      createdAt: row.created_at,
      likes: count("SELECT count(*) AS n FROM likes WHERE post_id = ?"),
      comments: row.kind === "thought" ? count("SELECT count(*) AS n FROM posts WHERE parent = ?") : count("SELECT count(*) AS n FROM comments WHERE post_id = ?"),
      reposts: count("SELECT count(*) AS n FROM reposts WHERE post_id = ?"),
      liked: Boolean(me && this.one("SELECT 1 AS ok FROM likes WHERE post_id = ? AND handle = ?", row.id, me)),
      saved: Boolean(me && this.one("SELECT 1 AS ok FROM saves WHERE post_id = ? AND handle = ?", row.id, me)),
      reposted: Boolean(me && this.one("SELECT 1 AS ok FROM reposts WHERE post_id = ? AND handle = ?", row.id, me)),
      hideLikes: Boolean(extra.hideLikes),
      commentsOff: Boolean(extra.commentsOff),
      audio: extra.audio || null,
      alt: extra.alt || "",
    };
    if (extra.poll) {
      const votes = this.rows("SELECT choice, count(*) AS n FROM votes WHERE post_id = ? GROUP BY choice", row.id);
      const mine = me ? this.one("SELECT choice FROM votes WHERE post_id = ? AND handle = ?", row.id, me) : null;
      out.poll = {
        options: extra.poll.options,
        endsAt: extra.poll.endsAt,
        counts: extra.poll.options.map((_, index) => votes.find((v) => v.choice === index)?.n || 0),
        voted: mine ? mine.choice : null,
      };
    }
    if (row.kind === "thought" && row.parent && depth === 0) {
      const parent = this.one("SELECT author FROM posts WHERE id = ?", row.parent);
      out.replyTo = parent ? parent.author : null;
    }
    return out;
  }

  posts(me, rows) {
    return rows.filter((row) => this.canSee(me, row.author)).map((row) => this.post(me, row));
  }

  note(me, row) {
    return {
      id: row.id,
      type: row.type,
      actor: this.card(row.actor),
      target: parse(row.target, null),
      text: row.text,
      read: Boolean(row.read),
      createdAt: row.created_at,
      ...(row.type === "follow" || row.type === "request" ? this.relation(me, row.actor) : {}),
    };
  }

  // Notifies `handle` (never yourself) and pushes it live to their sockets.
  notify(handle, actor, type, target = null, text = "") {
    if (!handle || handle === actor || !this.account(handle)) return;
    // One "like" note per person and post, not one per tap.
    if (type === "like" || type === "follow" || type === "request") {
      this.run("DELETE FROM notifications WHERE handle = ? AND actor = ? AND type = ? AND coalesce(target,'') = ?", handle, actor, type, target ? JSON.stringify(target) : "");
    }
    const row = { id: id("nt"), handle, actor, type, target: target ? JSON.stringify(target) : null, text: clean(text, 200), read: 0, created_at: Date.now() };
    this.run("INSERT INTO notifications (id, handle, actor, type, target, text, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)", row.id, handle, actor, type, row.target, row.text, row.created_at);
    this.hub.sendTo(handle, { type: "notify", note: this.note(handle, row) });
  }

  mentions(text) {
    return [...new Set((String(text).match(/@([a-z0-9._]{3,30})/gi) || []).map((m) => handleOf(m)))];
  }

  hashtags(text) {
    return [...new Set((String(text).match(/#([\p{L}\p{N}_]{2,40})/gu) || []).map((m) => m.slice(1).toLowerCase()))];
  }

  // ----- requests -----

  async handle(request, url) {
    const path = url.pathname.replace(/^\/calls\/api/, "");
    const method = request.method;
    const me = await this.me(request);
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
    const fail = (error, status = 400) => json({ error }, status);
    const needMe = () => (me ? null : fail("auth", 401));
    const body = method === "POST" || method === "PATCH" || method === "PUT" ? (path === "/media" ? null : await request.json().catch(() => ({}))) : {};
    const before = Number(url.searchParams.get("before")) || Date.now() + 1;
    const seg = path.split("/").filter(Boolean);

    // --- auth ---
    if (path === "/auth/available" && method === "GET") {
      const handle = handleOf(url.searchParams.get("handle"));
      const email = emailOf(url.searchParams.get("email"));
      return json({
        handle: handle ? validHandle(handle) && !this.account(handle) : null,
        email: email ? validEmail(email) && !this.one("SELECT 1 AS ok FROM accounts WHERE email = ?", email) : null,
      });
    }

    if (path === "/auth/signup" && method === "POST") {
      const handle = handleOf(body.handle);
      const email = emailOf(body.email);
      const name = clean(body.name, 60);
      const password = String(body.password || "");
      if (!validHandle(handle)) return fail("handle");
      if (!validEmail(email)) return fail("email");
      if (name.length < 1) return fail("name");
      if (password.length < 6 || password.length > 200) return fail("password");
      if (this.account(handle)) return fail("handle-taken", 409);
      if (this.one("SELECT 1 AS ok FROM accounts WHERE email = ?", email)) return fail("email-taken", 409);
      const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
      const pass = await hashPassword(password, salt);
      this.run("INSERT INTO accounts (handle, email, pass, salt, name, created_at) VALUES (?, ?, ?, ?, ?, ?)", handle, email, pass, salt, name, Date.now());
      this.syncHubUser(handle);
      const token = await this.openSession(handle);
      return json({ token, me: this.profile(handle, handle) });
    }

    if ((path === "/auth/login" || path === "/auth/signup") && method === "POST" && !this.allowAttempt(request, path)) return fail("slow-down", 429);

    if (path === "/auth/login" && method === "POST") {
      const login = clean(body.login, 160).toLowerCase().replace(/^@/, "");
      const row = login.includes("@") ? this.one("SELECT * FROM accounts WHERE email = ?", login) : this.account(handleOf(login));
      const password = String(body.password || "");
      if (!row) {
        await hashPassword(password, "timing"); // same cost either way
        return fail("no-account", 404);
      }
      if (!same(await hashPassword(password, row.salt), row.pass)) return fail("password", 401);
      const token = await this.openSession(row.handle);
      return json({ token, me: this.profile(row.handle, row.handle) });
    }

    if (path === "/auth/logout" && method === "POST") {
      const header = request.headers.get("authorization") || "";
      if (header.startsWith("Bearer ")) this.run("DELETE FROM sessions WHERE token = ?", await sha256(header.slice(7).trim()));
      return json({ ok: true });
    }

    // --- media ---
    if (path === "/media" && method === "POST") {
      if (!me) return fail("auth", 401);
      if (!this.hub.env.MEDIA) return fail("media-not-configured", 503);
      const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const ext = MEDIA_TYPES[type];
      if (!ext) return fail("media-type");
      const size = Number(request.headers.get("content-length") || 0);
      if (size > MEDIA_MAX) return fail("media-size", 413);
      const key = `${me}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MEDIA_MAX) return fail("media-size", 413);
      await this.hub.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
      return json({ url: `${url.origin}/calls/media/${key}`, key, type });
    }

    // --- me ---
    if (path === "/me" && method === "GET") {
      if (!me) return fail("auth", 401);
      return json({ me: this.profile(me, me) });
    }

    if (path === "/me" && method === "PATCH") {
      if (!me) return fail("auth", 401);
      const row = this.account(me);
      const next = {
        name: body.name != null ? clean(body.name, 60) || row.name : row.name,
        bio: body.bio != null ? clean(body.bio, 300) : row.bio,
        avatar: body.avatar != null ? clean(body.avatar, 600) : row.avatar,
        website: body.website != null ? clean(body.website, 200) : row.website,
        private: body.private != null ? (body.private ? 1 : 0) : row.private,
        kind: body.kind === "business" || body.kind === "personal" ? body.kind : row.kind,
        business: body.business !== undefined ? JSON.stringify(body.business || null).slice(0, 4000) : row.business,
      };
      let handle = me;
      if (body.handle != null && handleOf(body.handle) !== me) {
        handle = handleOf(body.handle);
        if (!validHandle(handle)) return fail("handle");
        if (this.account(handle)) return fail("handle-taken", 409);
      }
      this.run("UPDATE accounts SET name = ?, bio = ?, avatar = ?, website = ?, private = ?, kind = ?, business = ? WHERE handle = ?",
        next.name, next.bio, next.avatar, next.website, next.private, next.kind, next.business, me);
      if (handle !== me) this.rename(me, handle);
      // Going public accepts every pending request.
      if (!next.private) this.run("UPDATE follows SET status = 'ok' WHERE followee = ? AND status = 'pending'", handle);
      this.syncHubUser(handle);
      return json({ me: this.profile(handle, handle) });
    }

    if (path === "/me/password" && method === "POST") {
      if (!me) return fail("auth", 401);
      const row = this.account(me);
      if (!same(await hashPassword(String(body.current || ""), row.salt), row.pass)) return fail("password", 401);
      const next = String(body.next || "");
      if (next.length < 6 || next.length > 200) return fail("weak");
      const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
      this.run("UPDATE accounts SET pass = ?, salt = ? WHERE handle = ?", await hashPassword(next, salt), salt, me);
      return json({ ok: true });
    }

    if (path === "/me/email" && method === "POST") {
      if (!me) return fail("auth", 401);
      const email = emailOf(body.email);
      if (!validEmail(email)) return fail("email");
      if (this.one("SELECT 1 AS ok FROM accounts WHERE email = ? AND handle != ?", email, me)) return fail("email-taken", 409);
      this.run("UPDATE accounts SET email = ? WHERE handle = ?", email, me);
      return json({ me: this.profile(me, me) });
    }

    // Account deletion (required by the App Store): everything the person made goes too.
    if (path === "/me" && method === "DELETE") {
      if (!me) return fail("auth", 401);
      const row = this.account(me);
      if (!same(await hashPassword(String(url.searchParams.get("password") || request.headers.get("x-password") || ""), row.salt), row.pass)) return fail("password", 401);
      await this.deleteAccount(me);
      return json({ ok: true });
    }

    // --- people ---
    if (seg[0] === "users" && seg[1]) {
      const handle = handleOf(decodeURIComponent(seg[1]));
      const target = this.account(handle);
      if (!target) return fail("not-found", 404);

      if (seg.length === 2 && method === "GET") return json({ user: this.profile(me, handle) });

      if (seg[2] === "follow") {
        const err = needMe(); if (err) return err;
        if (handle === me) return fail("self");
        if (method === "POST") {
          const existing = this.one("SELECT status FROM follows WHERE follower = ? AND followee = ?", me, handle);
          if (!existing) {
            const status = target.private ? "pending" : "ok";
            this.run("INSERT INTO follows (follower, followee, status, created_at) VALUES (?, ?, ?, ?)", me, handle, status, Date.now());
            this.notify(handle, me, status === "ok" ? "follow" : "request");
          }
        } else if (method === "DELETE") {
          this.run("DELETE FROM follows WHERE follower = ? AND followee = ?", me, handle);
          this.run("DELETE FROM notifications WHERE handle = ? AND actor = ? AND type IN ('follow','request')", handle, me);
        }
        return json({ user: this.profile(me, handle) });
      }

      // Remove a follower of mine.
      if (seg[2] === "follower" && method === "DELETE") {
        const err = needMe(); if (err) return err;
        this.run("DELETE FROM follows WHERE follower = ? AND followee = ?", handle, me);
        return json({ ok: true });
      }

      if (seg[2] === "followers" || seg[2] === "following") {
        if (!this.canSee(me, handle)) return json({ people: [] });
        const q = seg[2] === "followers"
          ? "SELECT follower AS h, created_at FROM follows WHERE followee = ? AND status = 'ok' AND created_at < ? ORDER BY created_at DESC LIMIT 60"
          : "SELECT followee AS h, created_at FROM follows WHERE follower = ? AND status = 'ok' AND created_at < ? ORDER BY created_at DESC LIMIT 60";
        const rows = this.rows(q, handle, before);
        return json({ people: rows.map((r) => ({ ...this.card(r.h), ...this.relation(me, r.h), at: r.created_at })), next: rows.length === 60 ? rows[rows.length - 1].created_at : null });
      }

      if (seg[2] === "posts") {
        if (!this.canSee(me, handle)) return json({ posts: [], hidden: true });
        const kind = url.searchParams.get("kind") || "grid";
        let rows;
        if (kind === "tagged") {
          rows = this.rows("SELECT p.* FROM posts p JOIN post_people t ON t.post_id = p.id WHERE t.handle = ? AND p.archived = 0 AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?", handle, before, PAGE);
        } else if (kind === "thoughts") {
          rows = this.rows("SELECT * FROM posts WHERE author = ? AND kind = 'thought' AND parent IS NULL AND archived = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?", handle, before, PAGE);
        } else if (kind === "replies") {
          rows = this.rows("SELECT * FROM posts WHERE author = ? AND kind = 'thought' AND parent IS NOT NULL AND created_at < ? ORDER BY created_at DESC LIMIT ?", handle, before, PAGE);
        } else if (kind === "reels") {
          rows = this.rows("SELECT * FROM posts WHERE author = ? AND kind = 'reel' AND archived = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?", handle, before, PAGE);
        } else if (kind === "archived") {
          if (me !== handle) return fail("forbidden", 403);
          rows = this.rows("SELECT * FROM posts WHERE author = ? AND archived = 1 AND created_at < ? ORDER BY created_at DESC LIMIT ?", handle, before, PAGE);
        } else {
          rows = this.rows("SELECT * FROM posts WHERE author = ? AND kind IN ('photo','reel') AND archived = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?", handle, before, PAGE);
        }
        return json(this.page(me, rows, false));
      }

      if (seg[2] === "reposts") {
        if (!this.canSee(me, handle)) return json({ posts: [] });
        const rows = this.rows("SELECT p.*, r.created_at AS reposted_at FROM reposts r JOIN posts p ON p.id = r.post_id WHERE r.handle = ? AND r.created_at < ? ORDER BY r.created_at DESC LIMIT ?", handle, before, PAGE);
        const posts = rows.filter((row) => this.canSee(me, row.author)).map((row) => ({ ...this.post(me, row), repostedAt: row.reposted_at }));
        return json({ posts, next: rows.length === PAGE ? rows[rows.length - 1].reposted_at : null });
      }

      if (seg[2] === "highlights" && method === "GET") {
        if (!this.canSee(me, handle)) return json({ highlights: [] });
        return json({ highlights: this.rows("SELECT * FROM highlights WHERE author = ? ORDER BY created_at DESC", handle).map((row) => ({ id: row.id, title: row.title, cover: row.cover, frames: parse(row.frames, []), createdAt: row.created_at })) });
      }

      if (seg[2] === "shop" && method === "GET") {
        const products = this.rows("SELECT * FROM pay_products WHERE seller = ? ORDER BY updated_at DESC", handle).map(productOut);
        const pay = this.one("SELECT charges_enabled FROM pay_accounts WHERE handle = ?", handle);
        return json({ seller: this.card(handle), business: target.kind === "business" ? parse(target.business, null) : null, products, payments: Boolean(pay?.charges_enabled) && Boolean(this.hub.env.STRIPE_SECRET_KEY) });
      }
    }

    // Follow requests to my private account.
    if (path === "/requests" && method === "GET") {
      const err = needMe(); if (err) return err;
      return json({ people: this.rows("SELECT follower AS h, created_at FROM follows WHERE followee = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 100", me).map((r) => ({ ...this.card(r.h), at: r.created_at })) });
    }
    if (seg[0] === "requests" && seg[1] && method === "POST") {
      const err = needMe(); if (err) return err;
      const who = handleOf(seg[1]);
      if (seg[2] === "accept") {
        this.run("UPDATE follows SET status = 'ok' WHERE follower = ? AND followee = ?", who, me);
        this.run("DELETE FROM notifications WHERE handle = ? AND actor = ? AND type = 'request'", me, who);
        this.notify(who, me, "accepted");
        this.notify(me, who, "follow");
      } else {
        this.run("DELETE FROM follows WHERE follower = ? AND followee = ? AND status = 'pending'", who, me);
        this.run("DELETE FROM notifications WHERE handle = ? AND actor = ? AND type = 'request'", me, who);
      }
      return json({ ok: true });
    }

    if (path === "/suggested" && method === "GET") {
      const rows = me
        ? this.rows(`SELECT a.handle FROM accounts a WHERE a.handle != ? AND a.handle NOT IN (SELECT followee FROM follows WHERE follower = ?)
            ORDER BY (SELECT count(*) FROM follows f WHERE f.followee = a.handle AND f.follower IN (SELECT followee FROM follows WHERE follower = ? AND status = 'ok')) DESC,
            (SELECT count(*) FROM follows f WHERE f.followee = a.handle) DESC, a.created_at DESC LIMIT 30`, me, me, me)
        : this.rows("SELECT handle FROM accounts ORDER BY created_at DESC LIMIT 30");
      return json({ people: rows.map((r) => ({ ...this.profileCard(me, r.handle) })) });
    }

    if (path === "/search" && method === "GET") {
      const q = clean(url.searchParams.get("q"), 60).toLowerCase().replace(/^[@#]/, "");
      if (!q) return json({ people: [], tags: [], posts: [] });
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const people = this.rows("SELECT handle FROM accounts WHERE handle LIKE ? OR lower(name) LIKE ? ORDER BY (handle = ?) DESC, (handle LIKE ?) DESC, created_at ASC LIMIT 30", like, like, q, `${q}%`)
        .map((r) => this.profileCard(me, r.handle));
      const tags = this.rows("SELECT tag, count(*) AS n FROM post_tags WHERE tag LIKE ? GROUP BY tag ORDER BY n DESC LIMIT 15", `${q.replace(/[%_]/g, "")}%`).map((r) => ({ tag: r.tag, count: r.n }));
      const posts = this.posts(me, this.rows("SELECT * FROM posts WHERE kind IN ('photo','reel') AND archived = 0 AND (lower(text) LIKE ? OR lower(place) LIKE ?) ORDER BY created_at DESC LIMIT 30", like, like));
      return json({ people, tags, posts });
    }

    if (seg[0] === "tags" && seg[1] && method === "GET") {
      const tag = decodeURIComponent(seg[1]).toLowerCase().replace(/^#/, "");
      const rows = this.rows("SELECT p.* FROM post_tags t JOIN posts p ON p.id = t.post_id WHERE t.tag = ? AND p.archived = 0 AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?", tag, before, PAGE);
      const total = this.one("SELECT count(*) AS n FROM post_tags WHERE tag = ?", tag)?.n || 0;
      return json({ tag, total, ...this.page(me, rows) });
    }

    // --- feeds ---
    if (path === "/feed" && method === "GET") {
      const err = needMe(); if (err) return err;
      const rows = this.rows(`SELECT * FROM posts WHERE kind IN ('photo','reel') AND archived = 0 AND created_at < ?
        AND (author = ? OR author IN (SELECT followee FROM follows WHERE follower = ? AND status = 'ok'))
        ORDER BY created_at DESC LIMIT ?`, before, me, me, PAGE);
      return json(this.page(me, rows));
    }

    if (path === "/explore" && method === "GET") {
      const rows = this.rows(`SELECT p.* FROM posts p JOIN accounts a ON a.handle = p.author WHERE p.kind IN ('photo','reel') AND p.archived = 0 AND a.private = 0
        AND p.author != ? AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?`, me || "", before, PAGE * 2);
      return json(this.page(me, rows, true, PAGE * 2));
    }

    if (path === "/reels" && method === "GET") {
      const rows = this.rows(`SELECT p.* FROM posts p JOIN accounts a ON a.handle = p.author WHERE p.kind = 'reel' AND p.archived = 0
        AND (a.private = 0 OR p.author = ? OR p.author IN (SELECT followee FROM follows WHERE follower = ? AND status = 'ok'))
        AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?`, me || "", me || "", before, PAGE);
      return json(this.page(me, rows));
    }

    if (path === "/thoughts" && method === "GET") {
      const tab = url.searchParams.get("tab") || "all";
      const rows = tab === "following" && me
        ? this.rows(`SELECT * FROM posts WHERE kind = 'thought' AND parent IS NULL AND archived = 0 AND created_at < ?
            AND (author = ? OR author IN (SELECT followee FROM follows WHERE follower = ? AND status = 'ok')) ORDER BY created_at DESC LIMIT ?`, before, me, me, PAGE)
        : this.rows(`SELECT p.* FROM posts p JOIN accounts a ON a.handle = p.author WHERE p.kind = 'thought' AND p.parent IS NULL AND p.archived = 0
            AND (a.private = 0 OR p.author = ?) AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?`, me || "", before, PAGE);
      return json(this.page(me, rows));
    }

    if (path === "/saved" && method === "GET") {
      const err = needMe(); if (err) return err;
      const rows = this.rows("SELECT p.*, s.created_at AS saved_at FROM saves s JOIN posts p ON p.id = s.post_id WHERE s.handle = ? AND s.created_at < ? ORDER BY s.created_at DESC LIMIT ?", me, before, PAGE * 2);
      return json({ posts: this.posts(me, rows), next: rows.length === PAGE * 2 ? rows[rows.length - 1].saved_at : null });
    }

    if (path === "/liked" && method === "GET") {
      const err = needMe(); if (err) return err;
      const rows = this.rows("SELECT p.*, l.created_at AS liked_at FROM likes l JOIN posts p ON p.id = l.post_id WHERE l.handle = ? AND l.created_at < ? ORDER BY l.created_at DESC LIMIT ?", me, before, PAGE * 2);
      return json({ posts: this.posts(me, rows), next: rows.length === PAGE * 2 ? rows[rows.length - 1].liked_at : null });
    }

    // --- posts ---
    if (path === "/posts" && method === "POST") {
      const err = needMe(); if (err) return err;
      const kind = ["photo", "reel", "thought"].includes(body.kind) ? body.kind : "photo";
      const media = (Array.isArray(body.media) ? body.media : []).slice(0, 10).map((m) => ({
        url: clean(m?.url, 600), type: m?.type === "video" ? "video" : "image", w: Number(m?.w) || null, h: Number(m?.h) || null, poster: m?.poster ? clean(m.poster, 600) : undefined,
      })).filter((m) => okUrl(m.url));
      const text = clean(body.text, kind === "thought" ? 500 : 2200);
      if (kind !== "thought" && !media.length) return fail("media");
      if (kind === "thought" && !text && !media.length && !body.poll) return fail("empty");
      let parent = null;
      let root = null;
      if (body.parent) {
        const up = this.one("SELECT id, root, author FROM posts WHERE id = ? AND kind = 'thought'", clean(body.parent, 40));
        if (!up || !this.canSee(me, up.author)) return fail("parent", 404);
        parent = up.id;
        root = up.root || up.id;
      }
      const extra = {};
      if (body.hideLikes) extra.hideLikes = true;
      if (body.commentsOff) extra.commentsOff = true;
      if (body.audio) extra.audio = clean(body.audio, 80);
      if (body.alt) extra.alt = clean(body.alt, 300);
      if (body.poll && Array.isArray(body.poll.options)) {
        const options = body.poll.options.map((o) => clean(o, 40)).filter(Boolean).slice(0, 4);
        if (options.length >= 2) extra.poll = { options, endsAt: Date.now() + Math.min(7 * 86400_000, Math.max(300_000, Number(body.poll.durationMs) || 86400_000)) };
      }
      const people = (Array.isArray(body.tags) ? body.tags : []).map(handleOf).filter((h) => h && this.account(h)).slice(0, 20);
      const products = (Array.isArray(body.products) ? body.products : []).slice(0, 5).map((p) => ({ owner: handleOf(p.owner || me), id: clean(p.id, 64) }))
        .filter((p) => this.one("SELECT 1 AS ok FROM pay_products WHERE seller = ? AND id = ?", p.owner, p.id));
      const postId = id("p");
      const now = Date.now();
      this.run("INSERT INTO posts (id, author, kind, text, media, place, tags, products, extra, parent, root, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        postId, me, kind, text, JSON.stringify(media), clean(body.place, 80), JSON.stringify(people), JSON.stringify(products), JSON.stringify(extra), parent, root, now);
      for (const tag of this.hashtags(text)) this.run("INSERT OR IGNORE INTO post_tags (post_id, tag, created_at) VALUES (?, ?, ?)", postId, tag, now);
      for (const handle of people) {
        this.run("INSERT OR IGNORE INTO post_people (post_id, handle) VALUES (?, ?)", postId, handle);
        this.notify(handle, me, "tag", { kind: "post", id: postId });
      }
      const target = { kind: kind === "thought" ? "thought" : "post", id: postId };
      if (parent) this.notify(this.one("SELECT author FROM posts WHERE id = ?", parent)?.author, me, "reply", { kind: "thought", id: postId }, text);
      for (const handle of this.mentions(text)) this.notify(handle, me, "mention", target, text);
      return json({ post: this.post(me, this.one("SELECT * FROM posts WHERE id = ?", postId)) });
    }

    if (seg[0] === "posts" && seg[1]) {
      const postId = clean(seg[1], 40);
      const row = this.one("SELECT * FROM posts WHERE id = ?", postId);
      if (!row || !this.canSee(me, row.author)) return fail("not-found", 404);
      const action = seg[2];

      if (!action && method === "GET") {
        const out = { post: this.post(me, row) };
        if (row.kind === "thought") {
          out.replies = this.posts(me, this.rows("SELECT * FROM posts WHERE parent = ? ORDER BY created_at ASC LIMIT 200", postId));
          const chain = [];
          let up = row.parent;
          while (up && chain.length < 20) {
            const p = this.one("SELECT * FROM posts WHERE id = ?", up);
            if (!p) break;
            chain.unshift(this.post(me, p, 1));
            up = p.parent;
          }
          out.ancestors = chain;
        }
        return json(out);
      }

      if (!action && method === "PATCH") {
        const err = needMe(); if (err) return err;
        if (row.author !== me) return fail("forbidden", 403);
        const extra = parse(row.extra, {});
        if (body.hideLikes != null) extra.hideLikes = Boolean(body.hideLikes);
        if (body.commentsOff != null) extra.commentsOff = Boolean(body.commentsOff);
        const text = body.text != null ? clean(body.text, 2200) : row.text;
        this.run("UPDATE posts SET text = ?, place = ?, archived = ?, extra = ? WHERE id = ?", text, body.place != null ? clean(body.place, 80) : row.place,
          body.archived != null ? (body.archived ? 1 : 0) : row.archived, JSON.stringify(extra), postId);
        if (body.text != null) {
          this.run("DELETE FROM post_tags WHERE post_id = ?", postId);
          for (const tag of this.hashtags(text)) this.run("INSERT OR IGNORE INTO post_tags (post_id, tag, created_at) VALUES (?, ?, ?)", postId, tag, row.created_at);
        }
        return json({ post: this.post(me, this.one("SELECT * FROM posts WHERE id = ?", postId)) });
      }

      if (!action && method === "DELETE") {
        const err = needMe(); if (err) return err;
        if (row.author !== me) return fail("forbidden", 403);
        await this.deletePost(postId);
        return json({ ok: true });
      }

      if (action === "like" || action === "save" || action === "repost") {
        const err = needMe(); if (err) return err;
        const table = { like: "likes", save: "saves", repost: "reposts" }[action];
        if (method === "POST") {
          this.run(`INSERT OR IGNORE INTO ${table} (post_id, handle, created_at) VALUES (?, ?, ?)`, postId, me, Date.now());
          const target = { kind: row.kind === "thought" ? "thought" : "post", id: postId };
          if (action === "like") this.notify(row.author, me, "like", target);
          if (action === "repost") this.notify(row.author, me, "repost", target);
        } else {
          this.run(`DELETE FROM ${table} WHERE post_id = ? AND handle = ?`, postId, me);
          if (action === "like") this.run("DELETE FROM notifications WHERE handle = ? AND actor = ? AND type = 'like' AND target LIKE ?", row.author, me, `%"${postId}"%`);
        }
        return json({ post: this.post(me, row) });
      }

      if (action === "vote" && method === "POST") {
        const err = needMe(); if (err) return err;
        const extra = parse(row.extra, {});
        const choice = Math.round(Number(body.choice));
        if (!extra.poll || !(choice >= 0 && choice < extra.poll.options.length)) return fail("choice");
        if (Date.now() > extra.poll.endsAt) return fail("closed", 409);
        this.run("INSERT OR IGNORE INTO votes (post_id, handle, choice) VALUES (?, ?, ?)", postId, me, choice);
        return json({ post: this.post(me, row) });
      }

      if (action === "likes" && method === "GET") {
        const rows = this.rows("SELECT handle FROM likes WHERE post_id = ? ORDER BY created_at DESC LIMIT 200", postId);
        return json({ people: rows.map((r) => ({ ...this.card(r.handle), ...this.relation(me, r.handle) })) });
      }

      if (action === "comments" && method === "GET") {
        const rows = this.rows("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 500", postId);
        return json({ comments: rows.map((c) => this.comment(me, c)) });
      }

      if (action === "comments" && method === "POST") {
        const err = needMe(); if (err) return err;
        if (parse(row.extra, {}).commentsOff && row.author !== me) return fail("comments-off", 403);
        const text = clean(body.text, 1000);
        if (!text) return fail("empty");
        const parent = body.parent ? this.one("SELECT id FROM comments WHERE id = ? AND post_id = ?", clean(body.parent, 40), postId)?.id || null : null;
        const commentId = id("c");
        this.run("INSERT INTO comments (id, post_id, author, text, parent, created_at) VALUES (?, ?, ?, ?, ?, ?)", commentId, postId, me, text, parent, Date.now());
        const target = { kind: "post", id: postId, comment: commentId };
        this.notify(row.author, me, "comment", target, text);
        if (parent) this.notify(this.one("SELECT author FROM comments WHERE id = ?", parent)?.author, me, "reply", target, text);
        for (const handle of this.mentions(text)) this.notify(handle, me, "mention", target, text);
        return json({ comment: this.comment(me, this.one("SELECT * FROM comments WHERE id = ?", commentId)) });
      }
    }

    if (seg[0] === "comments" && seg[1]) {
      const err = needMe(); if (err) return err;
      const c = this.one("SELECT * FROM comments WHERE id = ?", clean(seg[1], 40));
      if (!c) return fail("not-found", 404);
      if (!seg[2] && method === "DELETE") {
        const post = this.one("SELECT author FROM posts WHERE id = ?", c.post_id);
        if (c.author !== me && post?.author !== me) return fail("forbidden", 403);
        for (const r of this.rows("SELECT id FROM comments WHERE id = ? OR parent = ?", c.id, c.id)) this.run("DELETE FROM comment_likes WHERE comment_id = ?", r.id);
        this.run("DELETE FROM comments WHERE id = ? OR parent = ?", c.id, c.id);
        return json({ ok: true });
      }
      if (seg[2] === "like") {
        if (method === "POST") {
          this.run("INSERT OR IGNORE INTO comment_likes (comment_id, handle) VALUES (?, ?)", c.id, me);
          this.notify(c.author, me, "comment_like", { kind: "post", id: c.post_id, comment: c.id }, c.text);
        } else {
          this.run("DELETE FROM comment_likes WHERE comment_id = ? AND handle = ?", c.id, me);
        }
        return json({ comment: this.comment(me, c) });
      }
    }

    // --- stories ---
    if (path === "/stories" && method === "GET") {
      const err = needMe(); if (err) return err;
      const now = Date.now();
      const rows = this.rows(`SELECT * FROM stories WHERE expires_at > ? AND (author = ? OR author IN (SELECT followee FROM follows WHERE follower = ? AND status = 'ok'))
        ORDER BY created_at ASC`, now, me, me);
      const decks = new Map();
      for (const row of rows) {
        if (!decks.has(row.author)) decks.set(row.author, { ...this.card(row.author), mine: row.author === me, frames: [] });
        decks.get(row.author).frames.push(this.story(me, row));
      }
      const list = [...decks.values()].map((deck) => ({ ...deck, seen: deck.frames.every((f) => f.seen), latest: deck.frames[deck.frames.length - 1].createdAt }));
      list.sort((a, b) => (b.mine - a.mine) || (a.seen - b.seen) || (b.latest - a.latest));
      return json({ decks: list });
    }

    if (path === "/stories" && method === "POST") {
      const err = needMe(); if (err) return err;
      const media = { url: clean(body.media?.url, 600), type: body.media?.type === "video" ? "video" : "image" };
      if (!okUrl(media.url)) return fail("media");
      const extra = { text: clean(body.text, 300), stickers: Array.isArray(body.stickers) ? body.stickers.slice(0, 20) : [], closeFriends: Boolean(body.closeFriends), style: body.style || null };
      // Never cut the JSON: drop the drawing layer first, then refuse.
      if (JSON.stringify(extra).length > 60_000 && extra.style) extra.style = { ...extra.style, drawing: undefined, strokes: undefined };
      if (JSON.stringify(extra).length > 60_000) return fail("too-big", 413);
      const storyId = id("s");
      const now = Date.now();
      this.run("INSERT INTO stories (id, author, media, extra, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)", storyId, me, JSON.stringify(media), JSON.stringify(extra), now, now + STORY_MS);
      for (const handle of this.mentions(extra.text)) this.notify(handle, me, "story_mention", { kind: "story", id: storyId, author: me });
      return json({ story: this.story(me, this.one("SELECT * FROM stories WHERE id = ?", storyId)) });
    }

    if (seg[0] === "users" && seg[1] && seg[2] === "stories" && method === "GET") {
      const handle = handleOf(seg[1]);
      if (!this.canSee(me, handle)) return json({ frames: [] });
      return json({ ...this.card(handle), frames: this.rows("SELECT * FROM stories WHERE author = ? AND expires_at > ? ORDER BY created_at ASC", handle, Date.now()).map((row) => this.story(me, row)) });
    }

    if (seg[0] === "stories" && seg[1]) {
      const err = needMe(); if (err) return err;
      const row = this.one("SELECT * FROM stories WHERE id = ?", clean(seg[1], 40));
      if (!row || !this.canSee(me, row.author)) return fail("not-found", 404);
      if (seg[2] === "view" && method === "POST") {
        if (row.author !== me) this.run("INSERT OR IGNORE INTO story_views (story_id, handle, created_at) VALUES (?, ?, ?)", row.id, me, Date.now());
        return json({ ok: true });
      }
      if (seg[2] === "like") {
        this.run("INSERT OR IGNORE INTO story_views (story_id, handle, created_at) VALUES (?, ?, ?)", row.id, me, Date.now());
        this.run("UPDATE story_views SET liked = ? WHERE story_id = ? AND handle = ?", method === "POST" ? 1 : 0, row.id, me);
        if (method === "POST") this.notify(row.author, me, "story_like", { kind: "story", id: row.id, author: row.author });
        return json({ ok: true });
      }
      if (seg[2] === "viewers" && method === "GET") {
        if (row.author !== me) return fail("forbidden", 403);
        return json({ people: this.rows("SELECT * FROM story_views WHERE story_id = ? ORDER BY created_at DESC", row.id).map((v) => ({ ...this.card(v.handle), liked: Boolean(v.liked), at: v.created_at })) });
      }
      if (!seg[2] && method === "DELETE") {
        if (row.author !== me) return fail("forbidden", 403);
        this.run("DELETE FROM story_views WHERE story_id = ?", row.id);
        this.run("DELETE FROM stories WHERE id = ?", row.id);
        return json({ ok: true });
      }
    }

    // --- highlights ---
    if (path === "/highlights" && method === "POST") {
      const err = needMe(); if (err) return err;
      const frames = (Array.isArray(body.frames) ? body.frames : []).slice(0, 100);
      if (!frames.length) return fail("empty");
      const hid = id("h");
      this.run("INSERT INTO highlights (id, author, title, cover, frames, created_at) VALUES (?, ?, ?, ?, ?, ?)", hid, me, clean(body.title, 30) || "Highlight", clean(body.cover, 600), JSON.stringify(frames).slice(0, 200_000), Date.now());
      return json({ highlight: { id: hid, title: clean(body.title, 30) || "Highlight", cover: clean(body.cover, 600), frames } });
    }
    if (seg[0] === "highlights" && seg[1] && method === "DELETE") {
      const err = needMe(); if (err) return err;
      this.run("DELETE FROM highlights WHERE id = ? AND author = ?", clean(seg[1], 40), me);
      return json({ ok: true });
    }

    // --- notifications ---
    if (path === "/notifications" && method === "GET") {
      const err = needMe(); if (err) return err;
      const rows = this.rows("SELECT * FROM notifications WHERE handle = ? AND created_at < ? ORDER BY created_at DESC LIMIT 60", me, before);
      const unread = this.one("SELECT count(*) AS n FROM notifications WHERE handle = ? AND read = 0", me)?.n || 0;
      const requests = this.one("SELECT count(*) AS n FROM follows WHERE followee = ? AND status = 'pending'", me)?.n || 0;
      return json({ notifications: rows.map((row) => this.note(me, row)), unread, requests, next: rows.length === 60 ? rows[rows.length - 1].created_at : null });
    }
    if (path === "/notifications/read" && method === "POST") {
      const err = needMe(); if (err) return err;
      this.run("UPDATE notifications SET read = 1 WHERE handle = ?", me);
      return json({ ok: true });
    }

    // --- products (full catalogue entries; pricing stays in pay_products for checkout) ---
    if (seg[0] === "products" && seg[1] && seg[2] && method === "GET") {
      const seller = handleOf(seg[1]);
      const row = this.one("SELECT * FROM pay_products WHERE seller = ? AND id = ?", seller, clean(seg[2], 64));
      if (!row) return fail("not-found", 404);
      const reviews = this.rows("SELECT * FROM reviews WHERE seller = ? AND product_id = ? ORDER BY created_at DESC LIMIT 100", seller, row.id)
        .map((r) => ({ ...this.card(r.handle), stars: r.stars, text: r.text, at: r.created_at }));
      const pay = this.one("SELECT charges_enabled FROM pay_accounts WHERE handle = ?", seller);
      return json({ product: productOut(row), seller: this.card(seller), reviews, payments: Boolean(pay?.charges_enabled) && Boolean(this.hub.env.STRIPE_SECRET_KEY) });
    }
    if (seg[0] === "products" && seg[1] && method === "PUT") {
      const err = needMe(); if (err) return err;
      const pid = clean(seg[1], 64);
      const cents = Math.round(Number(body.price) * 100);
      if (!pid || !Number.isFinite(cents) || cents < 50 || cents > 5_000_000) return fail("price");
      const images = (Array.isArray(body.images) ? body.images : []).filter(okUrl).slice(0, 10);
      const data = { ...body, id: pid, images, price: cents / 100 };
      const account = this.account(me);
      const business = parse(account.business, null) || {};
      const shop = JSON.stringify({ title: clean(business.title || account.name, 60), city: clean(business.city, 40), category: clean(business.category, 40) });
      this.run(`INSERT INTO pay_products (seller, id, name, price_cents, image, stock, made_to_order, service, shop, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(seller, id) DO UPDATE SET name = excluded.name, price_cents = excluded.price_cents, image = excluded.image, stock = excluded.stock,
        made_to_order = excluded.made_to_order, service = excluded.service, shop = excluded.shop, updated_at = excluded.updated_at, data = excluded.data`,
        me, pid, clean(body.name, 120) || "Prodotto", cents, images[0] || null,
        body.stock == null || body.stock === "" ? null : Math.max(0, Math.round(Number(body.stock) || 0)),
        body.madeToOrder ? Math.max(1, Math.round(Number(body.madeToOrder))) : null, body.service ? 1 : 0, shop, Date.now(), JSON.stringify(data).slice(0, 40_000));
      return json({ product: productOut(this.one("SELECT * FROM pay_products WHERE seller = ? AND id = ?", me, pid)) });
    }
    if (seg[0] === "products" && seg[1] && method === "DELETE") {
      const err = needMe(); if (err) return err;
      this.run("DELETE FROM pay_products WHERE seller = ? AND id = ?", me, clean(seg[1], 64));
      return json({ ok: true });
    }
    if (seg[0] === "products" && seg[1] && seg[2] && seg[3] === "reviews" && method === "POST") {
      const err = needMe(); if (err) return err;
      const seller = handleOf(seg[1]);
      const pid = clean(seg[2], 64);
      if (seller === me) return fail("own-product");
      if (!this.one("SELECT 1 AS ok FROM pay_products WHERE seller = ? AND id = ?", seller, pid)) return fail("not-found", 404);
      const stars = Math.max(1, Math.min(5, Math.round(Number(body.stars) || 5)));
      this.run("INSERT INTO reviews (seller, product_id, handle, stars, text, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(seller, product_id, handle) DO UPDATE SET stars = excluded.stars, text = excluded.text, created_at = excluded.created_at",
        seller, pid, me, stars, clean(body.text, 600), Date.now());
      this.notify(seller, me, "review", { kind: "product", owner: seller, id: pid }, clean(body.text, 120));
      return json({ ok: true });
    }

    return null; // not ours: payments may handle it
  }

  profileCard(me, handle) {
    const p = this.profile(me, handle);
    return p ? { handle: p.handle, name: p.name, avatar: p.avatar, verified: p.verified, bio: p.bio, followers: p.followers, kind: p.kind, ...this.relation(me, handle) } : null;
  }

  page(me, rows, filter = true, size = PAGE) {
    const posts = filter ? this.posts(me, rows) : rows.map((row) => this.post(me, row));
    return { posts, next: rows.length === size ? rows[rows.length - 1].created_at : null };
  }

  comment(me, c) {
    return {
      id: c.id,
      postId: c.post_id,
      author: this.card(c.author),
      text: c.text,
      parent: c.parent,
      createdAt: c.created_at,
      likes: this.one("SELECT count(*) AS n FROM comment_likes WHERE comment_id = ?", c.id)?.n || 0,
      liked: Boolean(me && this.one("SELECT 1 AS ok FROM comment_likes WHERE comment_id = ? AND handle = ?", c.id, me)),
    };
  }

  story(me, row) {
    const extra = parse(row.extra, {});
    const view = me ? this.one("SELECT liked FROM story_views WHERE story_id = ? AND handle = ?", row.id, me) : null;
    return {
      id: row.id,
      author: row.author,
      media: parse(row.media, {}),
      text: extra.text || "",
      stickers: extra.stickers || [],
      style: extra.style || null,
      closeFriends: Boolean(extra.closeFriends),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      seen: row.author === me || Boolean(view),
      liked: Boolean(view?.liked),
      views: row.author === me ? this.one("SELECT count(*) AS n FROM story_views WHERE story_id = ?", row.id)?.n || 0 : undefined,
    };
  }

  syncHubUser(handle) {
    const row = this.account(handle);
    if (!row) return;
    this.run(`INSERT INTO users (handle, name, src, last_seen) VALUES (?, ?, ?, ?)
      ON CONFLICT(handle) DO UPDATE SET name = excluded.name, src = excluded.src`, handle, row.name, row.avatar, Date.now());
  }

  rename(from, to) {
    const moves = [
      ["accounts", "handle"], ["sessions", "handle"], ["follows", "follower"], ["follows", "followee"], ["posts", "author"], ["post_people", "handle"],
      ["likes", "handle"], ["saves", "handle"], ["reposts", "handle"], ["votes", "handle"], ["comments", "author"], ["comment_likes", "handle"],
      ["stories", "author"], ["story_views", "handle"], ["highlights", "author"], ["notifications", "handle"], ["notifications", "actor"],
      ["reviews", "handle"], ["reviews", "seller"], ["pay_products", "seller"], ["pay_accounts", "handle"], ["orders", "buyer"], ["orders", "seller"],
      ["users", "handle"], ["members", "handle"], ["messages", "sender"], ["reactions", "handle"],
    ];
    for (const [table, column] of moves) {
      try { this.run(`UPDATE OR IGNORE ${table} SET ${column} = ? WHERE ${column} = ?`, to, from); } catch { /* table may not exist */ }
    }
    for (const socket of this.hub.sockets.values()) if (socket.handle === from) socket.handle = to;
  }

  async deletePost(postId) {
    for (const r of this.rows("SELECT id FROM comments WHERE post_id = ?", postId)) this.run("DELETE FROM comment_likes WHERE comment_id = ?", r.id);
    for (const table of ["comments", "likes", "saves", "reposts", "votes", "post_tags", "post_people"]) this.run(`DELETE FROM ${table} WHERE post_id = ?`, postId);
    this.run("DELETE FROM notifications WHERE target LIKE ?", `%"${postId}"%`);
    const row = this.one("SELECT media FROM posts WHERE id = ?", postId);
    this.run("DELETE FROM posts WHERE id = ?", postId);
    await this.dropMedia(parse(row?.media, []).map((m) => m.url));
  }

  async dropMedia(urls) {
    if (!this.hub.env.MEDIA) return;
    const keys = urls.map((u) => String(u || "").split("/calls/media/")[1]).filter(Boolean).map(decodeURIComponent);
    if (keys.length) await this.hub.env.MEDIA.delete(keys).catch(() => {});
  }

  async deleteAccount(handle) {
    for (const r of this.rows("SELECT id FROM posts WHERE author = ?", handle)) await this.deletePost(r.id);
    const statements = [
      "DELETE FROM sessions WHERE handle = ?", "DELETE FROM follows WHERE follower = ?", "DELETE FROM follows WHERE followee = ?",
      "DELETE FROM likes WHERE handle = ?", "DELETE FROM saves WHERE handle = ?", "DELETE FROM reposts WHERE handle = ?", "DELETE FROM votes WHERE handle = ?",
      "DELETE FROM comments WHERE author = ?", "DELETE FROM comment_likes WHERE handle = ?", "DELETE FROM stories WHERE author = ?",
      "DELETE FROM story_views WHERE handle = ?", "DELETE FROM highlights WHERE author = ?", "DELETE FROM notifications WHERE handle = ?",
      "DELETE FROM notifications WHERE actor = ?", "DELETE FROM reviews WHERE handle = ?", "DELETE FROM pay_products WHERE seller = ?",
      "DELETE FROM post_people WHERE handle = ?", "DELETE FROM members WHERE handle = ?", "DELETE FROM users WHERE handle = ?", "DELETE FROM accounts WHERE handle = ?",
    ];
    for (const q of statements) {
      try { this.run(q, handle); } catch { /* table may not exist */ }
    }
    if (this.hub.env.MEDIA) {
      const listed = await this.hub.env.MEDIA.list({ prefix: `${handle}/`, limit: 1000 }).catch(() => null);
      const keys = (listed?.objects || []).map((o) => o.key);
      if (keys.length) await this.hub.env.MEDIA.delete(keys).catch(() => {});
    }
    for (const [socketId, socket] of this.hub.sockets) if (socket.handle === handle) this.hub.drop(socketId);
  }
}

export function productOut(row) {
  const data = parse(row.data, {});
  return {
    ...data,
    id: row.id,
    owner: row.seller,
    name: row.name,
    price: row.price_cents / 100,
    images: data.images?.length ? data.images : row.image ? [row.image] : [],
    stock: row.stock,
    madeToOrder: row.made_to_order,
    service: Boolean(row.service),
    updatedAt: row.updated_at,
  };
}
