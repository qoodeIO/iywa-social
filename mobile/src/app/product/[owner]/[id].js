import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../../theme";
import { useStore } from "../../../lib/store";
import { useMe } from "../../../lib/session";
import { addReview, useProduct } from "../../../lib/social";
import { errorText } from "../../../lib/api";
import { t } from "../../../lib/i18n";
import { ago, euro, stockLabel } from "../../../data";
import { checkoutErrorText, checkoutResultText, startCheckout } from "../../../lib/pay";
import { useMarketShops, useSellerShop } from "../../../lib/liveShops";
import { useLive } from "../../../live/LiveStore";
import { showToast } from "../../../ui/feedEcho";
import { Bag, Bookmark, Box, ChatText, Check, Heart, Lock, Send, Star } from "../../../ui/icons";
import { Btn, Chip, Empty, Header, Rating, Section, Stars, T, tap } from "../../../ui/kit";
import { CartButton, MarketCard, ProductImage, RatingSummary, SellerCard, ShopAvatar, TrustRows, cleanHandle, marketRef, reviewStats, shopRefs } from "../../../ui/market";

const W = Dimensions.get("window").width;
const TONES = { ok: "#1cb14a", low: "#e08600", order: "#5e5ce6", out: "#8e8e93" };

export default function ProductScreen() {
  const theme = useTheme();
  const store = useStore();
  const me = useMe();
  const live = useLive();
  const { owner: rawOwner, id: rawId } = useLocalSearchParams();
  const owner = cleanHandle(rawOwner);
  const id = String(rawId || "");
  const query = useProduct(owner, id);
  const shopQuery = useSellerShop(owner);
  const { shops } = useMarketShops();
  const product = query.data?.product || null;
  const seller = query.data?.seller || shopQuery.data?.seller || null;
  const business = shopQuery.data?.business || null;
  const payments = Boolean(query.data?.payments);
  const reviews = query.data?.reviews || [];
  const mine = Boolean(owner) && owner === me?.handle;
  const shopTitle = business?.title || seller?.name || (owner ? `@${owner}` : "");
  const ref = useMemo(() => (product ? marketRef(product, owner, { shop: { title: shopTitle, city: business?.city }, payments }) : null), [product, owner, shopTitle, business?.city, payments]);
  const [slide, setSlide] = useState(0);
  const [variant, setVariant] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    if (product?.variants?.length && !variant) setVariant(product.variants[0]);
  }, [product?.variants, variant]);

  useEffect(() => {
    if (ref && !mine) store.viewProduct(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.key, mine]);

  const more = useMemo(() => (shopQuery.data?.products || []).filter((item) => item.id !== id).slice(0, 12)
    .map((item) => marketRef(item, owner, { shop: { title: shopTitle, city: business?.city }, payments: shopQuery.data?.payments })), [shopQuery.data, id, owner, shopTitle, business?.city]);
  // Other shops' products, the same category first.
  const similar = useMemo(() => {
    if (!product || mine) return [];
    const same = (shop) => Boolean(business?.category) && shop.category === business.category;
    return [...shops].filter((shop) => shop.owner !== owner).sort((a, b) => same(b) - same(a))
      .flatMap((shop) => shopRefs(shop).slice(0, 3))
      .slice(0, 8);
  }, [shops, product, mine, owner, business?.category]);

  async function pull() {
    setPulling(true);
    await Promise.all([query.refresh(), shopQuery.refresh()]);
    setPulling(false);
  }

  if (!product) {
    const missing = query.error?.status === 404;
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Prodotto")} />
        {query.loading ? <ActivityIndicator color={theme.text2} style={{ marginTop: 60 }} /> : (
          <Empty icon={Bag} title={missing ? t("Prodotto non trovato") : t("Prodotto non raggiungibile")} text={missing ? t("Forse la bottega l'ha tolto dalla vendita.") : t("Controlla la connessione e riprova.")}>
            {missing ? null : <Btn title={t("Riprova")} onPress={query.refresh} style={{ marginTop: 8 }} />}
          </Empty>
        )}
      </View>
    );
  }

  const images = product.images || [];
  const stock = stockLabel(product);
  const soldOut = stock.tone === "out";
  const wished = store.wishlist.some((item) => item.key === ref.key);
  const stats = reviewStats(reviews);
  const maxQty = product.stock != null && product.stock > 0 && !product.madeToOrder ? Math.min(20, product.stock) : 20;

  function add() {
    store.addToCart(ref, qty, variant);
    tap("medium");
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  // "Acquista ora": Stripe Checkout (test mode on the server) for sellers with payments on.
  async function buy() {
    if (buying) return;
    if (!me) { showToast({ text: t("Accedi per acquistare") }); return; }
    setBuying(true);
    try {
      const result = await startCheckout({ seller: owner, productId: product.id, qty, variant });
      showToast({ text: checkoutResultText(result.status), src: result.order?.image || images[0] || undefined });
      if (result.status !== "cancelled") {
        query.refresh();
        router.push("/shop/orders");
      }
    } catch (error) {
      showToast({ text: checkoutErrorText(error.code) });
    }
    setBuying(false);
  }

  // A question to the seller in Direct, through the live hub.
  function ask() {
    if (!live) { showToast({ text: t("Chat live non raggiungibile. Riprova.") }); return; }
    const what = `${qty > 1 ? `${qty} × ` : ""}${product.name}${variant ? ` (${variant})` : ""}`;
    live.openDm(owner)
      .then((chatId) => {
        live.send(chatId, t("Ciao! Mi interessa: {what} · {price}. È disponibile?", { what, price: euro(product.price * qty) }));
        router.push(`/chat/${chatId}`);
      })
      .catch(() => showToast({ text: t("Chat live non raggiungibile. Riprova.") }));
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header
        title={mine ? t("Il tuo shop") : shopTitle}
        subtitle={t("Shop")}
        right={(
          <>
            {!mine ? (
              <Pressable hitSlop={8} accessibilityLabel={wished ? t("Rimuovi dai preferiti") : t("Aggiungi ai preferiti")} style={{ padding: 6 }} onPress={() => { tap(); store.toggleWish(ref); }}>
                <Heart size={26} weight={wished ? "fill" : "regular"} color={wished ? theme.red : theme.text} />
              </Pressable>
            ) : null}
            <CartButton />
          </>
        )}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={theme.text2} />}>
        <View>
          {images.length ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `${index}-${item}`}
              onMomentumScrollEnd={(event) => setSlide(Math.round(event.nativeEvent.contentOffset.x / W))}
              renderItem={({ item }) => <ProductImage uri={item} style={{ width: W, height: W }} />}
            />
          ) : <ProductImage style={{ width: W, height: W * 0.6 }} />}
          {images.length > 1 ? (
            <View style={styles.dots}>{images.map((_, index) => <View key={index} style={[styles.dot, { backgroundColor: index === slide ? theme.blue : theme.text3 }]} />)}</View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: INSET, paddingTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: TONES[stock.tone] }} />
            <T size={13} weight="600" color={TONES[stock.tone]}>{stock.text}</T>
          </View>
          {payments ? (
            <View style={styles.secure}>
              <Lock size={13} weight="fill" color={theme.green} />
              <T size={12.5} weight="600" color={theme.green}>{t("Pagamento sicuro con Stripe")}</T>
            </View>
          ) : null}
          <T size={22} weight="700" style={{ marginTop: 6, letterSpacing: -0.5 }}>{product.name}</T>
          {stats.count ? <View style={{ marginTop: 4 }}><Rating avg={stats.avg} count={stats.count} size={13} /></View> : null}
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
                <Pressable disabled={qty >= maxQty} onPress={() => { tap(); setQty((v) => Math.min(maxQty, v + 1)); }} style={[styles.qtyBtn, { backgroundColor: theme.btn, opacity: qty >= maxQty ? 0.4 : 1 }]}><T size={18} weight="600">+</T></Pressable>
              </View>
            </View>
          ) : null}

          {!mine ? <TrustRows product={product} payments={payments} /> : null}

          {product.description ? <T size={15} style={{ marginTop: 16, lineHeight: 21 }}>{product.description}</T> : null}
          <View style={{ marginTop: 10 }}>
            {product.category ? <Spec icon={Bag} label={t("Categoria")} value={product.category} /> : null}
            {product.materials ? <Spec icon={Box} label={t("Materiali")} value={product.materials} /> : null}
            {product.size ? <Spec icon={Bookmark} label={product.service ? t("Dettagli") : t("Misure")} value={product.size} /> : null}
          </View>

          {seller && !mine ? <SellerCard seller={seller} business={business} payments={payments} /> : null}

          <Reviews owner={owner} id={product.id} reviews={reviews} stats={stats} canWrite={Boolean(me) && !mine} mineHandle={me?.handle} />
        </View>

        {more.length ? (
          <Section title={mine ? t("Altri tuoi prodotti") : t("Altro da questa bottega")}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: INSET }}>
              {more.map((item) => <MarketCard key={item.key} refValue={item} width={142} showShop={false} />)}
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

      {!mine && !payments && !soldOut ? (
        <View style={[styles.notice, { backgroundColor: theme.fill }]}>
          <ChatText size={16} weight="fill" color={theme.text2} />
          <T size={12.5} color={theme.text2} style={{ flex: 1 }}>{t("Questa bottega non accetta ancora pagamenti")} · {t("scrivile per ordinare")}</T>
        </View>
      ) : null}
      <View style={[styles.foot, { borderTopColor: theme.line, backgroundColor: theme.bg }]}>
        {mine ? (
          <Btn title={t("Modifica prodotto")} height={44} flex={1} onPress={() => router.push(`/product-edit/${encodeURIComponent(product.id)}`)} />
        ) : payments ? (
          <>
            <Btn icon={Send} height={44} onPress={ask} style={{ paddingHorizontal: 14 }} />
            <Btn title={added ? t("Aggiunto") : t("Al carrello")} icon={added ? Check : Bag} kind={added ? "done" : "gray"} height={44} size={14.5} flex={1} disabled={soldOut} onPress={add} />
            <Btn
              title={soldOut ? t("Esaurito") : buying ? t("Apertura…") : t("Acquista ora")}
              icon={!soldOut && !buying ? Lock : undefined}
              kind="primary"
              height={44}
              size={14.5}
              flex={1}
              disabled={soldOut || buying}
              onPress={buy}
            />
          </>
        ) : (
          <>
            <Btn title={added ? t("Aggiunto") : t("Al carrello")} icon={added ? Check : Bag} kind={added ? "done" : "gray"} height={44} size={14.5} flex={1} disabled={soldOut} onPress={add} />
            <Btn title={t("Scrivi alla bottega")} icon={Send} kind="primary" height={44} size={14.5} flex={1} onPress={ask} />
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

function Reviews({ owner, id, reviews, stats, canWrite, mineHandle }) {
  const theme = useTheme();
  const own = reviews.find((review) => review.handle === mineHandle);
  const [writing, setWriting] = useState(false);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [all, setAll] = useState(false);

  function open() {
    setStars(own?.stars || 5);
    setText(own?.text || "");
    setWriting(true);
  }

  async function publish() {
    if (sending) return;
    setSending(true);
    try {
      await addReview(owner, id, stars, text.trim());
      tap("medium");
      setWriting(false);
      showToast({ text: t("Recensione pubblicata") });
    } catch (error) {
      showToast({ text: errorText(error, t) });
    }
    setSending(false);
  }

  return (
    <View style={{ marginTop: 22 }}>
      <T size={17} weight="700" style={{ marginBottom: 6 }}>{t("Recensioni")}</T>
      {stats.count ? <RatingSummary stats={stats} /> : <T size={14} color={theme.text2} style={{ paddingVertical: 6 }}>{canWrite ? t("Ancora nessuna recensione. Hai provato questo prodotto? Racconta com'è.") : t("Ancora nessuna recensione.")}</T>}
      {canWrite ? (
        writing ? (
          <View style={[styles.form, { backgroundColor: theme.fill }]}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} hitSlop={4} accessibilityLabel={t("{n} stelle", { n: value })} onPress={() => { tap(); setStars(value); }}><Star size={30} weight={value <= stars ? "fill" : "regular"} color={value <= stars ? theme.star : theme.text3} /></Pressable>
              ))}
            </View>
            <TextInput value={text} onChangeText={setText} placeholder={t("Cosa ti è piaciuto?")} placeholderTextColor={theme.text2} multiline maxLength={600} style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Btn title={t("Annulla")} onPress={() => setWriting(false)} />
              <Btn title={sending ? t("Invio…") : t("Pubblica")} kind="primary" disabled={!text.trim() || sending} onPress={publish} />
            </View>
          </View>
        ) : (
          <Btn title={own ? t("Modifica la tua recensione") : t("Scrivi una recensione")} onPress={open} style={{ marginVertical: 8 }} />
        )
      ) : null}
      {(all ? reviews : reviews.slice(0, 3)).map((review) => (
        <Pressable key={review.handle} onPress={() => router.push(`/person/${review.handle}`)} style={[styles.review, { borderTopColor: theme.line }]}>
          <ShopAvatar src={review.avatar} name={review.name || review.handle} size={32} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T size={13.5} weight="600">{review.name || `@${review.handle}`}</T>
              <Stars value={review.stars} size={11} />
            </View>
            {review.text ? <T size={14} style={{ lineHeight: 19 }}>{review.text}</T> : null}
            <T size={12} color={theme.text2}>{ago(review.at)}</T>
          </View>
        </Pressable>
      ))}
      {reviews.length > 3 && !all ? <Pressable onPress={() => setAll(true)} style={{ paddingVertical: 8 }}><T size={14} weight="600" color={theme.text2}>{t("Mostra tutte ({n})", { n: reviews.length })}</T></Pressable> : null}
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
  notice: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: INSET, paddingVertical: 8 },
  foot: { flexDirection: "row", gap: 8, paddingHorizontal: INSET, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  form: { gap: 10, padding: 12, borderRadius: 12, marginVertical: 8 },
  input: { minHeight: 70, borderRadius: 8, padding: 10, fontSize: 15, textAlignVertical: "top" },
  review: { flexDirection: "row", gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
