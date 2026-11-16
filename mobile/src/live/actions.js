// Sending and calling, for live chats (through the hub) and demo chats (on the phone).
import { fileToDataUrl } from "./media";

const LIMIT = { image: 900_000, audio: 1_400_000 };

// Live messages travel as data URLs; local files are read just before sending.
export async function forHub(payload) {
  if (payload.kind === "image" && payload.image && !/^(data:|https:)/.test(payload.image)) {
    const image = await fileToDataUrl(payload.image, "image/jpeg");
    if (!image) throw new Error("image");
    if (image.length > LIMIT.image) throw new Error("too-big");
    return { ...payload, image };
  }
  if (payload.kind === "audio" && payload.audio && !String(payload.audio).startsWith("data:")) {
    const ext = String(payload.audio).split("?")[0].split(".").pop();
    const audio = await fileToDataUrl(payload.audio, ext === "wav" ? "audio/wav" : ext === "caf" ? "audio/x-caf" : "audio/mp4");
    if (!audio) throw new Error("audio");
    if (audio.length > LIMIT.audio) throw new Error("too-big");
    return { ...payload, audio };
  }
  return payload;
}

export async function sendTo({ live, store }, target, payload) {
  if (!target) return;
  if (target.live) {
    live.send(target.id, await forHub(payload));
    return;
  }
  store.addChatMessage(target.id, typeof payload === "string" ? { kind: "text", text: payload } : payload);
}

export function placeCall(live, target, kind) {
  if (!live || !target) return;
  if (target.live) {
    if (live.call.rooms[target.id]) live.calls.join(target.id);
    else live.calls.start(target.id, kind === "video");
  } else {
    live.calls.startDemo(target, kind === "video");
  }
}
