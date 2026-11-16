import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { t } from "../lib/i18n";
import { FREE_SHIPPING, SHIPPING_FEE, deliveryWindow, euro, reviewsFor, sellerRating, stockLabel, storeOf } from "../data";
import { Bag, Bolt, Clock, Heart, Medal, Return, ShieldCheck, Truck, Verified } from "./icons";
import { Avatar, Btn, Name, Rating, Stars, T, tap } from "./kit";

const W = Dimensions.get("window").width;
export const GRID_GAP = 10;
export const CARD_W = (W - INSET * 2 - GRID_GAP) / 2;

export function productHref(ref) {
  return `/product/${encodeURIComponent(ref.owner || "me")}/${ref.product.id}`;
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
  const store = useStore();
  const { product } = refValue;
  const stock = stockLabel(product);
  const rating = reviewsFor(refValue.key, store.reviews, store.profile);
  const shop = refValue.owner ? storeOf(refValue.owner) : null;
  return (
    <Pressable onPress={() => { tap(); router.push(productHref(refValue)); }} style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View>
        <Image source={product.images[0] ? { uri: product.images[0] } : null} style={{ width, height: width, borderRadius: 8, backgroundColor: theme.fill }} contentFit="cover" transition={200} />
        {stock.tone !== "ok" ? (
          <View style={styles.flag}><T size={11} weight="600" color="#fff">{stock.tone === "order" ? t("Su ordinazione") : stock.text}</T></View>
        ) : null}
        <View style={{ position: "absolute", right: 6, bottom: 6 }}><WishButton refValue={refValue} /></View>
      </View>
      <T size={13.5} lines={1} style={{ marginTop: 7 }}>{product.name}</T>
      <T size={15} weight="700">{euro(product.price)}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
        {refValue.owner ? <Rating avg={rating.avg} count={rating.count} extra={showShop ? shop?.title : null} /> : <T size={12} color={theme.text2}>{t("Il tuo shop")}</T>}
      </View>
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

export function StoreCard({ shop }) {
  const theme = useTheme();
  const store = useStore();
  const rating = sellerRating(shop, store.reviews, store.profile);
  return (
    <Pressable onPress={() => { tap(); router.push(`/store/${encodeURIComponent(shop.owner)}`); }} style={({ pressed }) => [styles.storeCard, { borderColor: theme.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Collage images={shop.products.map((product) => product.images[0])} height={118} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingTop: 10 }}>
        <View style={{ marginTop: -28, borderRadius: 24, borderWidth: 3, borderColor: theme.bg }}><Avatar src={shop.src} size={38} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Name size={14.5} weight="700" verified={shop.verified}>{shop.title}</Name>
          <Rating avg={rating.avg} count={rating.count} extra={shop.city} />
        </View>
      </View>
      {rating.top ? (
        <View style={styles.topFlag}><Medal size={12} weight="fill" color="#ffc53d" /><T size={11} weight="600" color="#fff">{t("Venditore top")}</T></View>
      ) : null}
    </Pressable>
  );
}

export function SellerBadges({ shop, rating, compact }) {
  const theme = useTheme();
  const items = [];
  if (rating.top) items.push(["top", Medal, t("Venditore top"), "#f5a400"]);
  if (shop.responds) items.push(["fast", Bolt, t("Risponde {when}", { when: shop.responds }), theme.blue]);
  if (!compact) items.push(["ship", Truck, t("Spedisce in {n} giorni", { n: shop.shipsIn }), theme.green]);
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: compact ? 8 : 6, justifyContent: compact ? "flex-start" : "center" }}>
      {items.map(([id, Icon, label, color]) => (
        <View key={id} style={compact ? styles.badgeCompact : [styles.badge, { backgroundColor: theme.fill }]}>
          <Icon size={compact ? 12 : 14} weight="fill" color={color} />
          <T size={compact ? 12 : 12.5} weight={compact ? "500" : "600"} color={compact ? theme.text2 : theme.text}>{label}</T>
        </View>
      ))}
    </View>
  );
}

export function SellerCard({ shop }) {
  const theme = useTheme();
  const store = useStore();
  const rating = sellerRating(shop, store.reviews, store.profile);
  return (
    <Pressable onPress={() => router.push(`/store/${encodeURIComponent(shop.owner)}`)} style={[styles.seller, { borderColor: theme.line }]}>
      <Avatar src={shop.src} size={46} />
      <View style={{ flex: 1, gap: 3 }}>
        <Name size={15} weight="700" verified={shop.verified}>{shop.title}</Name>
        <Rating avg={rating.avg} count={rating.count} size={13} extra={shop.city} />
        <SellerBadges shop={shop} rating={rating} compact />
      </View>
      <Btn title={t("Visita")} onPress={() => router.push(`/store/${encodeURIComponent(shop.owner)}`)} height={32} />
    </Pressable>
  );
}

export function TrustRows({ shop, product }) {
  const theme = useTheme();
  const food = /dispensa|menu/i.test(product.category || "");
  const rows = [];
  if (product.service) {
    rows.push([Clock, t("Prenoti in chat"), shop?.responds ? t("La bottega di solito risponde {when}", { when: shop.responds }) : t("La bottega ti conferma la data")]);
  } else {
    rows.push([Truck, product.madeToOrder && !product.stock ? t("Realizzato per te in {n} settimane", { n: product.madeToOrder }) : t("Arriva {when}", { when: deliveryWindow(shop) }), product.price >= FREE_SHIPPING ? t("Spedizione gratuita") : t("Spedizione {fee} · gratis sopra {free}", { fee: euro(SHIPPING_FEE), free: euro(FREE_SHIPPING) })]);
    rows.push([Return, food || !shop?.returns ? t("Niente resi sugli alimentari") : t("Resi entro {n} giorni", { n: shop.returns }), food || !shop?.returns ? t("Prodotto fresco, fatto in giornata") : t("Scrivi alla bottega nel Direct per avviarlo")]);
  }
  rows.push([ShieldCheck, t("Paghi dopo la conferma della bottega"), t("Pagamento e spedizione si concordano nel Direct")]);
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

export function RatingSummary({ avg, count }) {
  const theme = useTheme();
  const bars = [[5, 74], [4, 19], [3, 5], [2, 1], [1, 1]];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 8 }}>
      <View style={{ alignItems: "center", gap: 3 }}>
        <T size={34} weight="800" style={{ letterSpacing: -1 }}>{avg.toFixed(1)}</T>
        <Stars value={avg} size={13} />
        <T size={12} color={theme.text2}>{count === 1 ? t("1 recensione") : t("{n} recensioni", { n: count })}</T>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        {bars.map(([value, share]) => (
          <View key={value} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T size={11} color={theme.text2} style={{ width: 8 }}>{value}</T>
            <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.fill, overflow: "hidden" }}>
              <View style={{ width: `${share}%`, height: "100%", borderRadius: 3, backgroundColor: theme.star }} />
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
  badge: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 8 },
  badgeCompact: { flexDirection: "row", alignItems: "center", gap: 3 },
  seller: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 18 },
  trust: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  cartBadge: { position: "absolute", top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
