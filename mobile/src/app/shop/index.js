import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { useMe } from "../../lib/session";
import { t } from "../../lib/i18n";
import { useMarketShops } from "../../lib/liveShops";
import { Box, ChevronDown, ChevronRight, Plus, Search, Sliders, Store } from "../../ui/icons";
import { Btn, Chip, Empty, Hairline, Header, Section, Sheet, T, Toggle, tap } from "../../ui/kit";
import { CartButton, Grid, MarketCard, NO_FILTERS, PRICE_BANDS, SORTS, StoreCard, WishlistButton, applyFilters, filterCount, shopRefs, sortRefs, storeHref } from "../../ui/market";

export default function ShopHome() {
  const theme = useTheme();
  const store = useStore();
  const me = useMe();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(null);
  const [pulling, setPulling] = useState(false);

  // Real shops on the server, mine left out (I see mine from "La tua bottega").
  const { shops, loading, error, refresh } = useMarketShops();
  const refs = useMemo(() => shops.flatMap((shop) => shopRefs(shop).map((ref) => ({ ...ref, topic: shop.category, search: `${ref.product.name} ${shop.title} ${shop.city} ${shop.category} @${shop.owner}`.toLowerCase() }))), [shops]);
  const topics = useMemo(() => [...new Set(shops.map((shop) => shop.category).filter(Boolean))], [shops]);
  const needle = query.trim().toLowerCase();
  const active = filterCount(filters);
  const scoped = refs.filter((item) => topic === "all" || item.topic === topic).filter((item) => !needle || item.search.includes(needle));
  const results = sortRefs(applyFilters(scoped, filters), sort);
  const browsing = !needle && topic === "all" && !active;
  const matchingShops = needle ? shops.filter((shop) => `${shop.title} ${shop.city} ${shop.category} @${shop.owner}`.toLowerCase().includes(needle)) : shops;
  const rails = browsing ? [
    [t("Visti di recente"), store.recentProducts.filter((item) => item.seller && item.seller !== me?.handle).slice(0, 10)],
    [t("Novità"), sortRefs(refs, "new").slice(0, 10)],
    [t("Regali sotto i 50 €"), refs.filter((item) => item.product.price < 50 && !item.product.service).slice(0, 12)],
    [t("Su ordinazione"), refs.filter((item) => item.product.madeToOrder).slice(0, 12)],
    [t("Corsi ed esperienze"), refs.filter((item) => item.product.service).slice(0, 12)],
  ].filter(([, list]) => list.length) : [];
  const quick = [["freeShip", t("Spedizione gratuita")], ["ready", t("Pronta consegna")]];
  const business = store.accountType === "business";
  const selling = business && store.business?.shop !== false;

  async function pull() {
    setPulling(true);
    await refresh();
    setPulling(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Shop")} right={<><WishlistButton /><CartButton /></>} />
      <ScrollView
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={theme.text2} />}
      >
        <View style={{ paddingHorizontal: INSET, paddingBottom: 10 }}>
          <View style={[styles.search, { backgroundColor: theme.fill }]}>
            <Search size={18} color={theme.text2} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t("Cerca botteghe e prodotti")} placeholderTextColor={theme.text2} style={{ flex: 1, color: theme.text, fontSize: 16 }} returnKeyType="search" clearButtonMode="while-editing" />
          </View>
        </View>
        {topics.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET }}>
            {["all", ...topics].map((item) => <Chip key={item} title={item === "all" ? t("Per te") : t(item)} on={topic === item} onPress={() => setTopic(item)} />)}
          </ScrollView>
        ) : null}

        {browsing ? (
          <>
            <Hairline style={{ marginTop: 12 }} />
            <Pressable style={styles.row} onPress={() => router.push("/shop/orders")}>
              <Box size={22} weight="fill" color={theme.text} />
              <T size={15} weight="500" style={{ flex: 1 }}>{t("I tuoi ordini")}</T>
              <ChevronRight size={16} weight="bold" color={theme.text3} />
            </Pressable>
            <Hairline />
            {selling && me?.handle ? (
              <>
                <Pressable style={styles.row} onPress={() => router.push(storeHref(me.handle))}>
                  <Store size={22} weight="fill" color={theme.text} />
                  <T size={15} weight="500" style={{ flex: 1 }}>{t("La tua bottega")}</T>
                  <Pressable hitSlop={8} onPress={() => { tap(); router.push("/product-edit/new"); }} style={[styles.add, { backgroundColor: theme.btn }]}>
                    <Plus size={14} weight="bold" color={theme.text} />
                    <T size={13} weight="600">{t("Prodotto")}</T>
                  </Pressable>
                  <ChevronRight size={16} weight="bold" color={theme.text3} />
                </Pressable>
                <Hairline />
              </>
            ) : null}
          </>
        ) : null}

        {loading && !shops.length ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator color={theme.text2} /></View>
        ) : error && !shops.length ? (
          <Empty icon={Store} title={t("Shop non raggiungibile")} text={t("Controlla la connessione e riprova.")}>
            <Btn title={t("Riprova")} onPress={refresh} style={{ marginTop: 8 }} />
          </Empty>
        ) : !shops.length ? (
          <Empty icon={Store} title={t("Ancora nessuna bottega")} text={t("Quando qualcuno apre la sua bottega su iywa, i suoi prodotti compaiono qui.")}>
            {selling ? (
              <Btn title={t("Aggiungi un prodotto")} kind="primary" onPress={() => router.push("/product-edit/new")} style={{ marginTop: 10 }} />
            ) : (
              <Btn title={business ? t("Attiva lo shop") : t("Apri la tua bottega")} kind="primary" onPress={() => router.push("/settings/account-type")} style={{ marginTop: 10 }} />
            )}
          </Empty>
        ) : (
          <>
            {matchingShops.length && (browsing || needle) ? (
              <Section title={t("Botteghe")}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: INSET }} decelerationRate="fast" snapToInterval={246}>
                  {matchingShops.map((shop) => <StoreCard key={shop.owner} shop={shop} />)}
                </ScrollView>
              </Section>
            ) : null}

            {rails.map(([title, list]) => (
              <Section key={title} title={title}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: INSET }} decelerationRate="fast" snapToInterval={152}>
                  {list.map((item) => <MarketCard key={`${title}-${item.key}`} refValue={item} width={142} />)}
                </ScrollView>
              </Section>
            ))}

            <Section
              title={browsing ? t("Tutti i prodotti") : results.length === 1 ? t("1 risultato") : t("{n} risultati", { n: results.length })}
              right={(
                <Pressable onPress={() => setSheet("sort")} style={[styles.sort, { borderColor: theme.line }]}>
                  <T size={13} weight="600">{t(SORTS.find(([id]) => id === sort)[1])}</T>
                  <ChevronDown size={12} weight="bold" color={theme.text2} />
                </Pressable>
              )}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET, paddingBottom: 14 }}>
                <Chip title={t("Filtri")} icon={Sliders} on={false} badge={active || null} onPress={() => setSheet("filters")} />
                {quick.map(([key, label]) => <Chip key={key} title={label} on={filters[key]} onPress={() => setFilters((prev) => ({ ...prev, [key]: !prev[key] }))} />)}
                {PRICE_BANDS.slice(1).map(([id, , , label]) => <Chip key={id} title={t(label)} on={filters.price === id} onPress={() => setFilters((prev) => ({ ...prev, price: prev.price === id ? "all" : id }))} />)}
              </ScrollView>
              {results.length ? <Grid refs={results} /> : (
                <Empty icon={Search} title={t("Nessun prodotto trovato")} text={t("Prova a cambiare ricerca o filtri.")}>
                  {active ? <Btn title={t("Azzera i filtri")} onPress={() => setFilters(NO_FILTERS)} style={{ marginTop: 8 }} /> : null}
                </Empty>
              )}
            </Section>
          </>
        )}
      </ScrollView>

      <Sheet open={sheet === "sort"} onClose={() => setSheet(null)} title={t("Ordina per")}>
        {SORTS.map(([id, label]) => (
          <Pressable key={id} style={styles.sheetRow} onPress={() => { tap(); setSort(id); setSheet(null); }}>
            <T size={16} weight={sort === id ? "700" : "400"} style={{ flex: 1 }}>{t(label)}</T>
            <View style={[styles.radio, { borderColor: sort === id ? theme.text : theme.text3 }]}>{sort === id ? <View style={[styles.radioDot, { backgroundColor: theme.text }]} /> : null}</View>
          </Pressable>
        ))}
      </Sheet>

      <Sheet open={sheet === "filters"} onClose={() => setSheet(null)}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <T size={17} weight="700">{t("Filtri")}</T>
          <Pressable onPress={() => setFilters(NO_FILTERS)}><T size={14} weight="600" color={theme.blue}>{t("Azzera")}</T></Pressable>
        </View>
        <T size={14} weight="600" style={{ marginTop: 10, marginBottom: 8 }}>{t("Prezzo")}</T>
        <View style={styles.wrap}>{PRICE_BANDS.map(([id, , , label]) => <Chip key={id} title={t(label)} on={filters.price === id} onPress={() => setFilters((prev) => ({ ...prev, price: id }))} />)}</View>
        <View style={{ marginTop: 14 }}>
          {[["freeShip", t("Spedizione gratuita")], ["ready", t("Pronta consegna")], ["noCourses", t("Nascondi corsi e servizi")]].map(([key, label]) => (
            <Pressable key={key} style={[styles.toggleRow, { borderTopColor: theme.line }]} onPress={() => { tap(); setFilters((prev) => ({ ...prev, [key]: !prev[key] })); }}>
              <T size={15} style={{ flex: 1 }}>{label}</T>
              <Toggle on={filters[key]} />
            </Pressable>
          ))}
        </View>
        <Btn kind="primary" height={46} size={15} title={results.length ? t("Mostra {n} prodotti", { n: results.length }) : t("Nessun prodotto")} onPress={() => setSheet(null)} style={{ marginTop: 16 }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 38, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: INSET, paddingVertical: 12 },
  add: { flexDirection: "row", alignItems: "center", gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 8 },
  sort: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1 },
  sheetRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
});
