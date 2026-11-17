// HTTP client for the iywa server (calls/src/social.js and payments.js).
// Every request carries the session token; errors come back as Error with `code` and `status`.
import * as LegacyFS from "expo-file-system/legacy";
import { hubUrl } from "../live/config";

export function apiBase() {
  const hub = hubUrl();
  if (!hub) return null;
  return hub.replace(/^ws/, "http").replace(/\/calls\/hub$/, "/calls/api");
}

let token = null;
let onUnauthorized = null;

export function setApiToken(next) {
  token = next || null;
}
export function apiToken() {
  return token;
}
// Called when the server says the session is gone (signed out elsewhere, account deleted).
export function onApiUnauthorized(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(code, status, detail) {
    super(detail || code);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, query, signal } = {}) {
  const base = apiBase();
  if (!base) throw new ApiError("offline", 0);
  let url = base + path;
  if (query) {
    const params = Object.entries(query).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    if (params.length) url += (url.includes("?") ? "&" : "?") + params.join("&");
  }
  // The token this request carried: a 401 only ends the session if it was sent with the
  // current token (a request made before signing in must not sign you out afterwards).
  const sent = token;
  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
        ...(sent ? { authorization: `Bearer ${sent}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("network", 0, String(error?.message || error));
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.error || `http-${response.status}`;
    if (response.status === 401 && code === "auth" && sent && sent === token) onUnauthorized?.();
    throw new ApiError(code, response.status, data?.detail);
  }
  return data;
}

const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg" };

export function mimeOf(uri, fallback = "image/jpeg") {
  const ext = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(String(uri || ""))?.[1]?.toLowerCase();
  return TYPES[ext] || fallback;
}

// Uploads a local file (file://…) to the media bucket and returns its public https URL.
// Remote URLs pass through unchanged.
const uploaded = new Map();
export async function uploadMedia(uri, type) {
  if (!uri || /^https?:\/\//.test(uri)) return uri;
  if (uploaded.has(uri)) return uploaded.get(uri);
  const base = apiBase();
  if (!base) throw new ApiError("offline", 0);
  const mime = type || mimeOf(uri);
  if (uri.startsWith("data:")) {
    const response = await fetch(`${base}/media`, { method: "POST", headers: { "content-type": mime, authorization: `Bearer ${token}` }, body: await (await fetch(uri)).blob() });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(data?.error || "upload", response.status);
    uploaded.set(uri, data.url);
    return data.url;
  }
  const result = await LegacyFS.uploadAsync(`${base}/media`, uri, {
    httpMethod: "POST",
    uploadType: LegacyFS.FileSystemUploadType.BINARY_CONTENT,
    headers: { "content-type": mime, authorization: `Bearer ${token}` },
  });
  let data = null;
  try { data = JSON.parse(result.body); } catch { /* not json */ }
  if (result.status < 200 || result.status >= 300 || !data?.url) throw new ApiError(data?.error || "upload", result.status);
  uploaded.set(uri, data.url);
  return data.url;
}

// The server answers in codes; these are the words people see.
export function errorText(error, t) {
  const code = error?.code || "";
  const map = {
    network: t("Connessione assente. Riprova."),
    offline: t("Connessione assente. Riprova."),
    "no-account": t("Nessun account con questo nome utente o email."),
    password: t("Password errata. Riprova."),
    "handle-taken": t("Questo nome utente è già in uso."),
    "email-taken": t("Questa email è già registrata."),
    handle: t("Nome utente non valido: 3–30 caratteri, lettere, numeri, punti e trattini bassi."),
    email: t("Indirizzo email non valido."),
    weak: t("La password deve avere almeno 6 caratteri."),
    "media-size": t("Il file è troppo grande."),
    "media-type": t("Formato non supportato."),
    upload: t("Caricamento non riuscito. Riprova."),
    "not-found": t("Non trovato."),
    forbidden: t("Non puoi farlo."),
    "slow-down": t("Troppi tentativi. Riprova tra un minuto."),
  };
  return map[code] || t("Qualcosa è andato storto. Riprova.");
}
