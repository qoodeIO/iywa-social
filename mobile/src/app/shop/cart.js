import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { FREE_SHIPPING, euro, shippingFor, storeOf } from "../../data";
import { Bag, Lock, Trash, Truck } from "../../ui/icons";
import { Avatar, Btn, Empty, Header, T, tap } from "../../ui/kit";
import { productHref } from "../../ui/market";
import { showToast } from "../../ui/feedEcho";
import { checkoutErrorText, checkoutResultText, payHandle, startCheckout } from "../../lib/pay";
import { useLiveShops } from "../../lib/liveShops";
import { useLive } from "../../live/LiveStore";

export default function Cart() {
  const theme = useTheme();
  const store = useStore();
  const live = useLive();
  useLiveShops();
  const [busy, setBusy] = useState(null);
  const groups = [];
  for (const item of store.cart) {
    let group = groups.find((entry) => entry.seller === item.seller);
    if (!group) groups.push((group = { seller: item.seller, owner: item.owner, items: [] }));
    group.items.push(item);
  }
  const count = store.cart.reduce((sum, item) => sum + item.qty, 0);

  // Sellers with Stripe: one Checkout for the whole group (web CartScreen onCheckout).
  async function checkout(group) {
    const buyer = payHandle(store);
    if (!buyer) { showToast({ text: t("Prima collegati al Direct") }); return; }
    setBusy(group.seller);
    try {
      const result = await startCheckout({
        buyer,
        seller: group.items[0].live.seller,
        items: group.items.map((item) => ({ productId: item.product.id, qty: item.qty, variant: item.variant })),
      });
      if (result.status !== "cancelled") store.clearCartFor(group.seller);
      showToast({ text: checkoutResultText(result.status), src: result.order?.image || group.items[0].product.images[0] || undefined });
      if (result.status !== "cancelled") router.push("/shop/orders");
    } catch (error) {
      showToast({ text: error.code === "stock" ? t("Un prodotto non ha abbastanza pezzi") : checkoutErrorText(error.code) });
    }
    setBusy(null);
  }

  function request(group) {
    const ship = shippingFor(group.items);
    const lines = group.items.map((item) => `• ${item.qty} × ${item.product.name}${item.variant ? ` (${item.variant})` : ""} · ${euro(item.product.price * item.qty)}`).join("\n");
    const text = t("Ciao! Vorrei ordinare:\n{lines}\nTotale {total}. Come posso pagare?", { lines, total: euro(ship.total) });
    const first = group.items[0];
    if (first.live) {
      // A live seller without Stripe: the request goes to their real Direct through the hub.
      setBusy(group.seller);
      live?.openDm(first.live.seller)
        .then((chatId) => {
          live.send(chatId, text);
          store.clearCartFor(group.seller);
          tap("medium");
          router.push(`/chat/${chatId}`);
        })
        .catch(() => showToast({ text: t("Chat live non raggiungibile. Riprova.") }))
        .finally(() => setBusy(null));
      return;
    }
    setBusy(group.seller);
    const shop = storeOf(group.owner);
    const id = store.ensureChat({ name: group.owner, src: shop?.src });
    store.sendMessage(id, { kind: "image", image: first.product.images[0], text });
    setTimeout(() => store.receiveMessage(id, t("Grazie per l'ordine! Ti mando subito i dati per il pagamento e i tempi di spedizione 🙂")), 3500);
    store.clearCartFor(group.seller);
    setBusy(null);
    tap("medium");
    router.push(`/chat/${id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Carrello")} subtitle={count ? (count === 1 ? t("1 articolo") : t("{n} articoli", { n: count })) : null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {!groups.length ? (
          <Empty icon={Bag} title={t("Il carrello è vuoto")} text={t("Aggiungi pezzi fatti a mano dalle botteghe.")}>
            <Btn title={t("Vai allo Shop")} kind="primary" onPress={() => router.replace("/shop")} style={{ marginTop: 10 }} />
          </Empty>
        ) : null}
        {groups.map((group) => {
          const shop = storeOf(group.owner);
          const ship = shippingFor(group.items);
          const first = group.items[0];
          const payable = Boolean(first.live?.payments);
          const title = shop?.title || first.live?.shop?.title || (first.live ? `@${first.live.seller}` : t("Shop"));
          const city = shop?.city || first.live?.shop?.city || "";
          return (
            <View key={group.seller} style={[styles.group, { borderBottomColor: theme.fill }]}>
              <Pressable style={styles.groupHead} onPress={() => shop && router.push(`/store/${encodeURIComponent(group.owner)}`)}>
                <Avatar src={shop?.src} size={32} />
                <View style={{ flex: 1 }}>
                  <T size={14.5} weight="700">{title}</T>
                  <T size={12.5} color={theme.text2}>{payable ? (city ? t("{city} · Pagamento con Stripe", { city }) : t("Pagamento con Stripe")) : t("{city} · Ordine tramite Direct", { city })}</T>
                </View>
              </Pressable>
              {group.items.map((item) => (
                <View key={`${item.key}-${item.variant}`} style={styles.line}>
                  <Pressable onPress={() => router.push(productHref(item))}>
                    <Image source={{ uri: item.product.images[0] }} style={[styles.pic, { backgroundColor: theme.fill }]} contentFit="cover" />
                  </Pressable>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={14} weight="500" lines={1}>{item.product.name}</T>
                    {item.variant ? <T size={12.5} color={theme.text2}>{item.variant}</T> : null}
                    <T size={14} weight="700">{euro(item.product.price * item.qty)}</T>
                  </View>
                  <View style={styles.qty}>
                    <Pressable onPress={() => { tap(); store.setCartQty(item.key, item.variant, item.qty - 1); }} style={[styles.qtyBtn, { backgroundColor: theme.btn }]}>
                      {item.qty === 1 ? <Trash size={15} color={theme.text} /> : <T size={17} weight="600">−</T>}
                    </Pressable>
                    <T size={14} weight="700" style={{ minWidth: 16, textAlign: "center" }}>{item.qty}</T>
                    <Pressable disabled={item.qty >= 20} onPress={() => { tap(); store.setCartQty(item.key, item.variant, item.qty + 1); }} style={[styles.qtyBtn, { backgroundColor: theme.btn }]}><T size={17} weight="600">+</T></Pressable>
                  </View>
                </View>
              ))}
              {ship.missing > 0 ? (
                <View style={{ paddingHorizontal: INSET, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Truck size={15} weight="fill" color={theme.text} />
                    <T size={12.5} color={theme.text2}>{t("Aggiungi {amount} per la spedizione gratuita", { amount: euro(ship.missing) })}</T>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.fill, overflow: "hidden" }}>
                    <View style={{ width: `${Math.min(100, (ship.goods / FREE_SHIPPING) * 100)}%`, height: "100%", backgroundColor: theme.blue }} />
                  </View>
                </View>
              ) : ship.physical ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: INSET }}>
                  <Truck size={15} weight="fill" color={theme.green} />
                  <T size={12.5} weight="600" color={theme.green}>{t("Spedizione gratuita")}</T>
                </View>
              ) : null}
              <View style={{ paddingHorizontal: INSET, marginTop: 12, gap: 4 }}>
                <Row label={t("Subtotale")} value={euro(ship.goods)} />
                {ship.physical ? <Row label={t("Spedizione")} value={ship.fee ? euro(ship.fee) : t("Gratis")} /> : null}
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line, marginVertical: 4 }} />
                <Row label={t("Totale")} value={euro(ship.total)} strong />
              </View>
              <Btn
                title={busy === group.seller ? t("Apertura…") : payable ? t("Paga {total}", { total: euro(ship.total) }) : t("Invia richiesta d'ordine")}
                icon={payable && busy !== group.seller ? Lock : undefined}
                kind="primary"
                height={46}
                size={15}
                disabled={Boolean(busy)}
                onPress={() => (payable ? checkout(group) : request(group))}
                style={{ marginHorizontal: INSET, marginTop: 12 }}
              />
            </View>
          );
        })}
        {groups.length ? <T size={13} color={theme.text2} style={{ paddingHorizontal: INSET, paddingTop: 14, lineHeight: 18 }}>{t("Le botteghe senza Stripe ricevono l'ordine nel Direct: pagamento e spedizione li concordate in chat.")}</T> : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, strong }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <T size={14} weight={strong ? "700" : "400"} color={strong ? theme.text : theme.text2}>{label}</T>
      <T size={14} weight="700">{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { paddingBottom: 16, borderBottomWidth: 6 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET, paddingTop: 14, paddingBottom: 4 },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: INSET, paddingVertical: 10 },
  pic: { width: 64, height: 64, borderRadius: 6 },
  qty: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
