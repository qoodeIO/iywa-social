import { useEffect, useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../../theme";
import { useStore } from "../../../lib/store";
import { t } from "../../../lib/i18n";
import { allStores, ago, euro, findProduct, hashOf, isLiveOwner, productRef, reviewsFor, shopTopicOf, stockLabel, storeOf, storeRefs } from "../../../data";
import { checkoutErrorText, checkoutResultText, payHandle, startCheckout } from "../../../lib/pay";
import { useLiveShop } from "../../../lib/liveShops";
import { useLive } from "../../../live/LiveStore";
import { showToast } from "../../../ui/feedEcho";
import { Bag, Bookmark, Box, Check, Heart, Lock, Send, Star } from "../../../ui/icons";
import { Avatar, Btn, Chip, Header, Rating, Section, Stars, T, tap } from "../../../ui/kit";
import { CartButton, MarketCard, RatingSummary, SellerCard, TrustRows } from "../../../ui/market";

const W = Dimensions.get("window").width;
const TONES = { ok: "#1cb14a", low: "#e08600", order: "#5e5ce6", out: "#8e8e93" };

export default function ProductScreen() {
  const theme = useTheme();
  const store = useStore();
  const { owner: rawOwner, id } = useLocalSearchParams();
  const owner = rawOwner === "me" ? null : decodeURIComponent(String(rawOwner));
  const live = useLive();
  // Live sellers ("@handle") load from the hub; the version re-renders when they arrive.
  useLiveShop(owner);
  const product = findProduct(owner, String(id), store.myProducts);
  const shop = owner ? storeOf(owner) : null;
  const mine = !owner;
  const ref = product ? productRef(product, owner) : null;
  const [slide, setSlide] = useState(0);
  const [variant, setVariant] = useState(product?.variants?.[0] || "");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);
  const canBuy = Boolean(shop?.payments);

  useEffect(() => {
    if (ref && !mine) store.viewProduct(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.key]);

  const similar = useMemo(() => {
    if (!product || mine) return [];
    const topic = shop ? shopTopicOf(shop, product) : "";
    return allStores()
      .filter((item) => item.owner !== owner)
      .flatMap((item) => storeRefs(item).map((r) => ({ ...r, topic: shopTopicOf(item, r.product) })))
      .sort((a, b) => (b.topic === topic) - (a.topic === topic) || hashOf(a.key + product.id) - hashOf(b.key + product.id))
      .slice(0, 8);
  }, [product, owner, shop, mine]);

  if (!product) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }}><Header title={t("Prodotto")} /><T style={{ padding: INSET }}>{isLiveOwner(owner) ? t("Caricamento…") : t("Prodotto non trovato.")}</T></View>;
  }

  const stock = stockLabel(product);
  const soldOut = stock.tone === "out";
  const wished = store.wishlist.some((item) => item.key === ref.key);
  const rating = reviewsFor(ref.key, store.reviews, store.profile);
  const more = (shop?.products || store.myProducts).filter((item) => item.id !== product.id);

  function add() {
    store.addToCart(ref, qty, variant);
    tap("medium");
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  // "Acquista ora": Stripe Checkout for sellers with payments on (web ProductScreen onBuy).
  async function buy() {
    if (buying) return;
    const buyer = payHandle(store);
    if (!buyer) { showToast({ text: t("Prima collegati al Direct") }); return; }
    setBuying(true);
    try {
      const result = await startCheckout({ buyer, seller: shop.live.seller, productId: product.id, qty, variant });
      showToast({ text: checkoutResultText(result.status), src: result.order?.image || product.images[0] || undefined });
      if (result.status === "paid" || result.status === "processing" || result.status === "unknown") router.push("/shop/orders");
    } catch (error) {
      showToast({ text: checkoutErrorText(error.code) });
    }
    setBuying(false);
  }

  function ask() {
    const what = `${qty > 1 ? `${qty} × ` : ""}${product.name}${variant ? ` (${variant})` : ""}`;
    if (shop?.live) {
      // A live seller is a real account: the question goes through the hub Direct.
      live?.openDm(shop.live.seller)
        .then((chatId) => {
          live.send(chatId, t("Ciao! Mi interessa: {what} · {price}. È disponibile?", { what, price: euro(product.price * qty) }));
          router.push(`/chat/${chatId}`);
        })
        .catch(() => showToast({ text: t("Chat live non raggiungibile. Riprova.") }));
      return;
    }
    const person = { name: owner, src: shop?.src };
    const chatId = store.ensureChat(person);
    store.sendMessage(chatId, { kind: "image", image: product.images[0], text: t("Ciao! Mi interessa: {what} · {price}. È disponibile?", { what, price: euro(product.price * qty) }) });
    setTimeout(() => store.receiveMessage(chatId, product.service ? t("Certo! Ti tengo il posto, ci vediamo in bottega 🙂") : t("Certo, è disponibile! Ti mando i dettagli per pagamento e spedizione 🙂")), 3500);
    router.push(`/chat/${chatId}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header
        title={shop?.title || t("Il tuo shop")}
        subtitle={t("Shop")}
        right={(
          <>
            {!mine ? (
              <Pressable hitSlop={8} style={{ padding: 6 }} onPress={() => { tap(); store.toggleWish(ref); }}>
                <Heart size={26} weight={wished ? "fill" : "regular"} color={wished ? theme.red : theme.text} />
              </Pressable>
            ) : null}
            <CartButton />
          </>
        )}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <FlatList
            data={product.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${index}-${item}`}
            onMomentumScrollEnd={(event) => setSlide(Math.round(event.nativeEvent.contentOffset.x / W))}
            renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: W, height: W, backgroundColor: theme.fill }} contentFit="cover" transition={200} />}
          />
          {product.images.length > 1 ? (
            <View style={styles.dots}>{product.images.map((_, index) => <View key={index} style={[styles.dot, { backgroundColor: index === slide ? theme.blue : theme.text3 }]} />)}</View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: INSET, paddingTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: TONES[stock.tone] }} />
            <T size={13} weight="600" color={TONES[stock.tone]}>{stock.text}</T>
          </View>
          {canBuy ? (
            <View style={styles.secure}>
              <Lock size={13} weight="fill" color={theme.green} />
              <T size={12.5} weight="600" color={theme.green}>{t("Pagamento sicuro con Stripe")}</T>
            </View>
          ) : null}
          <T size={22} weight="700" style={{ marginTop: 6, letterSpacing: -0.5 }}>{product.name}</T>
          {!mine ? <View style={{ marginTop: 4 }}><Rating avg={rating.avg} count={rating.count} size={13} /></View> : null}
          <T size={22} weight="700" style={{ marginTop: 6 }}>{euro(product.price)}{product.service ? <T size={14} color={theme.text2}>{" "}{t("a persona")}</T> : null}</T>

          {product.variants?.length ? (
            <>
              <T size={15} weight="600" style={{ marginTop: 18, marginBottom: 8 }}>{product.service ? t("Scegli quando") : t("Scegli")}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {product.variants.map((item) => <Chip key={item} title={item} on={variant === item} onPress={() => setVariant(item)} />)}
              </View>
            </>
          ) : null}

          {!soldOut && !mine ? (
            <View style={styles.qtyRow}>
              <T size={15} weight="600">{product.service ? t("Persone") : t("Quantità")}</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Pressable disabled={qty <= 1} onPress={() => { tap(); setQty((v) => Math.max(1, v - 1)); }} style={[styles.qtyBtn, { backgroundColor: theme.btn, opacity: qty <= 1 ? 0.4 : 1 }]}><T size={18} weight="600">−</T></Pressable>
                <T size={16} weight="700">{qty}</T>
                <Pressable disabled={product.stock != null && product.stock > 0 && qty >= product.stock} onPress={() => { tap(); setQty((v) => v + 1); }} style={[styles.qtyBtn, { backgroundColor: theme.btn }]}><T size={18} weight="600">+</T></Pressable>
              </View>
            </View>
          ) : null}

          {!mine ? <TrustRows shop={shop} product={product} /> : null}

          {product.description ? <T size={15} style={{ marginTop: 16, lineHeight: 21 }}>{product.description}</T> : null}
          <View style={{ marginTop: 10 }}>
            {product.materials ? <Spec icon={Box} label={t("Materiali")} value={product.materials} /> : null}
            {product.size ? <Spec icon={Bookmark} label={product.service ? t("Dettagli") : t("Misure")} value={product.size} /> : null}
          </View>

          {shop ? <SellerCard shop={shop} /> : null}

          {!mine ? <Reviews refKey={ref.key} rating={rating} /> : null}
        </View>

        {more.length ? (
          <Section title={mine ? t("Altri tuoi prodotti") : t("Altro da questa bottega")}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: INSET }}>
              {more.map((item) => <MarketCard key={item.id} refValue={productRef(item, owner)} width={142} showShop={false} />)}
            </ScrollView>
          </Section>
        ) : null}
        {similar.length ? (
          <Section title={t("Ti potrebbe piacere")}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: INSET }}>
              {similar.map((item) => <MarketCard key={item.key} refValue={item} width={142} />)}
            </ScrollView>
          </Section>
        ) : null}
      </ScrollView>

      <View style={[styles.foot, { borderTopColor: theme.line, backgroundColor: theme.bg }]}>
        {mine ? (
          <Btn title={t("Modifica prodotto")} height={44} flex={1} onPress={() => router.push(`/product-edit/${product.id}`)} />
        ) : (
          <>
            <Btn icon={Send} height={44} onPress={ask} style={{ paddingHorizontal: 14 }} />
            <Btn title={added ? t("Aggiunto") : t("Al carrello")} icon={added ? Check : Bag} kind={added ? "done" : "gray"} height={44} size={14.5} flex={1} disabled={soldOut} onPress={add} />
            <Btn
              title={soldOut ? t("Esaurito") : buying ? t("Apertura…") : canBuy ? t("Acquista ora") : t("Compra")}
              icon={canBuy && !soldOut && !buying ? Lock : undefined}
              kind="primary"
              height={44}
              size={14.5}
              flex={1}
              disabled={soldOut || buying}
              onPress={() => {
                if (canBuy) { buy(); return; }
                store.addToCart(ref, qty, variant);
                router.push("/shop/cart");
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

function Spec({ icon: Icon, label, value }) {
  const theme = useTheme();
  return (
    <View style={[styles.spec, { borderBottomColor: theme.line }]}>
      <Icon size={20} weight="fill" color={theme.text} />
      <View style={{ flex: 1 }}>
        <T size={12} color={theme.text2}>{label}</T>
        <T size={14.5} weight="500">{value}</T>
      </View>
    </View>
  );
}

function Reviews({ refKey, rating }) {
  const theme = useTheme();
  const store = useStore();
  const [writing, setWriting] = useState(false);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  return (
    <View style={{ marginTop: 22 }}>
      <T size={17} weight="700" style={{ marginBottom: 6 }}>{t("Recensioni")}</T>
      <RatingSummary avg={rating.avg} count={rating.count} />
      {writing ? (
        <View style={[styles.form, { backgroundColor: theme.fill }]}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} hitSlop={4} onPress={() => { tap(); setStars(value); }}><Star size={30} weight={value <= stars ? "fill" : "regular"} color={value <= stars ? theme.star : theme.text3} /></Pressable>
            ))}
          </View>
          <TextInput value={text} onChangeText={setText} placeholder={t("Cosa ti è piaciuto?")} placeholderTextColor={theme.text2} multiline maxLength={300} style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]} />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Btn title={t("Annulla")} onPress={() => setWriting(false)} />
            <Btn title={t("Pubblica")} kind="primary" disabled={!text.trim()} onPress={() => { store.addReview(refKey, { stars, text: text.trim() }); setText(""); setWriting(false); }} />
          </View>
        </View>
      ) : (
        <Btn title={t("Scrivi una recensione")} onPress={() => setWriting(true)} style={{ marginVertical: 8 }} />
      )}
      {(all ? rating.list : rating.list.slice(0, 3)).map((review) => (
        <View key={review.id} style={[styles.review, { borderTopColor: theme.line }]}>
          <Avatar src={review.src} size={32} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T size={13.5} weight="600">{review.name}</T>
              <Stars value={review.stars} size={11} />
            </View>
            <T size={14} style={{ lineHeight: 19 }}>{review.text}</T>
            <T size={12} color={theme.text2}>{ago(review.at)}</T>
          </View>
        </View>
      ))}
      {rating.list.length > 3 && !all ? <Pressable onPress={() => setAll(true)} style={{ paddingVertical: 8 }}><T size={14} weight="600" color={theme.text2}>{t("Mostra tutte ({n})", { n: rating.list.length })}</T></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, paddingTop: 10 },
  secure: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  qtyBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  spec: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  foot: { flexDirection: "row", gap: 8, paddingHorizontal: INSET, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  form: { gap: 10, padding: 12, borderRadius: 12, marginVertical: 8 },
  input: { minHeight: 70, borderRadius: 8, padding: 10, fontSize: 15, textAlignVertical: "top" },
  review: { flexDirection: "row", gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
