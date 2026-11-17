import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { useMe } from "../../lib/session";
import { deleteProduct, saveProduct } from "../../lib/social";
import { useSellerShop } from "../../lib/liveShops";
import { errorText } from "../../lib/api";
import { t } from "../../lib/i18n";
import { Camera, ImageIcon, Plus, X } from "../../ui/icons-profile";
import { Store } from "../../ui/icons";
import { Btn, Empty, Header, T, Toggle, tap } from "../../ui/kit";
import { ActionSheet, settingsColors } from "../../ui/profile-kit";
import { showToast } from "../../ui/feedEcho";

// Add or edit a product in my shop. Each save goes straight to the server (PUT /products/:id);
// photos picked on the phone are uploaded by saveProduct.
export default function ProductEditorScreen() {
  const theme = useTheme();
  const store = useStore();
  const me = useMe();
  const { id } = useLocalSearchParams();
  const fresh = !id || id === "new";
  const shop = useSellerShop(fresh ? null : me?.handle);
  const selling = store.accountType === "business" && store.business?.shop !== false;

  if (!me || !selling) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Il tuo shop")} />
        <Empty icon={Store} title={t("Apri la tua bottega")} text={store.accountType === "business" ? t("Attiva «Mostra lo shop sul profilo» nelle impostazioni dell'account Azienda per pubblicare prodotti.") : t("Per vendere su iywa passa a un account Azienda e attiva lo shop.")}>
          <Btn title={t("Apri le impostazioni")} kind="primary" onPress={() => router.replace("/settings/account-type")} style={{ marginTop: 10 }} />
        </Empty>
      </View>
    );
  }
  if (fresh) return <ProductEditor product={null} />;
  if (!shop.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Modifica prodotto")} />
        {shop.loading ? <ActivityIndicator color={theme.text2} style={{ marginTop: 60 }} /> : (
          <Empty icon={Store} title={t("Shop non raggiungibile")} text={t("Controlla la connessione e riprova.")}>
            <Btn title={t("Riprova")} onPress={shop.refresh} style={{ marginTop: 8 }} />
          </Empty>
        )}
      </View>
    );
  }
  const product = shop.data.products.find((item) => item.id === String(id));
  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Modifica prodotto")} />
        <Empty icon={Store} title={t("Prodotto non trovato")} text={t("Forse l'hai già eliminato.")} />
      </View>
    );
  }
  return <ProductEditor key={product.id} product={product} />;
}

function ProductEditor({ product }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const st = settingsColors(theme);
  const fresh = !product;
  const [form, setForm] = useState(() => ({
    name: product?.name || "",
    price: product ? String(product.price).replace(".", ",") : "",
    category: product?.category || "",
    description: product?.description || "",
    materials: product?.materials || "",
    size: product?.size || "",
    images: product?.images || [],
    mode: product?.madeToOrder && !product?.stock ? "order" : "stock",
    stock: product?.stock != null ? String(product.stock) : "1",
    weeks: String(product?.madeToOrder || 3),
    variants: (product?.variants || []).join(", "),
    service: Boolean(product?.service),
  }));
  const [tray, setTray] = useState(fresh);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const price = Number(String(form.price).replace(",", "."));
  const valid = Boolean(form.name.trim() && price >= 0.5 && price <= 50000 && form.images.length);

  async function pick(camera) {
    try {
      const options = { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, mediaTypes: ["images"], quality: 0.8 };
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 6 - form.images.length });
      if (!result.canceled && result.assets?.length) {
        setForm((prev) => ({ ...prev, images: [...prev.images, ...result.assets.map((asset) => asset.uri)].slice(0, 6) }));
        setTray(false);
      }
    } catch {
      showToast({ text: t("Foto non disponibili") });
    }
  }

  async function save() {
    if (!valid || saving) return;
    tap("medium");
    setSaving(true);
    try {
      await saveProduct({
        ...(product || {}),
        id: product?.id || `p-${Date.now().toString(36)}`,
        name: form.name.trim(),
        price,
        category: form.category.trim(),
        description: form.description.trim(),
        materials: form.materials.trim(),
        size: form.size.trim(),
        images: form.images,
        service: form.service,
        stock: form.mode === "order" ? 0 : Math.max(0, Math.round(Number(form.stock) || 0)),
        madeToOrder: form.mode === "order" ? Math.max(1, Math.round(Number(form.weeks) || 1)) : null,
        variants: form.variants.split(",").map((item) => item.trim()).filter(Boolean),
      });
      showToast({ text: fresh ? t("Prodotto pubblicato") : t("Modifiche salvate") });
      router.back();
    } catch (error) {
      setSaving(false);
      showToast({ text: error.code === "price" ? t("Il prezzo deve essere tra 0,50 € e 50.000 €") : errorText(error, t) });
    }
  }

  async function remove() {
    setConfirm(false);
    setSaving(true);
    try {
      await deleteProduct(product.id);
      showToast({ text: t("Prodotto eliminato") });
      if (router.canGoBack()) router.back();
      if (me?.handle) router.replace(`/store/${encodeURIComponent(me.handle)}`);
    } catch (error) {
      setSaving(false);
      showToast({ text: errorText(error, t) });
    }
  }

  const row = (label, key, options = {}) => (
    <View style={styles.row}>
      {options.first ? null : <View style={[styles.sep, { backgroundColor: theme.line }]} />}
      <T size={15.5} style={{ width: 104 }}>{label}</T>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2 }}>
        {options.prefix ? <T size={15.5} color={theme.text2}>{options.prefix}</T> : null}
        <TextInput
          value={form[key]}
          maxLength={options.max}
          onChangeText={set(key)}
          placeholder={options.placeholder}
          placeholderTextColor={theme.text3}
          keyboardType={options.keyboard || "default"}
          accessibilityLabel={label}
          style={{ flex: 1, height: 48, color: theme.text, fontSize: 15.5 }}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: st.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.headRow, { marginTop: insets.top }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={{ width: 80 }}><T size={15.5}>{t("Annulla")}</T></Pressable>
        <T size={17} weight="700" style={{ flex: 1, textAlign: "center" }}>{fresh ? t("Nuovo prodotto") : t("Modifica prodotto")}</T>
        <Pressable hitSlop={8} disabled={!valid || saving} onPress={save} style={{ width: 80, alignItems: "flex-end" }}>
          {saving ? <ActivityIndicator color={theme.text2} /> : <T size={15.5} weight="700" color={theme.blue} style={{ opacity: valid ? 1 : 0.35 }}>{t("Salva")}</T>}
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}>
        <Cap>{t("Foto · {n}/6", { n: form.images.length })}</Cap>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET }}>
          {form.images.map((src, index) => (
            <Animated.View key={`${index}-${String(src).slice(-12)}`} entering={ZoomIn.duration(220)} style={[styles.photo, { backgroundColor: st.card }]}>
              <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {index === 0 ? <View style={styles.cover}><T size={10} weight="700" color="#fff">{t("Copertina")}</T></View> : null}
              <Pressable accessibilityLabel={t("Rimuovi")} hitSlop={6} onPress={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, at) => at !== index) }))} style={styles.photoX}>
                <X size={11} weight="bold" color="#fff" />
              </Pressable>
            </Animated.View>
          ))}
          {form.images.length < 6 ? (
            <Pressable onPress={() => { tap(); setTray((value) => !value); }} style={[styles.photo, styles.photoAdd, { borderColor: "rgba(0,149,246,0.55)" }]}>
              <Plus size={22} weight="bold" color={theme.blue} />
              <T size={12} weight="600" color={theme.blue}>{t("Aggiungi")}</T>
            </Pressable>
          ) : null}
        </ScrollView>
        {tray && form.images.length < 6 ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: INSET, paddingTop: 10 }}>
              <Pressable onPress={() => pick(false)} style={[styles.trayItem, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center", gap: 4 }]}>
                <ImageIcon size={22} color={theme.text} /><T size={11.5} weight="600">{t("Libreria")}</T>
              </Pressable>
              <Pressable onPress={() => pick(true)} style={[styles.trayItem, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center", gap: 4 }]}>
                <Camera size={22} color={theme.text} /><T size={11.5} weight="600">{t("Fotocamera")}</T>
              </Pressable>
            </ScrollView>
          </Animated.View>
        ) : null}

        <Cap>{t("Prodotto")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          {row(t("Nome"), "name", { first: true, max: 120, placeholder: t("es. Coppa rossa") })}
          {row(t("Prezzo"), "price", { prefix: "€", placeholder: "0", keyboard: "decimal-pad" })}
          {row(t("Categoria"), "category", { max: 30, placeholder: t("es. Tazze") })}
        </View>

        <Cap>{t("Disponibilità")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          <View style={[styles.seg, { backgroundColor: theme.fill }]}>
            {[["stock", t("Pronto")], ["order", t("Su ordinazione")]].map(([mode, label]) => {
              const on = form.mode === mode;
              return (
                <Pressable key={mode} onPress={() => { tap(); setForm((prev) => ({ ...prev, mode })); }} style={[styles.segBtn, on ? { backgroundColor: st.card, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } : null]}>
                  <T size={13.5} weight="600" color={on ? theme.text : theme.text2}>{label}</T>
                </Pressable>
              );
            })}
          </View>
          {form.mode === "stock" ? row(t("Pezzi"), "stock", { keyboard: "number-pad" }) : row(t("Settimane"), "weeks", { keyboard: "number-pad" })}
          {row(t("Varianti"), "variants", { placeholder: t("Rosso, Blu, Avorio") })}
          <Pressable onPress={() => { tap(); setForm((prev) => ({ ...prev, service: !prev.service })); }} style={styles.row}>
            <View style={[styles.sep, { backgroundColor: theme.line }]} />
            <View style={{ flex: 1, paddingVertical: 10 }}>
              <T size={15.5}>{t("Corso o servizio")}</T>
              <T size={12.5} color={theme.text2}>{t("Niente spedizione: si prenota in chat.")}</T>
            </View>
            <Toggle on={form.service} />
          </Pressable>
        </View>

        <Cap>{t("Dettagli")}</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          {row(t("Materiali"), "materials", { first: true, placeholder: t("es. Gres") })}
          {row(t("Misure"), "size", { placeholder: t("Ø 12 cm") })}
        </View>
        <View style={[styles.card, { backgroundColor: st.card, marginTop: 12, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 26 }]}>
          <TextInput
            value={form.description}
            maxLength={500}
            multiline
            onChangeText={set("description")}
            placeholder={t("Racconta la storia di questo pezzo…")}
            placeholderTextColor={theme.text3}
            style={{ minHeight: 88, color: theme.text, fontSize: 15.5, lineHeight: 22, textAlignVertical: "top", padding: 0 }}
          />
          <T size={12.5} color={theme.text3} style={styles.count}>{500 - form.description.length}</T>
        </View>
        {!fresh ? (
          <Pressable onPress={() => setConfirm(true)} style={({ pressed }) => [styles.card, styles.delete, { backgroundColor: pressed ? theme.fill : st.card }]}>
            <T size={15.5} weight="500" color={theme.red}>{t("Elimina prodotto")}</T>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/payments")}>
          <T size={12.5} color={theme.text2} style={styles.note}>{t("Con i pagamenti Stripe attivi chi compra paga subito nell'app; altrimenti ti scrive nel Direct.")} <T size={12.5} weight="600" color={theme.blue}>{t("Pagamenti")}</T></T>
        </Pressable>
      </ScrollView>
      <ActionSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        hint={t("Eliminare «{name}» dallo shop?", { name: product?.name || "" })}
        items={[{ label: t("Elimina prodotto"), danger: true, onPress: remove }]}
      />
    </KeyboardAvoidingView>
  );
}

function Cap({ children }) {
  const theme = useTheme();
  return <T size={12.5} weight="500" color={theme.text2} style={styles.cap}>{(Array.isArray(children) ? children.join("") : String(children)).toUpperCase()}</T>;
}

const styles = StyleSheet.create({
  headRow: { height: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: INSET },
  cap: { marginTop: 22, marginBottom: 7, marginHorizontal: 30, letterSpacing: 0.4 },
  card: { marginHorizontal: INSET, borderRadius: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 14 },
  sep: { position: "absolute", top: 0, right: 0, left: 14, height: StyleSheet.hairlineWidth },
  photo: { width: 92, height: 92, borderRadius: 14, overflow: "hidden" },
  photoAdd: { borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  photoX: { position: "absolute", right: 5, top: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  cover: { position: "absolute", left: 6, bottom: 6, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 99, backgroundColor: "rgba(0,0,0,0.6)" },
  trayItem: { width: 72, height: 92, borderRadius: 10, overflow: "hidden" },
  seg: { flexDirection: "row", gap: 4, marginTop: 8, marginHorizontal: 10, marginBottom: 4, padding: 3, borderRadius: 10 },
  segBtn: { flex: 1, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  count: { position: "absolute", right: 14, bottom: 8 },
  delete: { marginTop: 22, minHeight: 50, alignItems: "center", justifyContent: "center" },
  note: { marginTop: 8, marginHorizontal: 30, lineHeight: 17 },
});
