// Sending and calling through the hub.
import { uploadMedia } from "../lib/api";
import { fileToDataUrl } from "./media";

const LIMIT = { image: 900_000, audio: 1_400_000 };

// Photos go to the media bucket and travel as their https URL. The hub only takes https
// URLs or data URLs, so when the upload fails or the server is plain http (wrangler dev)
// the photo goes inline as a data URL (the picker already compresses it).
// Voice notes always travel as data URLs: the hub accepts nothing else for audio.
export async function forHub(payload) {
  if (payload.kind === "image" && payload.image && !/^(data:|https:)/.test(payload.image)) {
    const url = await uploadMedia(payload.image, "image/jpeg").catch(() => null);
    if (url && url.startsWith("https://")) return { ...payload, image: url };
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

export async function sendTo(live, target, payload) {
  if (!live || !target) return;
  live.send(target.id, await forHub(typeof payload === "string" ? { kind: "text", text: payload } : payload));
}

export function placeCall(live, target, kind) {
  if (!live || !target) return;
  if (live.call.rooms[target.id]) live.calls.join(target.id);
  else live.calls.start(target.id, kind === "video");
}
