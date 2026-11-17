import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useMe } from "../../lib/session";
import { useOrders } from "../../lib/social";
import { localeTag, t, tk } from "../../lib/i18n";
import { euro } from "../../data";
import { onOrderEvent, payApi } from "../../lib/pay";
import { Box } from "../../ui/icons-profile";
import { Btn, Header, T } from "../../ui/kit";
import { IgEmpty, SlideTabs } from "../../ui/profile-kit";
import { showToast } from "../../ui/feedEcho";

const LABEL = { paid: tk("Pagato"), shipped: tk("Spedito"), pending: tk("In attesa") };

// Ordini: purchases and sales paid with Stripe. Order requests sent in Direct stay in the chats.
export default function Orders() {
  const theme = useTheme();
  const me = useMe();
  const { data, loading, error, refresh } = useOrders();
  const [tab, setTab] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [shipping, setShipping] = useState(null);
  const key = tab === 0 ? "bought" : "sold";

  // A sale, a payment or a shipment arriving live from the hub refreshes the list.
  useEffect(() => onOrderEvent(() => refresh()), [refresh]);

  async function pull() {
    setPulling(true);
    await refresh();
    setPulling(false);
  }

  async function ship(order) {
    setShipping(order.id);
    try {
      await payApi("/orders/ship", { orderId: order.id });
      await refresh();
    } catch {
      showToast({ text: t("Non riuscito. Riprova.") });
    }
    setShipping(null);
  }

  const list = data?.[key] || [];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Ordini")} />
      <SlideTabs tabs={[{ key: "bought", label: t("Acquisti") }, { key: "sold", label: t("Vendite") }]} active={tab} onChange={setTab} height={44} />
      <FlashList
        key={key}
        data={list}
        keyExtractor={(order) => String(order.id)}
        refreshing={pulling}
        onRefresh={pull}
        ListEmptyComponent={(
          !me ? (
            <IgEmpty icon={Box} title={t("Accedi per vedere i tuoi ordini")} text="" />
          ) : loading && !data ? (
            <ActivityIndicator color={theme.text2} style={{ marginTop: 40 }} />
          ) : error && !data ? (
            <View style={{ alignItems: "center", gap: 10 }}>
              <T size={14} color={theme.text2} style={styles.info}>{t("Gli ordini ora non sono raggiungibili.")}</T>
              <Btn title={t("Riprova")} onPress={refresh} />
            </View>
          ) : (
            <IgEmpty icon={Box} title={tab === 0 ? t("Ancora nessun acquisto") : t("Ancora nessuna vendita")} text={tab === 0 ? t("Qui compaiono gli ordini pagati con Stripe.") : t("Qui compaiono le vendite pagate con Stripe.")}>
              {tab === 0 ? <Btn title={t("Vai allo Shop")} kind="primary" onPress={() => router.replace("/shop")} style={{ marginTop: 10 }} /> : null}
            </IgEmpty>
          )
        )}
        renderItem={({ item: order }) => {
          const other = tab === 0 ? order.seller : order.buyer;
          return (
            <Pressable onPress={() => router.push(`/product/${encodeURIComponent(order.seller)}/${encodeURIComponent(order.productId || "")}`)} disabled={!order.productId} style={[styles.row, { borderBottomColor: theme.line }]}>
              {order.image ? <Image source={{ uri: order.image }} style={styles.pic} contentFit="cover" /> : <View style={[styles.pic, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }]}><Box size={26} weight="fill" color={theme.text3} /></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <T size={14.5} weight="600">{order.qty > 1 ? `${order.qty} × ` : ""}{order.name}{order.variant ? ` · ${order.variant}` : ""}</T>
                <T size={13} color={theme.text2}>
                  <T size={13} weight="600" color={theme.text2} onPress={() => router.push(`/person/${other}`)}>@{other}</T>
                  {" · "}{new Date(order.paidAt || order.createdAt).toLocaleDateString(localeTag(), { day: "numeric", month: "short" })}
                </T>
                {tab === 1 && order.shipping?.address ? <T size={13}>{order.shipping.name} · {order.shipping.address.line1}, {order.shipping.address.city}</T> : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <T size={14.5} weight="700">{euro(order.total)}</T>
                <T size={12} weight="600" color={order.status === "paid" ? "#1cd14f" : order.status === "shipped" ? theme.blue : theme.text2}>{LABEL[order.status] ? t(LABEL[order.status]) : order.status}</T>
                {tab === 1 && order.status === "paid" ? (
                  <Pressable disabled={shipping === order.id} onPress={() => ship(order)} style={[styles.ship, { backgroundColor: theme.btn, opacity: shipping === order.id ? 0.5 : 1 }]}>
                    <T size={13} weight="600">{t("Segna spedito")}</T>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  info: { textAlign: "center", marginTop: 18, marginHorizontal: INSET },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: INSET, borderBottomWidth: StyleSheet.hairlineWidth },
  pic: { width: 56, height: 56, borderRadius: 6 },
  ship: { height: 30, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
