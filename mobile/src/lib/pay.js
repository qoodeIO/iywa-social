// Stripe Connect through the Space hub (the same /calls/api endpoints as the web app).
// The hub address comes from EXPO_PUBLIC_HUB_URL (ws:// or wss://, like the web's VITE_HUB_URL).
// Without it, or when the hub is not deployed, every call fails and the screens say so.
import { hubUrl } from "../live/config";

export function payBase() {
  const hub = process.env.EXPO_PUBLIC_HUB_URL || hubUrl();
  if (!hub) return null;
  try {
    const url = new URL(hub);
    return `${url.protocol === "wss:" || url.protocol === "https:" ? "https:" : "http:"}//${url.host}/calls/api`;
  } catch {
    return null;
  }
}

export async function payApi(path, body) {
  const base = payBase();
  if (!base) {
    const error = new Error("offline");
    error.code = "offline";
    throw error;
  }
  const response = await fetch(`${base}${path}`, body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `http ${response.status}`);
    error.code = data.error;
    error.detail = data.detail;
    throw error;
  }
  return data;
}

// Where Stripe sends the seller back after onboarding.
export const RETURN_URL = "space://payments";
