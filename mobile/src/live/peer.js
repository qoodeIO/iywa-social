// One RTCPeerConnection per remote person in a mesh call (react-native-webrtc),
// ported from src/live/peer.js: the newcomer offers (no glare), early ICE candidates
// are queued, a video transceiver always exists so the camera can be turned on later
// with replaceTrack, and the offerer retries with an ICE restart on failure.

import { MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from "react-native-webrtc";

const MAX_RESTARTS = 2;

export class PeerSession {
  constructor({ handle, offerer, iceServers, local, onSignal, onStream, onState }) {
    this.handle = handle;
    this.offerer = offerer;
    this.onSignal = onSignal;
    this.onStream = onStream;
    this.onState = onState;
    this.pending = [];
    this.restarts = 0;
    this.closed = false;
    this.queue = Promise.resolve();
    this.remote = null;
    this.version = 0;
    this.local = local;
    this.pc = new RTCPeerConnection({ iceServers });
    this.pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) this.onSignal({ kind: "candidate", candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate });
    });
    this.pc.addEventListener("track", (event) => {
      const stream = event.streams?.[0];
      if (stream) this.remote = stream;
      else {
        if (!this.remote) this.remote = new MediaStream();
        if (!this.remote.getTracks().includes(event.track)) this.remote.addTrack(event.track);
      }
      const track = event.track;
      track.addEventListener?.("mute", () => this.emitStream());
      track.addEventListener?.("unmute", () => this.emitStream());
      track.addEventListener?.("ended", () => this.emitStream());
      this.emitStream();
    });
    this.pc.addEventListener("connectionstatechange", () => this.onConnection());
    if (offerer) {
      const audio = local?.getAudioTracks()[0];
      const video = local?.getVideoTracks()[0];
      this.audio = this.pc.addTransceiver(audio || "audio", { direction: "sendrecv", streams: local ? [local] : [] });
      this.video = this.pc.addTransceiver(video || "video", { direction: "sendrecv", streams: local ? [local] : [] });
      this.run(() => this.offer());
    }
  }

  emitStream() {
    if (this.closed || !this.remote) return;
    this.version += 1;
    this.onStream(this.remote, this.version);
  }

  run(step) {
    this.queue = this.queue.then(() => (this.closed ? null : step())).catch((error) => {
      if (!this.closed && __DEV__) console.log("peer", this.handle, String(error?.message || error));
    });
    return this.queue;
  }

  async offer(options) {
    const offer = await this.pc.createOffer(options || {});
    await this.pc.setLocalDescription(offer);
    this.onSignal({ kind: "description", description: { type: offer.type, sdp: offer.sdp } });
  }

  handleSignal(data) {
    return this.run(async () => {
      if (data.kind === "candidate") {
        if (!this.pc.remoteDescription) {
          this.pending.push(data.candidate);
          return;
        }
        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
        return;
      }
      if (data.kind !== "description") return;
      const { description } = data;
      if (description.type === "offer") {
        if (this.offerer && this.pc.signalingState !== "stable") return;
        await this.pc.setRemoteDescription(new RTCSessionDescription(description));
        this.adopt();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.onSignal({ kind: "description", description: { type: answer.type, sdp: answer.sdp } });
      } else if (description.type === "answer") {
        if (this.pc.signalingState !== "have-local-offer") return;
        await this.pc.setRemoteDescription(new RTCSessionDescription(description));
      }
      const queued = this.pending.splice(0);
      for (const candidate of queued) await this.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });
  }

  adopt() {
    // Answerer: send our tracks on the transceivers created by the offer.
    for (const transceiver of this.pc.getTransceivers()) {
      const kind = transceiver.receiver?.track?.kind;
      if (kind === "audio" && !this.audio) this.audio = transceiver;
      if (kind === "video" && !this.video) this.video = transceiver;
    }
    const audio = this.local?.getAudioTracks()[0] || null;
    const video = this.local?.getVideoTracks()[0] || null;
    for (const [transceiver, track] of [[this.audio, audio], [this.video, video]]) {
      if (!transceiver) continue;
      try { transceiver.direction = "sendrecv"; } catch { /* read-only on some versions */ }
      transceiver.sender.replaceTrack(track).catch(() => {});
    }
  }

  replaceVideo(track) {
    return this.video?.sender.replaceTrack(track || null).catch(() => {});
  }

  replaceAudio(track) {
    return this.audio?.sender.replaceTrack(track || null).catch(() => {});
  }

  onConnection() {
    const state = this.pc.connectionState;
    if (state === "connected") this.restarts = 0;
    if (state === "failed" && this.offerer && this.restarts < MAX_RESTARTS) {
      this.restarts += 1;
      this.onState?.("reconnecting");
      this.run(() => this.offer({ iceRestart: true }));
      return;
    }
    this.onState?.(state);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.pc.close(); } catch { /* already closed */ }
  }
}
