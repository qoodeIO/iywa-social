// Mesh call controller (voice, video, 1:1 and group up to 6), ported from
// Spinchat's GroupCallController. Plain JS store: subscribe() + getSnapshot().

import { PeerSession } from "./peer.js";
import { loop, sounds } from "./sounds.js";

const DEMO_RING_MS = 30_000;

function mediaError(error) {
  if (!window.isSecureContext) return "insecure";
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError": return "denied";
    case "NotFoundError":
    case "OverconstrainedError": return "no-device";
    case "NotReadableError":
    case "AbortError": return "in-use";
    default: return "media";
  }
}

async function grab(video, facing = "user") {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("insecure");
    error.name = window.isSecureContext ? "NotFoundError" : "SecurityError";
    throw error;
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
}

const IDLE = {
  phase: "idle", // idle | joining | active
  convId: null,
  callId: null,
  video: false,
  demo: null, // { name, src } for a demo contact that cannot answer
  startedAt: 0,
  peers: {}, // handle -> { stream, mic, cam, state }
  local: null,
  mic: true,
  cam: false,
  facing: "user",
  minimized: false,
};

export class CallController {
  constructor({ send, me }) {
    this.send = send;
    this.me = me;
    this.listeners = new Set();
    this.sessions = new Map();
    this.iceServers = [];
    this.request = 0;
    this.stopRing = null;
    this.stopBack = null;
    this.demoTimer = 0;
    this.state = { ...IDLE, incoming: null, rooms: {}, notice: null };
    this.onLog = null;
  }

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.sounds();
    for (const listener of this.listeners) listener();
  }

  notice(code, extra = {}) {
    this.set({ notice: { code, at: Date.now(), ...extra } });
  }

  sounds() {
    const ringing = Boolean(this.state.incoming) && this.state.phase === "idle";
    if (ringing && !this.stopRing) this.stopRing = loop(sounds.ring, 2600);
    if (!ringing && this.stopRing) { this.stopRing(); this.stopRing = null; }
    const waiting = this.state.phase === "active" && !this.state.startedAt && !Object.keys(this.state.peers).length;
    if (waiting && !this.stopBack) this.stopBack = loop(sounds.ringback, 3000);
    if (!waiting && this.stopBack) { this.stopBack(); this.stopBack = null; }
  }

  // ---------- user actions ----------

  async start(convId, video) {
    await this.enter(convId, video, "call_start");
  }

  async join(convId) {
    const room = this.state.rooms[convId];
    await this.enter(convId, room ? room.video : false, "call_join");
  }

  async accept() {
    const incoming = this.state.incoming;
    if (!incoming) return;
    await this.enter(incoming.convId, incoming.video, "call_join");
  }

  decline() {
    const incoming = this.state.incoming;
    if (!incoming) return;
    this.send({ type: "call_decline", convId: incoming.convId });
    this.set({ incoming: null });
  }

  async startDemo(thread, video) {
    // Demo contacts are not real accounts: ring, then "no answer".
    if (this.state.phase !== "idle") this.hangup();
    const ticket = ++this.request;
    this.set({ ...IDLE, phase: "joining", convId: thread.id, video, cam: video, demo: { name: thread.name, src: thread.src } });
    let local;
    try {
      local = await grab(video);
    } catch (error) {
      if (ticket === this.request) { this.reset(); this.notice(mediaError(error)); }
      return;
    }
    if (ticket !== this.request) { local.getTracks().forEach((t) => t.stop()); return; }
    this.localStream = local;
    this.set({ phase: "active", local: new MediaStream(local.getTracks()) });
    this.demoTimer = window.setTimeout(() => {
      const convId = this.state.convId;
      this.onLog?.({ convId, demo: true, call: video ? "video" : "voice", duration: 0 });
      this.reset();
      this.notice("no-answer");
    }, DEMO_RING_MS);
  }

  async enter(convId, video, type) {
    if (this.state.phase !== "idle" && this.state.convId !== convId) this.hangup();
    const ticket = ++this.request;
    this.set({ ...IDLE, phase: "joining", convId, video, cam: video, incoming: null });
    let local;
    try {
      local = await grab(video);
    } catch (error) {
      if (ticket !== this.request) return;
      if (type === "call_join") this.send({ type: "call_decline", convId });
      this.reset();
      this.notice(mediaError(error));
      return;
    }
    if (ticket !== this.request) {
      local.getTracks().forEach((track) => track.stop());
      return;
    }
    this.localStream = local;
    this.set({ local: new MediaStream(local.getTracks()) });
    if (!this.send({ type, convId, video })) {
      this.reset();
      this.notice("offline");
    }
  }

  hangup() {
    if (this.state.phase === "idle") return;
    if (!this.state.demo) this.send({ type: "call_leave" });
    else if (this.state.convId) this.onLog?.({ convId: this.state.convId, demo: true, call: this.state.video ? "video" : "voice", duration: 0 });
    sounds.leave();
    this.reset();
  }

  toggleMic() {
    const mic = !this.state.mic;
    this.localStream?.getAudioTracks().forEach((track) => { track.enabled = mic; });
    this.set({ mic });
    this.broadcastMedia();
  }

  async toggleCam() {
    const local = this.localStream;
    if (!local) return;
    const on = !this.state.cam;
    let track = local.getVideoTracks()[0];
    if (on && !track) {
      try {
        const extra = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.state.facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
        track = extra.getVideoTracks()[0];
        local.addTrack(track);
        for (const session of this.sessions.values()) session.replaceVideo(track);
      } catch (error) {
        this.notice(mediaError(error));
        return;
      }
    } else if (track) {
      track.enabled = on;
    }
    this.set({ cam: on, local: new MediaStream(local.getTracks()) });
    this.broadcastMedia();
  }

  async flip() {
    const local = this.localStream;
    const current = local?.getVideoTracks()[0];
    if (!current) return;
    const facing = this.state.facing === "user" ? "environment" : "user";
    // Phones can't open two cameras at once: stop the old one first.
    current.stop();
    local.removeTrack(current);
    let next;
    try {
      next = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } })).getVideoTracks()[0];
    } catch {
      try {
        next = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.state.facing } })).getVideoTracks()[0];
      } catch (error) {
        this.notice(mediaError(error));
        this.set({ cam: false, local: new MediaStream(local.getTracks()) });
        return;
      }
      local.addTrack(next);
      for (const session of this.sessions.values()) session.replaceVideo(next);
      this.set({ local: new MediaStream(local.getTracks()) });
      return;
    }
    local.addTrack(next);
    for (const session of this.sessions.values()) session.replaceVideo(next);
    this.set({ facing, local: new MediaStream(local.getTracks()) });
  }

  minimize(minimized) {
    this.set({ minimized });
  }

  clearNotice() {
    this.set({ notice: null });
  }

  broadcastMedia() {
    if (this.state.phase !== "idle" && !this.state.demo) {
      this.send({ type: "call_media", mic: this.state.mic, cam: this.state.cam });
    }
  }

  // ---------- server messages ----------

  onHubStatus(status) {
    if (status === "reconnecting" && this.state.phase !== "idle" && !this.state.demo) {
      // The server drops us from the room on disconnect; rebuild on reconnect.
      for (const session of this.sessions.values()) session.close();
      this.sessions.clear();
      this.set({ peers: {}, rejoin: true });
    }
  }

  onReady(message) {
    this.iceServers = message.iceServers || this.iceServers;
    const rooms = {};
    for (const room of message.rooms || []) rooms[room.convId] = room;
    this.set({ rooms });
    if (this.state.rejoin && this.state.phase !== "idle" && this.state.convId) {
      this.set({ rejoin: false });
      this.send({ type: "call_join", convId: this.state.convId });
    }
  }

  onMessage(message) {
    switch (message.type) {
      case "call_ring": {
        if (this.state.phase !== "idle" && this.state.convId === message.convId) return;
        if (this.state.phase !== "idle") {
          // Already in a call: show it as a missed call instead of ringing over it.
          this.notice("missed-while-busy", { convId: message.convId, from: message.from });
          return;
        }
        this.set({ incoming: { convId: message.convId, callId: message.callId, from: message.from, video: message.video } });
        return;
      }
      case "call_dismiss":
        if (this.state.incoming?.convId === message.convId) this.set({ incoming: null });
        return;
      case "call_room": {
        const rooms = { ...this.state.rooms };
        if (message.room) rooms[message.convId] = message.room;
        else delete rooms[message.convId];
        const incoming = this.state.incoming;
        const stale = incoming && incoming.convId === message.convId
          && (!message.room || message.room.callId !== incoming.callId || message.room.participants.includes(this.me()));
        this.set({ rooms, incoming: stale ? null : incoming });
        return;
      }
      case "call_joined": {
        if (this.state.convId !== message.convId || this.state.phase === "idle") {
          // Joined from a stale request: leave right away.
          this.send({ type: "call_leave" });
          return;
        }
        this.iceServers = message.iceServers || this.iceServers;
        this.set({ phase: "active", callId: message.callId, video: message.video, startedAt: message.startedAt || 0 });
        // Newcomer offers to everyone already in the call.
        for (const handle of message.peers || []) this.connect(handle, true);
        if ((message.peers || []).length) sounds.join();
        this.broadcastMedia();
        return;
      }
      case "call_peer_joined": {
        if (message.callId !== this.state.callId) return;
        if (!this.sessions.has(message.handle)) this.connect(message.handle, false);
        this.set({ startedAt: this.state.startedAt || message.startedAt || Date.now() });
        sounds.join();
        this.broadcastMedia();
        return;
      }
      case "call_signal": {
        if (message.callId !== this.state.callId) return;
        let session = this.sessions.get(message.from);
        if (!session) session = this.connect(message.from, false);
        session.handleSignal(message.data);
        return;
      }
      case "call_media": {
        if (message.callId !== this.state.callId) return;
        this.patchPeer(message.handle, { mic: message.mic, cam: message.cam });
        return;
      }
      case "call_peer_left": {
        if (message.callId !== this.state.callId) return;
        this.sessions.get(message.handle)?.close();
        this.sessions.delete(message.handle);
        const peers = { ...this.state.peers };
        delete peers[message.handle];
        this.set({ peers });
        sounds.leave();
        return;
      }
      case "call_declined": {
        if (message.convId !== this.state.convId) return;
        this.notice(message.reason === "busy" ? "busy" : "declined", { handle: message.handle });
        return;
      }
      case "call_ended": {
        if (message.convId !== this.state.convId) return;
        const reason = message.reason;
        this.reset();
        if (reason === "no-answer") this.notice("no-answer");
        else if (reason === "moved") this.notice("moved");
        else sounds.leave();
        return;
      }
      case "call_error": {
        if (message.convId !== this.state.convId) return;
        this.reset();
        this.notice(message.reason === "full" ? "full" : message.reason === "ended" ? "ended" : "failed");
        return;
      }
      default:
    }
  }

  connect(handle, offerer) {
    this.sessions.get(handle)?.close();
    const session = new PeerSession({
      handle,
      offerer,
      iceServers: this.iceServers,
      local: this.localStream,
      onSignal: (data) => this.send({ type: "call_signal", to: handle, data }),
      onStream: (stream) => this.patchPeer(handle, { stream }),
      onState: (state) => this.patchPeer(handle, { state }),
    });
    this.sessions.set(handle, session);
    this.patchPeer(handle, {});
    return session;
  }

  patchPeer(handle, patch) {
    const current = this.state.peers[handle] || { stream: null, mic: true, cam: this.state.video, state: "new" };
    this.set({ peers: { ...this.state.peers, [handle]: { ...current, ...patch } } });
  }

  reset() {
    this.request += 1;
    window.clearTimeout(this.demoTimer);
    for (const session of this.sessions.values()) session.close();
    this.sessions.clear();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.set({ ...IDLE, rejoin: false });
  }

  dispose() {
    this.reset();
    this.stopRing?.();
    this.stopBack?.();
    this.listeners.clear();
  }
}
