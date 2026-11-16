// Files for chat media: the demo voice tone, data URLs from the hub written to disk
// (the native audio player can't play data: URLs), and local files read back as
// data URLs for sending through the hub.

import { File, Paths } from "expo-file-system";
import { keepMediaSync } from "../lib/media-store";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes) {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const n = (a << 16) | (b << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + "=";
  }
  return out;
}

// 8-bit mono WAV from a sample function, like the web's voiceTone().
export function wavBytes(seconds, rate, sample) {
  const n = Math.round(seconds * rate);
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const write = (at, text) => { for (let i = 0; i < text.length; i += 1) bytes[at + i] = text.charCodeAt(i); };
  write(0, "RIFF");
  view.setUint32(4, 36 + n, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, n, true);
  for (let i = 0; i < n; i += 1) bytes[44 + i] = 128 + Math.round(Math.max(-1, Math.min(1, sample(i / rate))) * 120);
  return bytes;
}

function voiceTone(seconds = 2.2) {
  return wavBytes(seconds, 8000, (t) => {
    const env = Math.min(1, t * 14) * Math.min(1, (seconds - t) * 8);
    const wobble = 0.55 + 0.45 * Math.sin(t * 9);
    const value = Math.sin(2 * Math.PI * 196 * t) * 0.34 + Math.sin(2 * Math.PI * 294 * t) * 0.18;
    return value * env * wobble * 0.8;
  });
}

const written = new Map();

async function writeOnce(name, makeBase64) {
  if (written.has(name)) return written.get(name);
  const job = (async () => {
    const file = new File(Paths.cache, name);
    if (!file.exists) {
      file.create({ overwrite: true });
      await file.write(makeBase64(), { encoding: "base64" });
    }
    return file.uri;
  })().catch(() => null);
  written.set(name, job);
  return job;
}

export function demoVoiceUri() {
  return writeOnce("space-voice-demo.wav", () => bytesToBase64(voiceTone()));
}

export function toneUri(name, bytes) {
  return writeOnce(`space-sound-${name}.wav`, () => bytesToBase64(bytes));
}

function hashOf(text) {
  let hash = 0;
  const step = Math.max(1, Math.floor(text.length / 4000));
  for (let i = 0; i < text.length; i += step) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return `${hash.toString(36)}${text.length.toString(36)}`;
}

// Something the audio player can open: a file/http URI as is, a data: URL written to the cache.
export async function playableUri(source) {
  const value = String(source || "");
  if (!value) return demoVoiceUri();
  if (!value.startsWith("data:")) return value;
  const match = value.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/);
  if (!match) return null;
  const ext = /mp4|m4a|aac/.test(match[1]) ? "m4a" : /wav/.test(match[1]) ? "wav" : /ogg/.test(match[1]) ? "ogg" : /webm/.test(match[1]) ? "webm" : "mp3";
  return writeOnce(`space-audio-${hashOf(value)}.${ext}`, () => match[2]);
}

// A local file (picked photo, recorded voice note) as a data URL for the hub.
export async function fileToDataUrl(uri, mime) {
  if (!uri) return null;
  if (String(uri).startsWith("data:") || String(uri).startsWith("https://")) return uri;
  if (!String(uri).startsWith("file:")) return null;
  const file = new File(uri);
  const base64 = await file.base64();
  return `data:${mime};base64,${base64}`;
}

// Keep a picked photo or a recording after the cache is cleared.
export function keepFile(uri, prefix) {
  return keepMediaSync(uri, prefix);
}
