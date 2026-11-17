import seed from "./seed.json";
import { localeTag, t, tk } from "../lib/i18n";

// No demo content: every person, post, story, shop and chat comes from the iywa server
// (lib/social.js). These names stay exported, empty, for code that still reads them.
export const AVATAR = "";
export const PORTRAIT = "";
export const PEOPLE = [];
export const CONTACTS = [];
export const WORKS = [];
export const REELS = [];
export const HIGHLIGHTS = [];
export const PROFILE = { name: "", handle: "", bio: "", src: "", followers: 0, following: 0 };
export const POSTS = [];
export const STORY_DECKS = [];
export const SHOPS = {};
export const MY_PRODUCTS = [];
// Empty business details for a new shop.
export const BUSINESS = { title: "", category: "", address: "", city: "", phone: "", email: "", hours: { days: [1, 2, 3, 4, 5], open: "09:00", close: "18:00" }, shop: false };
export const REVIEW_LINES = [];
export const SHOP_TOPICS = seed.SHOP_TOPICS;
export const EXPLORE_TOPICS = seed.EXPLORE_TOPICS;
export const THOUGHTS = [];
export const NOTIFICATIONS = [];
export const CHATS = [];
export const EXPLORE = [];

// The products tagged on a post that still exist in a shop: [{ owner, product }].
export function postProducts(post) {
  return (post?.products || [])
    .map((ref) => ({ owner: ref.owner, product: findProduct(ref.owner, ref.id) }))
    .filter((entry) => entry.owner && entry.product);
}

export function personByName(name) {
  return PEOPLE.find((person) => person.name === name) || CONTACTS.find((person) => person.name === name) || null;
}

export function personByHandle(handle) {
  const clean = String(handle || "").replace(/^@/, "");
  return PEOPLE.find((person) => person.handle === clean) || null;
}

const TONES = seed.AVATAR_TONES;
export function hashOf(text) {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
export function avatarFor(name) {
  return personByName(name)?.src || null;
}
export function toneFor(name) {
  return TONES[hashOf(name) % TONES.length];
}

// ---------------------------------------------------------------------------
// Time and money
// ---------------------------------------------------------------------------
export function ago(at) {
  const diff = Math.max(0, Date.now() - at);
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("ora");
  if (min < 60) return t("{n} min", { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t("{n} h", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("{n} g", { n: days });
  return t("{n} sett", { n: Math.floor(days / 7) });
}

export function euro(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat(localeTag(), { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
}

export function compact(n) {
  if (typeof n === "string") return n;
  if (n >= 1_000_000) return t("{n} Mln", { n: (n / 1_000_000).toFixed(1).replace(".0", "") });
  if (n >= 1000) return t("{n}k", { n: new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(Math.round(n / 100) / 10) });
  return String(n);
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------
export const SHIPPING_FEE = 6.9;
export const FREE_SHIPPING = 80;

export function stockLabel(product) {
  if (product.service && product.stock == null) return { tone: "ok", text: t("Su prenotazione") };
  if (product.stock == null && !product.madeToOrder) return { tone: "ok", text: t("Disponibile") };
  if (product.madeToOrder && !product.stock) return { tone: "order", text: t("Su ordinazione · {n} sett.", { n: product.madeToOrder }) };
  if (!product.stock) return { tone: "out", text: t("Esaurito") };
  if (product.stock <= 3) return { tone: "low", text: t("Ultimi {n}", { n: product.stock }) };
  return { tone: "ok", text: t("Disponibile") };
}

// ---------------------------------------------------------------------------
// Live sellers: catalogues published to the iywa hub (/calls/api/shops).
// Their owner is "@handle" so routes (/product/@handle/id, /store/@handle) tell them apart
// from the demo shops, which are keyed by name. src/lib/liveShops.js fills this registry.
// ---------------------------------------------------------------------------
const LIVE = new Map();
const liveListeners = new Set();
let liveVersion = 0;

export function isLiveOwner(owner) {
  return typeof owner === "string" && owner.startsWith("@");
}

function liveProduct(item) {
  return { ...item, images: Array.isArray(item.images) ? item.images : item.image ? [item.image] : [], category: item.category || "" };
}

// partial: the list carries only the first products of each seller, so a longer catalogue
// fetched before (one /shop call) keeps its extra products.
export function putLiveShops(list, { partial = false } = {}) {
  for (const shop of list || []) {
    if (!shop?.seller) continue;
    const fresh = (shop.products || []).map(liveProduct);
    const before = LIVE.get(shop.seller);
    const extra = partial && before ? before.products.filter((item) => !fresh.some((entry) => entry.id === item.id)) : [];
    LIVE.set(shop.seller, { seller: shop.seller, shop: shop.shop || before?.shop || null, payments: Boolean(shop.payments), products: [...fresh, ...extra] });
  }
  liveVersion += 1;
  liveListeners.forEach((fn) => fn());
}

export function liveShopOf(seller) {
  return LIVE.get(String(seller || "").replace(/^@/, "")) || null;
}

export function liveSnapshot() {
  return liveVersion;
}

export function onLiveShops(fn) {
  liveListeners.add(fn);
  return () => liveListeners.delete(fn);
}

export function liveStoreOf(live) {
  if (!live) return null;
  const info = live.shop || {};
  const person = personByHandle(live.seller);
  return {
    key: `live:${live.seller}`, owner: `@${live.seller}`, live, handle: live.seller, title: info.title || `@${live.seller}`, city: info.city || "",
    category: info.category || "", src: person?.src || avatarFor(info.title || live.seller), verified: false, products: live.products || [],
    about: info.about || "", since: null, shipsIn: "2–3", returns: 14, responds: null, sales: null, payments: Boolean(live.payments),
  };
}

export function liveStores(skip) {
  const me = String(skip || "").replace(/^@/, "");
  return [...LIVE.values()].filter((live) => live.seller !== me && live.products.length).map(liveStoreOf);
}

export function productRef(product, owner) {
  const live = isLiveOwner(owner) ? liveShopOf(owner) || { seller: owner.slice(1), shop: null, payments: false } : null;
  const seller = live ? `live:${live.seller}` : owner ? `demo:${owner}` : "me";
  return {
    key: `${seller}:${product.id}`,
    seller,
    owner: owner || null,
    live: live ? { seller: live.seller, shop: live.shop || null, payments: Boolean(live.payments) } : null,
    product: { id: product.id, name: product.name, price: product.price, images: (product.images || []).slice(0, 1), service: Boolean(product.service), stock: product.stock ?? null, madeToOrder: product.madeToOrder || null, category: product.category || "" },
  };
}

export function findProduct(owner, id, myProducts) {
  if (isLiveOwner(owner)) return liveShopOf(owner)?.products.find((product) => product.id === id) || null;
  if (owner && SHOPS[owner]) return SHOPS[owner].products.find((product) => product.id === id) || null;
  return (myProducts || MY_PRODUCTS).find((product) => product.id === id) || null;
}

export function storeOf(owner) {
  if (isLiveOwner(owner)) return liveStoreOf(liveShopOf(owner));
  const shop = SHOPS[owner];
  if (!shop) return null;
  const person = personByName(owner);
  return {
    key: `demo:${owner}`, owner, handle: person?.handle || owner, title: shop.title, city: shop.city, category: shop.category,
    src: person?.src, verified: shop.verified, products: shop.products, about: shop.about || "", since: shop.since || null,
    shipsIn: shop.shipsIn || "2–3", returns: shop.returns ?? 14, responds: shop.responds || null, sales: shop.sales || null,
    hours: shop.hours, address: shop.address, phone: shop.phone, email: shop.email,
  };
}

export function allStores() {
  return Object.keys(SHOPS).map(storeOf);
}

export function storeRefs(store) {
  return store.products.map((product) => productRef(product, store.owner));
}

export function seededReviews(key) {
  return { count: 0, avg: 0, list: [] };
}
function unusedSeededReviews(key) {
  const hash = hashOf(key);
  const count = 3 + (hash % 40);
  const stars = [5, 5, 5, 4, 5, 4, 5].slice(0, 3 + (hash % 3));
  const pool = PEOPLE.filter((entry) => !String(key).startsWith(`demo:${entry.name}:`));
  const list = stars.map((value, index) => {
    const person = pool[(hash + index * 3) % pool.length];
    return { id: `${key}-r${index}`, stars: value, text: REVIEW_LINES[(hash + index) % REVIEW_LINES.length], name: person.name, src: person.src, at: Date.now() - (index + 1) * (3 + (hash % 9)) * 86_400_000 };
  });
  return { count, avg: Math.min(5, 4.4 + (hash % 6) / 10), list };
}

export function reviewsFor(key, mineMap, me) {
  const seed = seededReviews(key);
  const mine = (mineMap?.[key] || []).map((review, index) => ({ id: `me-${index}`, ...review, name: me?.name || t("Tu"), src: me?.src || AVATAR, mine: true }));
  const count = seed.count + mine.length;
  const avg = mine.length ? (seed.avg * seed.count + mine.reduce((sum, review) => sum + review.stars, 0)) / count : seed.avg;
  return { count, avg, list: [...mine, ...seed.list] };
}

export function sellerRating(store, mineMap, me) {
  let count = 0;
  let total = 0;
  const list = [];
  for (const ref of storeRefs(store)) {
    const reviews = reviewsFor(ref.key, mineMap, me);
    count += reviews.count;
    total += reviews.avg * reviews.count;
    for (const review of reviews.list) list.push({ ...review, product: ref.product, ref });
  }
  list.sort((a, b) => b.at - a.at);
  const avg = count ? total / count : 0;
  return { count, avg, list, top: avg >= 4.75 && count >= 40 };
}

export function shopTopicOf(store, product) {
  const text = `${store.category} ${store.title}`;
  if (product.service || /corso|course/i.test(product.category || "")) return "Corsi";
  if (/ceram/i.test(text)) return "Ceramica";
  if (/ristor|trattor|cucina/i.test(text)) return "Cucina";
  if (/tess/i.test(text)) return "Tessuti";
  if (/liut|music/i.test(text)) return "Musica";
  return "";
}

export function shippingFor(items) {
  const physical = items.some((item) => !item.product.service);
  const goods = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const fee = physical && goods < FREE_SHIPPING ? SHIPPING_FEE : 0;
  return { goods, fee, total: goods + fee, physical, missing: physical && goods < FREE_SHIPPING ? FREE_SHIPPING - goods : 0 };
}

export function deliveryWindow(store) {
  const [low, high] = String(store?.shipsIn || "2–3").split("–").map(Number);
  const from = new Date(Date.now() + ((low || 2) + 2) * 86_400_000);
  const to = new Date(Date.now() + ((high || low || 3) + 4) * 86_400_000);
  const day = (date) => date.toLocaleDateString(localeTag(), { weekday: "short", day: "numeric" });
  return `${day(from)} – ${day(to)} ${to.toLocaleDateString(localeTag(), { month: "short" })}`;
}

export const PRICE_BANDS = [["all", null, null, tk("Tutti")], ["u25", 0, 25, tk("Sotto 25 €")], ["25-50", 25, 50, tk("25–50 €")], ["50-100", 50, 100, tk("50–100 €")], ["o100", 100, null, tk("Oltre 100 €")]];
export const NO_FILTERS = { price: "all", rating: 0, freeShip: false, ready: false, noCourses: false };

export function applyFilters(list, filters) {
  const band = PRICE_BANDS.find(([id]) => id === filters.price);
  return list.filter((ref) => {
    const { product } = ref;
    if (band && band[1] != null && product.price < band[1]) return false;
    if (band && band[2] != null && product.price >= band[2]) return false;
    if (filters.rating && seededReviews(ref.key).avg < filters.rating) return false;
    if (filters.freeShip && (product.service || product.price < FREE_SHIPPING)) return false;
    if (filters.ready && (product.service || (product.madeToOrder && !product.stock) || product.stock === 0)) return false;
    if (filters.noCourses && product.service) return false;
    return true;
  });
}

export function filterCount(filters) {
  return (filters.price !== "all" ? 1 : 0) + (filters.rating ? 1 : 0) + ["freeShip", "ready", "noCourses"].filter((key) => filters[key]).length;
}

export function sortRefs(list, sort) {
  const rated = (ref) => seededReviews(ref.key).avg;
  if (sort === "low") return [...list].sort((a, b) => a.product.price - b.product.price);
  if (sort === "high") return [...list].sort((a, b) => b.product.price - a.product.price);
  if (sort === "rating") return [...list].sort((a, b) => rated(b) - rated(a));
  if (sort === "new") return [...list].reverse();
  const lanes = [];
  for (const ref of list) {
    let lane = lanes.find((entry) => entry.seller === ref.seller);
    if (!lane) lanes.push((lane = { seller: ref.seller, items: [] }));
    lane.items.push(ref);
  }
  const out = [];
  for (let round = 0; out.length < list.length; round += 1) for (const lane of lanes) if (lane.items[round]) out.push(lane.items[round]);
  return out;
}

export const SORTS = [["relevance", tk("Rilevanza")], ["rating", tk("Più votati")], ["new", tk("Più recenti")], ["low", tk("Prezzo crescente")], ["high", tk("Prezzo decrescente")]];

// ---------------------------------------------------------------------------
// Home feed (web FEED_PAGES, MEET)
// ---------------------------------------------------------------------------
export const MEET = [];
export const FEED_PAGES = [];
export const HERO = null;
