import seed from "./seed.json";

// Seed times were frozen when the data was extracted; shift them so "2h ago" stays "2h ago".
const SHIFT = Date.now() - seed.BOOT_AT;
const NOTE_SHIFT = Date.now() - seed.NOW0;

export const AVATAR = seed.AVATAR;
export const PORTRAIT = seed.PORTRAIT;
export const PEOPLE = seed.SEARCH_PEOPLE;
export const CONTACTS = seed.CONTACTS;
export const WORKS = seed.WORKS;
export const REELS = seed.REELS;
export const HIGHLIGHTS = seed.HIGHLIGHTS;
export const PROFILE = { ...seed.PROFILE_SEED, src: AVATAR, followers: 1400, following: 86 };
export const POSTS = seed.POSTS.map((post) => ({ ...post, avatar: post.mine ? AVATAR : post.avatar }));
export const STORY_DECKS = seed.STORY_DECKS;
export const SHOPS = seed.SHOPS;
export const MY_PRODUCTS = seed.MY_PRODUCTS_SEED;
export const BUSINESS = seed.DEFAULT_BUSINESS;
export const REVIEW_LINES = seed.REVIEW_LINES;
export const SHOP_TOPICS = seed.SHOP_TOPICS;
export const EXPLORE_TOPICS = seed.EXPLORE_TOPICS;

const rebaseThought = (item) => ({ ...item, created: item.created + SHIFT, replies: (item.replies || []).map(rebaseThought), poll: item.poll ? { ...item.poll, endsAt: item.poll.endsAt + SHIFT } : undefined });
export const THOUGHTS = seed.THOUGHT_SEED.map(rebaseThought);
export const NOTIFICATIONS = seed.NOTIFY_SEED.map((note) => ({ ...note, at: note.at + NOTE_SHIFT }));

export const CHATS = seed.THREADS.map((thread) => ({ ...thread, messages: thread.messages || [] }));

const shot = (id, w = 900, h = 1125) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
export const EXPLORE = seed.EXPLORE_SEED.map(([id, who, photo, text, likes, tag, extra]) => {
  const person = PEOPLE[who % PEOPLE.length];
  return { id, name: person.name, handle: person.handle, avatar: person.src, image: shot(photo), images: [shot(photo), ...(extra || []).map((x) => shot(x))], text, likes, tag };
});

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
  if (min < 1) return "ora";
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} g`;
  return `${Math.floor(days / 7)} sett`;
}

export function euro(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
}

export function compact(n) {
  if (typeof n === "string") return n;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} Mln`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`.replace(".", ",");
  return String(n);
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------
export const SHIPPING_FEE = 6.9;
export const FREE_SHIPPING = 80;

export function stockLabel(product) {
  if (product.service && product.stock == null) return { tone: "ok", text: "Su prenotazione" };
  if (product.stock == null && !product.madeToOrder) return { tone: "ok", text: "Disponibile" };
  if (product.madeToOrder && !product.stock) return { tone: "order", text: `Su ordinazione · ${product.madeToOrder} sett.` };
  if (!product.stock) return { tone: "out", text: "Esaurito" };
  if (product.stock <= 3) return { tone: "low", text: `Ultimi ${product.stock}` };
  return { tone: "ok", text: "Disponibile" };
}

export function productRef(product, owner) {
  const seller = owner ? `demo:${owner}` : "me";
  return {
    key: `${seller}:${product.id}`,
    seller,
    owner: owner || null,
    product: { id: product.id, name: product.name, price: product.price, images: (product.images || []).slice(0, 1), service: Boolean(product.service), stock: product.stock ?? null, madeToOrder: product.madeToOrder || null, category: product.category || "" },
  };
}

export function findProduct(owner, id, myProducts) {
  if (owner && SHOPS[owner]) return SHOPS[owner].products.find((product) => product.id === id) || null;
  return (myProducts || MY_PRODUCTS).find((product) => product.id === id) || null;
}

export function storeOf(owner) {
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
  const mine = (mineMap?.[key] || []).map((review, index) => ({ id: `me-${index}`, ...review, name: me?.name || "Tu", src: me?.src || AVATAR, mine: true }));
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
  const day = (date) => date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
  return `${day(from)} – ${day(to)} ${to.toLocaleDateString("it-IT", { month: "short" })}`;
}

export const PRICE_BANDS = [["all", null, null, "Tutti"], ["u25", 0, 25, "Sotto 25 €"], ["25-50", 25, 50, "25–50 €"], ["50-100", 50, 100, "50–100 €"], ["o100", 100, null, "Oltre 100 €"]];
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

export const SORTS = [["relevance", "Rilevanza"], ["rating", "Più votati"], ["new", "Più recenti"], ["low", "Prezzo crescente"], ["high", "Prezzo decrescente"]];

// ---------------------------------------------------------------------------
// Home feed (web FEED_PAGES, MEET)
// ---------------------------------------------------------------------------
export const MEET = seed.MEET || [];
export const FEED_PAGES = seed.FEED_PAGES || [];
export const HERO = seed.HERO;
