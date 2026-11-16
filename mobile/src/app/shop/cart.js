import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { FREE_SHIPPING, euro, shippingFor, storeOf } from "../../data";
import { Bag, Trash, Truck } from "../../ui/icons";
import { Avatar, Btn, Empty, Header, T, tap } from "../../ui/kit";
import { productHref } from "../../ui/market";

export default function Cart() {
  const theme = useTheme();
  const store = useStore();
  const [busy, setBusy] = useState(null);
  const groups = [];
  for (const item of store.cart) {
    let group = groups.find((entry) => entry.seller === item.seller);
    if (!group) groups.push((group = { seller: item.seller, owner: item.owner, items: [] }));
    group.items.push(item);
  }
  const count = store.cart.reduce((sum, item) => sum + item.qty, 0);

  function request(group) {
    setBusy(group.seller);
    const shop = storeOf(group.owner);
    const id = store.ensureChat({ name: group.owner, src: shop?.src });
    const ship = shippingFor(group.items);
    const lines = group.items.map((item) => `• ${item.qty} × ${item.product.name}${item.variant ? ` (${item.variant})` : ""} · ${euro(item.product.price * item.qty)}`).join("\n");
    store.sendMessage(id, { kind: "image", image: group.items[0].product.images[0], text: `Ciao! Vorrei ordinare:\n${lines}\nTotale ${euro(ship.total)}. Come posso pagare?` });
    setTimeout(() => store.receiveMessage(id, "Grazie per l'ordine! Ti mando subito i dati per il pagamento e i tempi di spedizione 🙂"), 3500);
    store.clearCartFor(group.seller);
    setBusy(null);
    tap("medium");
    router.push(`/chat/${id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Carrello" subtitle={count ? `${count} ${count === 1 ? "articolo" : "articoli"}` : null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {!groups.length ? (
          <Empty icon={Bag} title="Il carrello è vuoto" text="Aggiungi pezzi fatti a mano dalle botteghe.">
            <Btn title="Vai allo Shop" kind="primary" onPress={() => router.replace("/shop")} style={{ marginTop: 10 }} />
          </Empty>
        ) : null}
        {groups.map((group) => {
          const shop = storeOf(group.owner);
          const ship = shippingFor(group.items);
          return (
            <View key={group.seller} style={[styles.group, { borderBottomColor: theme.fill }]}>
              <Pressable style={styles.groupHead} onPress={() => shop && router.push(`/store/${encodeURIComponent(group.owner)}`)}>
                <Avatar src={shop?.src} size={32} />
                <View style={{ flex: 1 }}>
                  <T size={14.5} weight="700">{shop?.title || "Shop"}</T>
                  <T size={12.5} color={theme.text2}>{shop?.city} · Ordine tramite Direct</T>
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
                    <T size={12.5} color={theme.text2}>Aggiungi {euro(ship.missing)} per la spedizione gratuita</T>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.fill, overflow: "hidden" }}>
                    <View style={{ width: `${Math.min(100, (ship.goods / FREE_SHIPPING) * 100)}%`, height: "100%", backgroundColor: theme.blue }} />
                  </View>
                </View>
              ) : ship.physical ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: INSET }}>
                  <Truck size={15} weight="fill" color={theme.green} />
                  <T size={12.5} weight="600" color={theme.green}>Spedizione gratuita</T>
                </View>
              ) : null}
              <View style={{ paddingHorizontal: INSET, marginTop: 12, gap: 4 }}>
                <Row label="Subtotale" value={euro(ship.goods)} />
                {ship.physical ? <Row label="Spedizione" value={ship.fee ? euro(ship.fee) : "Gratis"} /> : null}
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line, marginVertical: 4 }} />
                <Row label="Totale" value={euro(ship.total)} strong />
              </View>
              <Btn title="Invia richiesta d'ordine" kind="primary" height={46} size={15} disabled={busy === group.seller} onPress={() => request(group)} style={{ marginHorizontal: INSET, marginTop: 12 }} />
            </View>
          );
        })}
        {groups.length ? <T size={13} color={theme.text2} style={{ paddingHorizontal: INSET, paddingTop: 14, lineHeight: 18 }}>Le botteghe ricevono l'ordine nel Direct: pagamento e spedizione li concordate in chat.</T> : null}
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
