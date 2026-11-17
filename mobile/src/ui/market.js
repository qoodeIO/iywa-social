import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { myHandle } from "../lib/session";
import { t, tk } from "../lib/i18n";
import { FREE_SHIPPING, SHIPPING_FEE, euro, stockLabel } from "../data";
import { Bag, ChatText, Clock, Heart, ShieldCheck, Store, Truck, Verified } from "./icons";
import { Btn, Name, Stars, T, tap } from "./kit";

const W = Dimensions.get("window").width;
export const GRID_GAP = 10;
export const CARD_W = (W - INSET * 2 - GRID_GAP) / 2;

// Sellers are handles. Routes may carry "@x", an encoded value or "me".
export function cleanHandle(owner) {
  let value = String(owner || "");
  try { value = decodeURIComponent(value); } catch { /* already plain */ }
  value = value.replace(/^@/, "").trim().toLowerCase();
  if (value === "me") return myHandle() || "";
  return value;
}

// The seller of a cart/wishlist entry (also reads entries saved before handles, { live: { seller } }).
export function sellerOf(ref) {
  return cleanHandle(ref?.owner || ref?.live?.seller || "");
}

// A product as the cart, wishlist and grids keep it: small and self-contained.
export function marketRef(product, owner, { shop, payments } = {}) {
  const seller = cleanHandle(owner);
  return {
    key: `${seller}:${product.id}`,
    seller,
    owner: seller,
    shop: shop ? { title: shop.title || "", city: shop.city || "" } : null,
    payments: Boolean(payments),
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      images: (product.images || []).slice(0, 1),
      service: Boolean(product.service),
      stock: product.stock ?? null,
      madeToOrder: product.madeToOrder || null,
      category: product.category || "",
      updatedAt: product.updatedAt || 0,
    },
  };
}

// One entry of GET /shops in the shape the shop screens use.
export function shopFromList(entry) {
  const info = entry.shop || {};
  return {
    owner: entry.seller,
    title: info.title || `@${entry.seller}`,
    city: info.city || "",
    category: info.category || "",
    count: entry.count || entry.products?.length || 0,
    payments: Boolean(entry.payments),
    products: entry.products || [],
  };
}

export function shopRefs(shop) {
  return shop.products.map((product) => marketRef(product, shop.owner, { shop, payments: shop.payments }));
}

export function productHref(ref) {
  const owner = sellerOf(ref) || "me";
  return `/product/${encodeURIComponent(owner)}/${encodeURIComponent(ref.product.id)}`;
}

export function storeHref(owner) {
  return `/store/${encodeURIComponent(cleanHandle(owner))}`;
}

// Average and per-star counts of a real review list.
export function reviewStats(list) {
  const count = list?.length || 0;
  const bars = [5, 4, 3, 2, 1].map((stars) => [stars, count ? list.filter((review) => review.stars === stars).length / count : 0]);
  const avg = count ? list.reduce((sum, review) => sum + (Number(review.stars) || 0), 0) / count : 0;
  return { count, avg, bars };
}

// ---------- filters and sorting on real products ----------
export const PRICE_BANDS = [["all", null, null, tk("Tutti")], ["u25", 0, 25, tk("Sotto 25 €")], ["25-50", 25, 50, tk("25–50 €")], ["50-100", 50, 100, tk("50–100 €")], ["o100", 100, null, tk("Oltre 100 €")]];
export const NO_FILTERS = { price: "all", freeShip: false, ready: false, noCourses: false };
export const SORTS = [["relevance", tk("Rilevanza")], ["new", tk("Più recenti")], ["low", tk("Prezzo crescente")], ["high", tk("Prezzo decrescente")]];

export function applyFilters(list, filters) {
  const band = PRICE_BANDS.find(([id]) => id === filters.price);
  return list.filter(({ product }) => {
    if (band && band[1] != null && product.price < band[1]) return false;
    if (band && band[2] != null && product.price >= band[2]) return false;
    if (filters.freeShip && (product.service || product.price < FREE_SHIPPING)) return false;
    if (filters.ready && (product.service || (product.madeToOrder && !product.stock) || product.stock === 0)) return false;
    if (filters.noCourses && product.service) return false;
    return true;
  });
}

export function filterCount(filters) {
  return (filters.price !== "all" ? 1 : 0) + ["freeShip", "ready", "noCourses"].filter((key) => filters[key]).length;
}

export function sortRefs(list, sort) {
  if (sort === "low") return [...list].sort((a, b) => a.product.price - b.product.price);
  if (sort === "high") return [...list].sort((a, b) => b.product.price - a.product.price);
  if (sort === "new") return [...list].sort((a, b) => (b.product.updatedAt || 0) - (a.product.updatedAt || 0));
  // Relevance: one product per shop in turn, so a big catalogue doesn't fill the page.
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

// ---------- components ----------

// A shop or seller picture; without one, the initial on a grey circle.
export function ShopAvatar({ src, name, size = 38 }) {
  const theme = useTheme();
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill }} contentFit="cover" transition={150} />;
  const letter = String(name || "").replace(/^@/, "").trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }}>
      {letter ? <T size={size * 0.42} weight="700" color={theme.text2}>{letter}</T> : <Store size={size * 0.5} weight="fill" color={theme.text3} />}
    </View>
  );
}

export function ProductImage({ uri, style }) {
  const theme = useTheme();
  if (uri) return <Image source={{ uri }} style={[{ backgroundColor: theme.fill }, style]} contentFit="cover" transition={200} />;
  return <View style={[{ backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }, style]}><Bag size={28} color={theme.text3} /></View>;
}

export function WishButton({ refValue, size = 30 }) {
  const store = useStore();
  const on = store.wishlist.some((item) => item.key === refValue.key);
  return (
    <Pressable
      hitSlop={6}
      accessibilityLabel={on ? t("Rimuovi dai preferiti") : t("Aggiungi ai preferiti")}
      onPress={() => { tap(); store.toggleWish(refValue); }}
      style={[styles.wish, { width: size, height: size, borderRadius: size / 2, backgroundColor: on ? "#fff" : "rgba(0,0,0,0.38)" }]}
    >
      <Heart size={size * 0.55} weight={on ? "fill" : "regular"} color={on ? "#ff3040" : "#fff"} />
    </Pressable>
  );
}

export function MarketCard({ refValue, width = CARD_W, showShop = true }) {
  const theme = useTheme();
  const { product } = refValue;
  const stock = stockLabel(product);
  const mine = Boolean(refValue.seller) && refValue.seller === myHandle();
  const shopName = refValue.shop?.title || (refValue.seller ? `@${refValue.seller}` : "");
  return (
    <Pressable onPress={() => { tap(); router.push(productHref(refValue)); }} style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View>
        <ProductImage uri={product.images?.[0]} style={{ width, height: width, borderRadius: 8 }} />
        {stock.tone !== "ok" ? (
          <View style={styles.flag}><T size={11} weight="600" color="#fff">{stock.tone === "order" ? t("Su ordinazione") : stock.text}</T></View>
        ) : null}
        {!mine ? <View style={{ position: "absolute", right: 6, bottom: 6 }}><WishButton refValue={refValue} /></View> : null}
      </View>
      <T size={13.5} lines={1} style={{ marginTop: 7 }}>{product.name}</T>
      <T size={15} weight="700">{euro(product.price)}</T>
      {mine ? <T size={12} color={theme.text2}>{t("Il tuo shop")}</T> : showShop && shopName ? <T size={12} color={theme.text2} lines={1}>{shopName}</T> : null}
    </Pressable>
  );
}

export function Grid({ refs, showShop = true }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, rowGap: 18, paddingHorizontal: INSET }}>
      {refs.map((ref) => <MarketCard key={ref.key} refValue={ref} showShop={showShop} />)}
    </View>
  );
}

export function Collage({ images, height, radius = 0 }) {
  const theme = useTheme();
  const list = images.filter(Boolean).slice(0, 3);
  if (list.length < 3) {
    return <View style={{ height, flexDirection: "row", gap: 2, borderRadius: radius, overflow: "hidden", backgroundColor: theme.fill }}>{list.map((src) => <Image key={src} source={{ uri: src }} style={{ flex: 1 }} contentFit="cover" />)}</View>;
  }
  return (
    <View style={{ height, flexDirection: "row", gap: 2, borderRadius: radius, overflow: "hidden", backgroundColor: theme.fill }}>
      <Image source={{ uri: list[0] }} style={{ flex: 2 }} contentFit="cover" />
      <View style={{ flex: 1, gap: 2 }}>
        <Image source={{ uri: list[1] }} style={{ flex: 1 }} contentFit="cover" />
        <Image source={{ uri: list[2] }} style={{ flex: 1 }} contentFit="cover" />
      </View>
    </View>
  );
}

// A shop from GET /shops (shopFromList).
export function StoreCard({ shop }) {
  const theme = useTheme();
  const meta = [shop.category ? t(shop.category) : "", shop.city].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={() => { tap(); router.push(storeHref(shop.owner)); }} style={({ pressed }) => [styles.storeCard, { borderColor: theme.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Collage images={shop.products.map((product) => product.images?.[0])} height={118} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingTop: 10 }}>
        <View style={{ marginTop: -28, borderRadius: 24, borderWidth: 3, borderColor: theme.bg }}><ShopAvatar src={shop.avatar} name={shop.title} size={38} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={14.5} weight="700" lines={1}>{shop.title}</T>
          <T size={12} color={theme.text2} lines={1}>{meta || (shop.count === 1 ? t("1 prodotto") : t("{n} prodotti", { n: shop.count }))}</T>
        </View>
      </View>
      {shop.payments ? (
        <View style={styles.topFlag}><ShieldCheck size={12} weight="fill" color="#fff" /><T size={11} weight="600" color="#fff">{t("Paghi con Stripe")}</T></View>
      ) : null}
    </Pressable>
  );
}

// The seller box on a product page: seller = server person card, business = their shop details.
export function SellerCard({ seller, business, payments }) {
  const theme = useTheme();
  const handle = seller?.handle || "";
  const title = business?.title || seller?.name || `@${handle}`;
  const meta = [business?.category ? t(business.category) : "", business?.city].filter(Boolean).join(" · ") || `@${handle}`;
  return (
    <Pressable onPress={() => router.push(storeHref(handle))} style={[styles.seller, { borderColor: theme.line }]}>
      <ShopAvatar src={seller?.avatar} name={title} size={46} />
      <View style={{ flex: 1, gap: 3 }}>
        <Name size={15} weight="700" verified={seller?.verified}>{title}</Name>
        <T size={13} color={theme.text2} lines={1}>{meta}</T>
        {payments ? (
          <View style={styles.badgeCompact}><ShieldCheck size={12} weight="fill" color={theme.green} /><T size={12} weight="500" color={theme.text2}>{t("Pagamento sicuro con Stripe")}</T></View>
        ) : null}
      </View>
      <Btn title={t("Visita")} onPress={() => router.push(storeHref(handle))} height={32} />
    </Pressable>
  );
}

// What happens after you buy, from what the server really does (shipping fee in payments.js).
export function TrustRows({ product, payments }) {
  const theme = useTheme();
  const rows = [];
  if (product.service) {
    rows.push([Clock, t("Prenoti in chat"), t("La bottega ti conferma la data")]);
  } else {
    if (product.madeToOrder && !product.stock) rows.push([Clock, t("Realizzato per te in {n} settimane", { n: product.madeToOrder }), t("Tempi e dettagli li concordi con la bottega")]);
    rows.push([Truck, product.price >= FREE_SHIPPING ? t("Spedizione gratuita") : t("Spedizione {fee}", { fee: euro(SHIPPING_FEE) }), t("Gratis per ordini sopra {free}", { free: euro(FREE_SHIPPING) })]);
  }
  if (payments) rows.push([ShieldCheck, t("Pagamento sicuro con Stripe"), t("Carta, Apple Pay, Google Pay")]);
  else rows.push([ChatText, t("Ordini nel Direct"), t("Pagamento e spedizione si concordano in chat con la bottega")]);
  return (
    <View style={{ borderRadius: 12, backgroundColor: theme.fill, marginTop: 14 }}>
      {rows.map(([Icon, title, sub], index) => (
        <View key={title} style={[styles.trust, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null]}>
          <Icon size={20} weight="fill" color={theme.text} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14} weight="600">{title}</T>
            <T size={12.5} color={theme.text2}>{sub}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

export function RatingSummary({ stats }) {
  const theme = useTheme();
  const { avg, count, bars } = stats;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 8 }}>
      <View style={{ alignItems: "center", gap: 3 }}>
        <T size={34} weight="800" style={{ letterSpacing: -1 }}>{count ? avg.toFixed(1) : "–"}</T>
        <Stars value={avg} size={13} />
        <T size={12} color={theme.text2}>{count === 1 ? t("1 recensione") : t("{n} recensioni", { n: count })}</T>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        {bars.map(([value, share]) => (
          <View key={value} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T size={11} color={theme.text2} style={{ width: 8 }}>{value}</T>
            <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.fill, overflow: "hidden" }}>
              <View style={{ width: `${Math.round(share * 100)}%`, height: "100%", borderRadius: 3, backgroundColor: theme.star }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CartButton() {
  const theme = useTheme();
  const store = useStore();
  const count = store.cart.reduce((sum, item) => sum + item.qty, 0);
  return (
    <Pressable hitSlop={8} accessibilityLabel={t("Carrello")} onPress={() => router.push("/shop/cart")} style={{ padding: 6 }}>
      <Bag size={26} color={theme.text} />
      {count ? <View style={[styles.cartBadge, { backgroundColor: theme.red, borderColor: theme.bg }]}><T size={10.5} weight="700" color="#fff">{count}</T></View> : null}
    </Pressable>
  );
}

export function WishlistButton() {
  const theme = useTheme();
  const store = useStore();
  const count = store.wishlist.length;
  return (
    <Pressable hitSlop={8} accessibilityLabel={t("Preferiti")} onPress={() => router.push("/shop/wishlist")} style={{ padding: 6 }}>
      <Heart size={26} color={theme.text} />
      {count ? <View style={[styles.cartBadge, { backgroundColor: theme.text, borderColor: theme.bg }]}><T size={10.5} weight="700" color={theme.bg}>{count}</T></View> : null}
    </Pressable>
  );
}

export { Verified, Bag };

const styles = StyleSheet.create({
  wish: { alignItems: "center", justifyContent: "center" },
  flag: { position: "absolute", left: 6, top: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.62)" },
  storeCard: { width: 236, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  topFlag: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.62)" },
  badgeCompact: { flexDirection: "row", alignItems: "center", gap: 3 },
  seller: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 18 },
  trust: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  cartBadge: { position: "absolute", top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
