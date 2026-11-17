// Stripe Connect through the iywa hub (the same /calls/api endpoints as the web app).
// The hub address comes from EXPO_PUBLIC_HUB_URL (ws:// or wss://, like the web's VITE_HUB_URL).
// Without it, or when the hub is not deployed, every call fails and the screens say so.
import * as WebBrowser from "expo-web-browser";
import { hubUrl } from "../live/config";
import { apiToken } from "./api";
import { myHandle } from "./session";
import { t } from "./i18n";

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
  // The server acts for the signed-in account (Authorization), not for a handle in the body.
  const auth = apiToken() ? { authorization: `Bearer ${apiToken()}` } : {};
  const response = await fetch(`${base}${path}`, body
    ? { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(body) }
    : { headers: auth });
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

// ---------------------------------------------------------------------------
// Buyer checkout (web CartScreen/ProductScreen onCheckout + the ?checkout= return).
// The worker creates the Stripe Checkout session and holds every key; the app only opens
// the hosted page in an auth session and confirms the order when it closes.
// ---------------------------------------------------------------------------
// Where Stripe sends the buyer back: the app scheme (app.json "scheme": "space").
export const CHECKOUT_RETURN = "space://checkout";

// The handle the hub knows this account by (same as payments.js / orders.js).
export function payHandle() {
  return myHandle();
}

function webReturn() {
  const base = payBase();
  return base ? `${base.replace(/\/calls\/api$/, "")}/` : null;
}

// body: { seller, productId, qty, variant } or { seller, items: [{ productId, qty, variant }] }.
// The buyer is the signed-in account (the token), never a handle in the body.
// Resolves { status: "paid" | "processing" | "cancelled" | "unknown", order }.
export async function startCheckout(body) {
  let start;
  try {
    start = await payApi("/checkout", { ...body, returnUrl: CHECKOUT_RETURN });
  } catch (error) {
    // Workers that only accept http(s) return URLs: come back to the hub page instead,
    // the order is still confirmed below as soon as the browser closes.
    const fallback = webReturn();
    if (error.code !== "return-url" || !fallback) throw error;
    start = await payApi("/checkout", { ...body, returnUrl: fallback });
  }
  const result = await WebBrowser.openAuthSessionAsync(start.url, CHECKOUT_RETURN).catch(() => ({ type: "dismiss" }));
  const back = result?.type === "success" && result.url ? (String(result.url).match(/[?&]checkout=([^&#]+)/) || [])[1] : null;
  if (back === "cancel") return { status: "cancelled", order: null, orderId: start.orderId };
  try {
    const { order } = await payApi("/orders/confirm", { orderId: start.orderId });
    if (order?.status === "paid" || order?.status === "shipped") return { status: "paid", order, orderId: start.orderId };
    return { status: back === "success" ? "processing" : "cancelled", order, orderId: start.orderId };
  } catch {
    return { status: "unknown", order: null, orderId: start.orderId };
  }
}

export function checkoutResultText(status) {
  if (status === "paid") return t("Ordine confermato 🎉");
  if (status === "processing") return t("Pagamento in elaborazione");
  if (status === "cancelled") return t("Pagamento annullato");
  return t("Controlla i tuoi ordini");
}

export function checkoutErrorText(code) {
  return {
    offline: t("Server non raggiungibile"),
    "stripe-not-configured": t("Pagamenti non ancora attivi sul server"),
    "seller-not-ready": t("Questa bottega non accetta ancora pagamenti"),
    stock: t("Non ci sono abbastanza pezzi"),
    "own-product": t("Non puoi comprare un tuo prodotto"),
    product: t("Questo prodotto non è più in vendita"),
    "unknown-user": t("Accedi per acquistare"),
    auth: t("Accedi per acquistare"),
  }[code] || t("Pagamento non avviato. Riprova.");
}

// Live order events from the hub ("order" messages): the orders screen listens to reload.
const orderListeners = new Set();
export function emitOrderEvent(message) {
  orderListeners.forEach((fn) => fn(message));
}
export function onOrderEvent(fn) {
  orderListeners.add(fn);
  return () => orderListeners.delete(fn);
}
