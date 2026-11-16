import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { NO_FILTERS, PRICE_BANDS, SHOP_TOPICS, SORTS, allStores, applyFilters, filterCount, sellerRating, shopTopicOf, sortRefs, storeRefs } from "../../data";
import { Box, ChevronDown, ChevronRight, Search, Sliders } from "../../ui/icons";
import { Btn, Chip, Empty, Hairline, Header, Section, Sheet, T, Toggle, tap } from "../../ui/kit";
import { CartButton, Grid, MarketCard, StoreCard, WishlistButton } from "../../ui/market";

export default function ShopHome() {
  const theme = useTheme();
  const store = useStore();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(null);

  const stores = useMemo(() => allStores(), []);
  const refs = useMemo(() => stores.flatMap((shop) => storeRefs(shop).map((ref) => ({ ...ref, topic: shopTopicOf(shop, ref.product), shop }))), [stores]);
  const needle = query.trim().toLowerCase();
  const active = filterCount(filters);
  const scoped = (list) => list.filter((item) => topic === "all" || item.topic === topic).filter((item) => !needle || `${item.product.name} ${item.product.category} ${item.shop.title} ${item.shop.city}`.toLowerCase().includes(needle));
  const results = sortRefs(scoped(applyFilters(refs, filters)), sort);
  const browsing = !needle && topic === "all" && !active;
  const loved = [...stores].sort((a, b) => {
    const x = sellerRating(a, store.reviews, store.profile);
    const y = sellerRating(b, store.reviews, store.profile);
    return y.top - x.top || y.avg * Math.log(y.count + 1) - x.avg * Math.log(x.count + 1);
  });
  const rails = browsing ? [
    [t("Visti di recente"), store.recentProducts.slice(0, 10)],
    [t("Novità"), [...refs].reverse().slice(0, 10)],
    [t("Regali sotto i 50 €"), refs.filter((item) => item.product.price < 50 && !item.product.service)],
    [t("Su ordinazione"), refs.filter((item) => item.product.madeToOrder)],
    [t("Corsi ed esperienze"), refs.filter((item) => item.product.service)],
  ].filter(([, list]) => list.length) : [];
  const quick = [["freeShip", t("Spedizione gratuita")], ["ready", t("Pronta consegna")], ["rating", t("4,8+ stelle")]];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Shop")} right={<><WishlistButton /><CartButton /></>} />
      <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 28 }} stickyHeaderIndices={[]}>
        <View style={{ paddingHorizontal: INSET, paddingBottom: 10 }}>
          <View style={[styles.search, { backgroundColor: theme.fill }]}>
            <Search size={18} color={theme.text2} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t("Cerca botteghe e prodotti")} placeholderTextColor={theme.text2} style={{ flex: 1, color: theme.text, fontSize: 16 }} returnKeyType="search" clearButtonMode="while-editing" />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET }}>
          {["all", ...SHOP_TOPICS].map((item) => <Chip key={item} title={item === "all" ? t("Per te") : t(item)} on={topic === item} onPress={() => setTopic(item)} />)}
        </ScrollView>

        {browsing ? (
          <>
            <Hairline style={{ marginTop: 12 }} />
            <Pressable style={styles.row} onPress={() => router.push("/shop/orders")}>
              <Box size={22} weight="fill" color={theme.text} />
              <T size={15} weight="500" style={{ flex: 1 }}>{t("I tuoi ordini")}</T>
              <ChevronRight size={16} weight="bold" color={theme.text3} />
            </Pressable>
            <Hairline />
            <Section title={t("Botteghe più amate")}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: INSET }} decelerationRate="fast" snapToInterval={246}>
                {loved.map((shop) => <StoreCard key={shop.key} shop={shop} />)}
              </ScrollView>
            </Section>
          </>
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
            {quick.map(([key, label]) => {
              const on = key === "rating" ? filters.rating === 4.8 : filters[key];
              return <Chip key={key} title={label} on={on} onPress={() => setFilters((prev) => (key === "rating" ? { ...prev, rating: prev.rating === 4.8 ? 0 : 4.8 } : { ...prev, [key]: !prev[key] }))} />;
            })}
            {PRICE_BANDS.slice(1).map(([id, , , label]) => <Chip key={id} title={t(label)} on={filters.price === id} onPress={() => setFilters((prev) => ({ ...prev, price: prev.price === id ? "all" : id }))} />)}
          </ScrollView>
          {results.length ? <Grid refs={results} /> : (
            <Empty icon={Search} title={t("Nessun prodotto trovato")} text={t("Prova a cambiare ricerca o filtri.")}>
              {active ? <Btn title={t("Azzera i filtri")} onPress={() => setFilters(NO_FILTERS)} style={{ marginTop: 8 }} /> : null}
            </Empty>
          )}
        </Section>
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
        <T size={14} weight="600" style={{ marginTop: 16, marginBottom: 8 }}>{t("Valutazione")}</T>
        <View style={styles.wrap}>{[[0, t("Tutte")], [4.5, t("4,5+ stelle")], [4.8, t("4,8+ stelle")]].map(([value, label]) => <Chip key={value} title={label} on={filters.rating === value} onPress={() => setFilters((prev) => ({ ...prev, rating: value }))} />)}</View>
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
  sort: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1 },
  sheetRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
});
