import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useMe } from "../../lib/session";
import { useProfile, toggleFollow } from "../../lib/social";
import { useSellerShop } from "../../lib/liveShops";
import { compact, euro, FREE_SHIPPING, SHIPPING_FEE } from "../../data";
import { t, tk } from "../../lib/i18n";
import { ChatText, Clock, Globe, MapPin, Phone, Plus, ShieldCheck, Store, Truck } from "../../ui/icons";
import { Mail } from "../../ui/icons-profile";
import { Btn, Chip, Empty, Header, Name, T, tap } from "../../ui/kit";
import { CartButton, Collage, Grid, SORTS, ShopAvatar, cleanHandle, marketRef, sortRefs } from "../../ui/market";
import { useLive } from "../../live/LiveStore";
import { showToast } from "../../ui/feedEcho";

const DAYS = [tk("Dom"), tk("Lun"), tk("Mar"), tk("Mer"), tk("Gio"), tk("Ven"), tk("Sab")];

export default function StoreScreen() {
  const theme = useTheme();
  const me = useMe();
  const live = useLive();
  const { owner: rawOwner } = useLocalSearchParams();
  const handle = cleanHandle(rawOwner);
  const mine = Boolean(handle) && handle === me?.handle;
  const shopQuery = useSellerShop(handle);
  const profileQuery = useProfile(handle);
  const data = shopQuery.data;
  const profile = profileQuery.data;
  const [tab, setTab] = useState("products");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [pulling, setPulling] = useState(false);
  const [following, setFollowing] = useState(null);

  const business = data?.business || null;
  const seller = data?.seller || profile || null;
  const title = business?.title || seller?.name || (handle ? `@${handle}` : t("Bottega"));
  const products = data?.products || [];
  const refs = useMemo(() => products.map((product) => marketRef(product, handle, { shop: { title, city: business?.city }, payments: data?.payments })), [products, handle, title, business?.city, data?.payments]);
  const cats = [...new Set(products.map((product) => product.category).filter(Boolean))];
  const shown = sortRefs(refs.filter((ref) => cat === "all" || ref.product.category === cat), sort);

  async function pull() {
    setPulling(true);
    await Promise.all([shopQuery.refresh(), profileQuery.refresh()]);
    setPulling(false);
  }

  if (!data && shopQuery.loading) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }}><Header title={t("Bottega")} /><ActivityIndicator color={theme.text2} style={{ marginTop: 60 }} /></View>;
  }
  if (!data) {
    const missing = shopQuery.error?.status === 404;
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Bottega")} />
        <Empty icon={Store} title={missing ? t("Bottega non trovata") : t("Bottega non raggiungibile")} text={missing ? t("Questo account non esiste più.") : t("Controlla la connessione e riprova.")}>
          {missing ? null : <Btn title={t("Riprova")} onPress={shopQuery.refresh} style={{ marginTop: 8 }} />}
        </Empty>
      </View>
    );
  }

  const isFollowing = following ?? Boolean(profile?.isFollowing);
  const requested = !isFollowing && Boolean(profile?.requested) && following == null;

  function follow() {
    if (!profile) return;
    tap();
    const next = !(isFollowing || requested);
    setFollowing(next);
    toggleFollow(profile)
      .then(() => { setFollowing(null); profileQuery.refresh(); })
      .catch(() => { setFollowing(null); showToast({ text: t("Non riuscito. Riprova.") }); });
  }

  function message() {
    if (!live) { showToast({ text: t("Chat live non raggiungibile. Riprova.") }); return; }
    live.openDm(handle)
      .then((chatId) => router.push(`/chat/${chatId}`))
      .catch(() => showToast({ text: t("Chat live non raggiungibile. Riprova.") }));
  }

  const meta = [business?.category ? t(business.category) : "", business?.city].filter(Boolean).join(" · ");
  const hours = business?.hours?.days?.length ? `${[...business.hours.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => t(DAYS[d])).join(", ")} · ${business.hours.open}–${business.hours.close}` : "";

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={title} subtitle={t("Bottega")} right={<CartButton />} />
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={theme.text2} />}
      >
        <View>
          {products.some((product) => product.images?.[0]) ? <Collage images={products.map((product) => product.images?.[0])} height={150} /> : <View style={{ height: 90, backgroundColor: theme.fill }} />}
          <View style={{ alignItems: "center", paddingHorizontal: INSET }}>
            <View style={{ marginTop: -42, padding: 3, borderRadius: 46, backgroundColor: theme.bg }}><ShopAvatar src={seller?.avatar} name={title} size={84} /></View>
            <Name size={21} weight="800" verified={seller?.verified} style={{ marginTop: 8 }}>{title}</Name>
            <T size={13.5} color={theme.text2} style={{ marginTop: 2 }}>{meta ? `@${handle} · ${meta}` : `@${handle}`}</T>
            <View style={{ flexDirection: "row", gap: 28, marginVertical: 14 }}>
              <Stat value={products.length} label={products.length === 1 ? t("prodotto") : t("prodotti")} />
              {profile ? <Stat value={compact(profile.followers || 0)} label={t("follower")} /> : null}
            </View>
            {data.payments ? (
              <View style={[styles.badge, { backgroundColor: theme.fill }]}>
                <ShieldCheck size={14} weight="fill" color={theme.green} />
                <T size={12.5} weight="600">{t("Pagamento sicuro con Stripe")}</T>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 6, alignSelf: "stretch", marginTop: 14 }}>
              {mine ? (
                <>
                  <Btn title={t("Aggiungi prodotto")} icon={Plus} kind="primary" flex={1} onPress={() => router.push("/product-edit/new")} />
                  <Btn title={t("Modifica bottega")} flex={1} onPress={() => router.push("/settings/account-type")} />
                </>
              ) : (
                <>
                  <Btn title={isFollowing ? t("Segui già") : requested ? t("Richiesto") : t("Segui")} kind={isFollowing || requested ? "gray" : "primary"} flex={1} disabled={!profile} onPress={follow} />
                  <Btn title={t("Messaggio")} flex={1} onPress={message} />
                  <Btn title={t("Profilo")} flex={1} onPress={() => router.push(`/person/${handle}`)} />
                </>
              )}
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: theme.bg }}>
          <View style={[styles.tabs, { borderBottomColor: theme.line }]}>
            {[["products", t("Prodotti")], ["about", t("Info")]].map(([id, label]) => (
              <Pressable key={id} style={styles.tab} onPress={() => { tap(); setTab(id); }}>
                <T size={14.5} weight="600" color={tab === id ? theme.text : theme.text2}>{label}</T>
                {tab === id ? <View style={[styles.tabBar, { backgroundColor: theme.text }]} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {tab === "products" ? (
          products.length ? (
            <View style={{ paddingTop: 12 }}>
              {cats.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET }}>
                  {["all", ...cats].map((item) => <Chip key={item} title={item === "all" ? t("Tutti") : item} on={cat === item} onPress={() => setCat(item)} />)}
                </ScrollView>
              ) : null}
              <View style={styles.listHead}>
                <T size={17} weight="700">{shown.length === 1 ? t("1 prodotto") : t("{n} prodotti", { n: shown.length })}</T>
                <Pressable onPress={() => { const index = SORTS.findIndex(([id]) => id === sort); setSort(SORTS[(index + 1) % SORTS.length][0]); tap(); }} style={[styles.sort, { borderColor: theme.line }]}>
                  <T size={13} weight="600">{t(SORTS.find(([id]) => id === sort)[1])}</T>
                </Pressable>
              </View>
              <Grid refs={shown} showShop={false} />
            </View>
          ) : mine ? (
            <Empty icon={Store} title={t("La tua bottega è vuota")} text={t("Aggiungi il primo prodotto: comparirà qui e nello Shop di iywa.")}>
              <Btn title={t("Aggiungi prodotto")} kind="primary" onPress={() => router.push("/product-edit/new")} style={{ marginTop: 10 }} />
            </Empty>
          ) : (
            <Empty icon={Store} title={t("Ancora nessun prodotto")} text={t("Questa bottega non ha ancora pubblicato prodotti.")} />
          )
        ) : null}

        {tab === "about" ? (
          <View style={{ paddingHorizontal: INSET, paddingTop: 16, gap: 12 }}>
            {profile?.bio ? <T size={15} style={{ lineHeight: 21 }}>{profile.bio}</T> : null}
            {business?.address || business?.city ? (
              <InfoRow icon={MapPin} text={[business.address, business.city].filter(Boolean).join(", ")} onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent([business.address, business.city].filter(Boolean).join(", "))}`)} />
            ) : null}
            {hours ? <InfoRow icon={Clock} text={hours} /> : null}
            {business?.phone ? <InfoRow icon={Phone} text={business.phone} onPress={() => Linking.openURL(`tel:${business.phone.replace(/\s/g, "")}`)} /> : null}
            {business?.email ? <InfoRow icon={Mail} text={business.email} onPress={() => Linking.openURL(`mailto:${business.email}`)} /> : null}
            {profile?.website ? <InfoRow icon={Globe} text={profile.website.replace(/^https?:\/\//, "")} onPress={() => Linking.openURL(/^https?:\/\//.test(profile.website) ? profile.website : `https://${profile.website}`)} /> : null}
            <T size={15} weight="700" style={{ marginTop: 8 }}>{t("Come si compra")}</T>
            <View style={{ borderRadius: 12, backgroundColor: theme.fill }}>
              {[
                [Truck, t("Spedizione"), t("{fee} per ordini sotto {free}, gratis sopra.", { fee: euro(SHIPPING_FEE), free: euro(FREE_SHIPPING) })],
                data.payments
                  ? [ShieldCheck, t("Pagamenti"), t("Paghi subito con Stripe: carta, Apple Pay o Google Pay.")]
                  : [ChatText, t("Pagamenti"), t("Ordini nel Direct e paghi dopo la conferma della bottega.")],
              ].map(([Icon, head, text], index) => (
                <View key={head} style={[styles.policy, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null]}>
                  <Icon size={20} weight="fill" color={theme.text} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={14} weight="600">{head}</T>
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

function InfoRow({ icon: Icon, text, onPress }) {
  const theme = useTheme();
  const body = (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <Icon size={16} weight="fill" color={theme.text} />
      <T size={14} weight="500" color={onPress ? theme.text : theme.text2} style={{ flex: 1 }}>{text}</T>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
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
  badge: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 8 },
  tabs: { flexDirection: "row", width: "100%", borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  tab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  tabBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5 },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, paddingTop: 14, paddingBottom: 10 },
  sort: { height: 30, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, justifyContent: "center" },
  policy: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
