import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { localeTag, t, tk } from "../../lib/i18n";
import { FREE_SHIPPING, SHIPPING_FEE, SORTS, ago, euro, sellerRating, sortRefs, storeOf, storeRefs } from "../../data";
import { Bolt, Clock, MapPin, Phone, Return, ShieldCheck, Truck } from "../../ui/icons";
import { Avatar, Btn, Chip, Header, Name, Stars, T, tap } from "../../ui/kit";
import { CartButton, Collage, Grid, RatingSummary, SellerBadges, productHref } from "../../ui/market";
import { useLiveShop } from "../../lib/liveShops";
import { useLive } from "../../live/LiveStore";
import { showToast } from "../../ui/feedEcho";

const DAYS = [tk("Dom"), tk("Lun"), tk("Mar"), tk("Mer"), tk("Gio"), tk("Ven"), tk("Sab")];

export default function StoreScreen() {
  const theme = useTheme();
  const store = useStore();
  const { owner } = useLocalSearchParams();
  const live = useLive();
  useLiveShop(decodeURIComponent(String(owner)));
  const shop = storeOf(decodeURIComponent(String(owner)));
  const [tab, setTab] = useState("products");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [stars, setStars] = useState(0);
  const [limit, setLimit] = useState(8);
  if (!shop) return <View style={{ flex: 1, backgroundColor: theme.bg }}><Header title={t("Bottega")} /></View>;

  const rating = sellerRating(shop, store.reviews, store.profile);
  const following = store.follows.includes(shop.owner);
  const cats = [...new Set(shop.products.map((product) => product.category).filter(Boolean))];
  const refs = sortRefs(storeRefs(shop).filter((ref) => cat === "all" || ref.product.category === cat), sort);
  const reviews = rating.list.filter((review) => !stars || review.stars === stars);

  function message() {
    if (shop.live) {
      live?.openDm(shop.live.seller)
        .then((chatId) => router.push(`/chat/${chatId}`))
        .catch(() => showToast({ text: t("Chat live non raggiungibile. Riprova.") }));
      return;
    }
    const id = store.ensureChat({ name: shop.owner, src: shop.src });
    router.push(`/chat/${id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={shop.title} subtitle={t("Bottega")} right={<CartButton />} />
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 30 }}>
        <View>
          <Collage images={shop.products.map((product) => product.images[0])} height={150} />
          <View style={{ alignItems: "center", paddingHorizontal: INSET }}>
            <View style={{ marginTop: -42, padding: 3, borderRadius: 46, backgroundColor: theme.bg }}><Avatar src={shop.src} size={84} /></View>
            <Name size={21} weight="800" verified={shop.verified} style={{ marginTop: 8 }}>{shop.title}</Name>
            <T size={13.5} color={theme.text2} style={{ marginTop: 2 }}>{[shop.category, shop.city].filter(Boolean).join(" · ")}</T>
            <Pressable onPress={() => setTab("reviews")} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Stars value={rating.avg} size={13} />
              <T size={14} weight="700">{rating.avg.toFixed(1)}</T>
              <T size={13.5} color={theme.text2} style={{ textDecorationLine: "underline" }}>{rating.count === 1 ? t("1 recensione") : t("{n} recensioni", { n: rating.count })}</T>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 28, marginVertical: 14 }}>
              {shop.sales ? <Stat value={shop.sales.toLocaleString(localeTag())} label={t("vendite")} /> : null}
              <Stat value={shop.products.length} label={t("prodotti")} />
              {shop.since ? <Stat value={shop.since} label={t("su iywa dal")} /> : null}
            </View>
            <SellerBadges shop={shop} rating={rating} />
            <View style={{ flexDirection: "row", gap: 6, alignSelf: "stretch", marginTop: 14 }}>
              <Btn title={following ? t("Segui già") : t("Segui")} kind={following ? "gray" : "primary"} flex={1} onPress={() => store.toggleFollow(shop.owner)} />
              <Btn title={t("Messaggio")} flex={1} onPress={message} />
              <Btn title={t("Profilo")} flex={1} onPress={() => router.push(`/person/${shop.handle}`)} />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: theme.bg }}>
        <View style={[styles.tabs, { borderBottomColor: theme.line }]}>
          {[["products", t("Prodotti")], ["reviews", t("Recensioni")], ["about", t("Info")]].map(([id, label]) => (
            <Pressable key={id} style={styles.tab} onPress={() => { tap(); setTab(id); }}>
              <T size={14.5} weight="600" color={tab === id ? theme.text : theme.text2}>{label}</T>
              {tab === id ? <View style={[styles.tabBar, { backgroundColor: theme.text }]} /> : null}
            </Pressable>
          ))}
        </View>
        </View>

        {tab === "products" ? (
          <View style={{ paddingTop: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET }}>
              {["all", ...cats].map((item) => <Chip key={item} title={item === "all" ? t("Tutti") : item} on={cat === item} onPress={() => setCat(item)} />)}
            </ScrollView>
            <View style={styles.listHead}>
              <T size={17} weight="700">{refs.length === 1 ? t("1 prodotto") : t("{n} prodotti", { n: refs.length })}</T>
              <Pressable onPress={() => { const index = SORTS.findIndex(([id]) => id === sort); setSort(SORTS[(index + 1) % SORTS.length][0]); tap(); }} style={[styles.sort, { borderColor: theme.line }]}>
                <T size={13} weight="600">{t(SORTS.find(([id]) => id === sort)[1])}</T>
              </Pressable>
            </View>
            <Grid refs={refs} showShop={false} />
          </View>
        ) : null}

        {tab === "reviews" ? (
          <View style={{ paddingHorizontal: INSET, paddingTop: 12 }}>
            <RatingSummary avg={rating.avg} count={rating.count} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
              {[0, 5, 4, 3].map((value) => <Chip key={value} title={value ? `${value} ★` : t("Tutte")} on={stars === value} onPress={() => { setStars(value); setLimit(8); }} />)}
            </ScrollView>
            {reviews.slice(0, limit).map((review) => (
              <View key={`${review.ref.key}-${review.id}`} style={[styles.review, { borderTopColor: theme.line }]}>
                <Avatar src={review.src} size={32} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <T size={13.5} weight="600">{review.name}</T>
                    <Stars value={review.stars} size={11} />
                  </View>
                  <T size={14} style={{ lineHeight: 19 }}>{review.text}</T>
                  <Pressable onPress={() => router.push(productHref(review.ref))} style={[styles.bought, { backgroundColor: theme.fill }]}>
                    {review.product.images[0] ? <Image source={{ uri: review.product.images[0] }} style={styles.boughtImg} /> : null}
                    <T size={12.5} color={theme.text2} lines={1} style={{ flexShrink: 1 }}>{t("Ha acquistato")} <T size={12.5} weight="600">{review.product.name}</T></T>
                  </Pressable>
                  <T size={12} color={theme.text2}>{ago(review.at)}</T>
                </View>
              </View>
            ))}
            {!reviews.length ? <T color={theme.text2} style={{ paddingVertical: 20, textAlign: "center" }}>{t("Ancora nessuna recensione con queste stelle.")}</T> : null}
            {reviews.length > limit ? <Pressable onPress={() => setLimit((v) => v + 12)} style={{ paddingVertical: 10 }}><T size={14} weight="600" color={theme.text2}>{t("Mostra altre")}</T></Pressable> : null}
          </View>
        ) : null}

        {tab === "about" ? (
          <View style={{ paddingHorizontal: INSET, paddingTop: 16, gap: 12 }}>
            {shop.about ? <T size={15} style={{ lineHeight: 21 }}>{shop.about}</T> : null}
            {shop.address ? (
              <Pressable onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(`${shop.address}, ${shop.city}`)}`)} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <MapPin size={16} weight="fill" color={theme.text} />
                <T size={14} weight="500">{shop.address}, {shop.city}</T>
              </Pressable>
            ) : null}
            {shop.hours ? (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Clock size={16} color={theme.text} />
                <T size={14} color={theme.text2}>{shop.hours.days.map((d) => t(DAYS[d])).join(", ")} · {shop.hours.open}–{shop.hours.close}</T>
              </View>
            ) : null}
            {shop.phone ? <Btn title={t("Chiama")} icon={Phone} onPress={() => Linking.openURL(`tel:${shop.phone.replace(/\s/g, "")}`)} style={{ alignSelf: "flex-start" }} /> : null}
            <T size={15} weight="700" style={{ marginTop: 8 }}>{t("Condizioni della bottega")}</T>
            <View style={{ borderRadius: 12, backgroundColor: theme.fill }}>
              {[
                [Truck, t("Spedizione"), t("Spedisce in {days} giorni lavorativi. {fee}, gratis sopra {free}.", { days: shop.shipsIn, fee: euro(SHIPPING_FEE), free: euro(FREE_SHIPPING) })],
                [Return, t("Resi"), shop.returns ? t("Accettati entro {days} giorni dalla consegna. I pezzi su ordinazione non si possono rendere.", { days: shop.returns }) : t("Non accettati: prodotti freschi fatti in giornata.")],
                [ShieldCheck, t("Pagamenti"), shop.payments ? t("Paghi subito con Stripe: carta, Apple Pay o Google Pay.") : t("Ordini nel Direct e paghi dopo la conferma della bottega.")],
                ...(shop.responds ? [[Bolt, t("Risposte"), t("Di solito risponde {when}.", { when: shop.responds })]] : []),
              ].map(([Icon, title, text], index) => (
                <View key={title} style={[styles.policy, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null]}>
                  <Icon size={20} weight="fill" color={theme.text} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={14} weight="600">{title}</T>
                    <T size={12.5} color={theme.text2} style={{ lineHeight: 17 }}>{text}</T>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <T size={16} weight="700">{value}</T>
      <T size={12.5} color={theme.text2}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", width: "100%", borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  tab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  tabBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5 },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, paddingTop: 14, paddingBottom: 10 },
  sort: { height: 30, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, justifyContent: "center" },
  review: { flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  bought: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", maxWidth: "100%", padding: 5, paddingRight: 10, borderRadius: 8, marginTop: 2 },
  boughtImg: { width: 28, height: 28, borderRadius: 5 },
  policy: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
