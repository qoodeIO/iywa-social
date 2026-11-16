// One RTCPeerConnection per remote person in a mesh call.
// Ported from Spinchat's PeerSession: explicit roles (the newcomer offers, which
// avoids glare), early ICE candidates are queued, a video transceiver always
// exists so the camera can be turned on later with replaceTrack (no
// renegotiation), and the offerer retries with an ICE restart on failure.

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
    this.remote = new MediaStream();
    this.pc = new RTCPeerConnection({ iceServers });
    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.onSignal({ kind: "candidate", candidate: event.candidate.toJSON() });
    };
    this.pc.ontrack = (event) => {
      if (!this.remote.getTracks().includes(event.track)) this.remote.addTrack(event.track);
      event.track.onunmute = () => this.emitStream();
      event.track.onended = () => this.emitStream();
      this.emitStream();
    };
    this.pc.onconnectionstatechange = () => this.onConnection();
    if (offerer) {
      const audio = local?.getAudioTracks()[0];
      const video = local?.getVideoTracks()[0];
      this.audio = this.pc.addTransceiver(audio || "audio", { direction: "sendrecv", streams: local ? [local] : [] });
      this.video = this.pc.addTransceiver(video || "video", { direction: "sendrecv", streams: local ? [local] : [] });
      this.run(() => this.offer());
    }
    this.local = local;
  }

  emitStream() {
    if (this.closed) return;
    // A fresh MediaStream object lets React notice the change.
    this.onStream(new MediaStream(this.remote.getTracks().filter((track) => track.readyState === "live")));
  }

  run(step) {
    // Serialise every negotiation step (Spinchat's run() was not a queue).
    this.queue = this.queue.then(() => (this.closed ? null : step())).catch((error) => {
      if (!this.closed) console.warn("peer", this.handle, error);
    });
    return this.queue;
  }

  async offer(options) {
    const offer = await this.pc.createOffer(options);
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
        await this.pc.addIceCandidate(data.candidate).catch(() => {});
        return;
      }
      if (data.kind !== "description") return;
      const { description } = data;
      if (description.type === "offer") {
        if (this.offerer && this.pc.signalingState !== "stable") return;
        await this.pc.setRemoteDescription(description);
        this.adopt();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.onSignal({ kind: "description", description: { type: answer.type, sdp: answer.sdp } });
      } else if (description.type === "answer") {
        if (this.pc.signalingState !== "have-local-offer") return;
        await this.pc.setRemoteDescription(description);
      }
      const queued = this.pending.splice(0);
      for (const candidate of queued) await this.pc.addIceCandidate(candidate).catch(() => {});
    });
  }

  adopt() {
    // Answerer: send our tracks on the transceivers created by the offer.
    for (const transceiver of this.pc.getTransceivers()) {
      const kind = transceiver.receiver.track?.kind;
      if (kind === "audio" && !this.audio) this.audio = transceiver;
      if (kind === "video" && !this.video) this.video = transceiver;
    }
    const audio = this.local?.getAudioTracks()[0] || null;
    const video = this.local?.getVideoTracks()[0] || null;
    if (this.audio) {
      this.audio.direction = "sendrecv";
      this.audio.sender.replaceTrack(audio).catch(() => {});
      if (this.local) this.audio.sender.setStreams?.(this.local);
    }
    if (this.video) {
      this.video.direction = "sendrecv";
      this.video.sender.replaceTrack(video).catch(() => {});
      if (this.local) this.video.sender.setStreams?.(this.local);
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
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.remote.getTracks().forEach((track) => track.stop());
    this.pc.close();
  }
}
