import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { euro } from "../../data";
import { payApi, payBase } from "../../lib/pay";
import { Box } from "../../ui/icons-profile";
import { Btn, Header, T } from "../../ui/kit";
import { IgEmpty, SlideTabs } from "../../ui/profile-kit";

const LABEL = { paid: "Pagato", shipped: "Spedito", pending: "In attesa" };

// Ordini: purchases and sales paid with Stripe, from the Space hub (web OrdersScreen).
// Order requests sent in Direct stay in the chats; without the hub this list says it is not reachable.
export default function Orders() {
  const theme = useTheme();
  const store = useStore();
  const handle = store.auth?.handle || null;
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const key = tab === 0 ? "bought" : "sold";

  const load = useCallback(() => {
    setError(false);
    if (!handle) {
      setData({ bought: [], sold: [] });
      return;
    }
    payApi(`/orders?handle=${encodeURIComponent(handle)}`).then(setData).catch(() => setError(true));
  }, [handle]);
  useEffect(load, [load]);

  const list = data?.[key] || [];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Ordini" />
      <SlideTabs tabs={[{ key: "bought", label: "Acquisti" }, { key: "sold", label: "Vendite" }]} active={tab} onChange={setTab} height={44} />
      <FlashList
        key={key}
        data={list}
        keyExtractor={(order) => String(order.id)}
        ListHeaderComponent={(
          <>
            {!data && !error ? <T size={14} color={theme.text2} style={styles.info}>Caricamento…</T> : null}
            {error ? (
              <View style={{ alignItems: "center" }}>
                <T size={14} color={theme.text2} style={styles.info}>{payBase() ? "Gli ordini ora non sono raggiungibili." : "Gli ordini pagati con Stripe arrivano quando l'app si collega al server live di Space."}</T>
                <Btn title="Apri i Messaggi" onPress={() => router.replace("/messages")} />
              </View>
            ) : null}
            {data && !list.length ? <IgEmpty icon={Box} title={tab === 0 ? "Ancora nessun acquisto" : "Ancora nessuna vendita"} text="Qui compaiono gli ordini pagati con Stripe." /> : null}
          </>
        )}
        renderItem={({ item: order }) => (
          <View style={[styles.row, { borderBottomColor: theme.line }]}>
            {order.image ? <Image source={{ uri: order.image }} style={styles.pic} contentFit="cover" /> : <View style={[styles.pic, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }]}><Box size={26} weight="fill" color={theme.text3} /></View>}
            <View style={{ flex: 1, gap: 2 }}>
              <T size={14.5} weight="600">{order.qty > 1 ? `${order.qty} × ` : ""}{order.name}{order.variant ? ` · ${order.variant}` : ""}</T>
              <T size={13} color={theme.text2}>{tab === 0 ? `@${order.seller}` : `@${order.buyer}`} · {new Date(order.paidAt || order.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</T>
              {tab === 1 && order.shipping?.address ? <T size={13}>{order.shipping.name} · {order.shipping.address.line1}, {order.shipping.address.city}</T> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <T size={14.5} weight="700">{euro(order.total)}</T>
              <T size={12} weight="600" color={order.status === "paid" ? "#1cd14f" : order.status === "shipped" ? theme.blue : theme.text2}>{LABEL[order.status] || order.status}</T>
              {tab === 1 && order.status === "paid" ? (
                <Pressable onPress={() => payApi("/orders/ship", { handle, orderId: order.id }).then(load).catch(() => {})} style={[styles.ship, { backgroundColor: theme.btn }]}>
                  <T size={13} weight="600">Segna spedito</T>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  info: { textAlign: "center", marginVertical: 18, marginHorizontal: INSET },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  pic: { width: 56, height: 56, borderRadius: 6 },
  ship: { height: 30, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
