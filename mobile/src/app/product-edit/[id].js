import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { DEMO_GALLERY } from "../../lib/profile-data";
import { ImageIcon, Plus, X } from "../../ui/icons-profile";
import { T, tap } from "../../ui/kit";
import { ActionSheet, settingsColors } from "../../ui/profile-kit";
import { keepAll } from "../../lib/media-store";

// Add or edit a product in your shop (web ProductEditor).
export default function ProductEditor() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const st = settingsColors(theme);
  const { id } = useLocalSearchParams();
  const product = id && id !== "new" ? store.myProducts.find((item) => item.id === id) : null;
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
  }));
  const [tray, setTray] = useState(fresh);
  const [confirm, setConfirm] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const price = Number(String(form.price).replace(",", "."));
  const valid = Boolean(form.name.trim() && price > 0 && form.images.length);

  async function fromDevice() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.8 });
      if (!result.canceled && result.assets?.length) {
        const kept = await keepAll(result.assets.map((asset) => asset.uri));
        setForm((prev) => ({ ...prev, images: [...prev.images, ...kept].slice(0, 6) }));
      }
    } catch {
      // picker unavailable
    }
  }

  function save() {
    if (!valid) return;
    tap("medium");
    store.saveProduct({
      ...(product || {}),
      id: product?.id || `p-${Date.now().toString(36)}`,
      name: form.name.trim(),
      price,
      category: form.category.trim() || "Altro",
      description: form.description.trim(),
      materials: form.materials.trim(),
      size: form.size.trim(),
      images: form.images,
      stock: form.mode === "order" ? 0 : Math.max(0, Number(form.stock) || 0),
      madeToOrder: form.mode === "order" ? Math.max(1, Number(form.weeks) || 1) : null,
      variants: form.variants.split(",").map((item) => item.trim()).filter(Boolean),
    });
    router.back();
  }

  function remove() {
    setConfirm(false);
    store.deleteProduct(product.id);
    router.back();
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
        <Pressable hitSlop={8} onPress={() => router.back()} style={{ width: 80 }}><T size={15.5}>Annulla</T></Pressable>
        <T size={17} weight="700" style={{ flex: 1, textAlign: "center" }}>{fresh ? "Nuovo prodotto" : "Modifica prodotto"}</T>
        <Pressable hitSlop={8} disabled={!valid} onPress={save} style={{ width: 80, alignItems: "flex-end" }}>
          <T size={15.5} weight="700" color={theme.blue} style={{ opacity: valid ? 1 : 0.35 }}>Salva</T>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}>
        <Cap>Foto · {form.images.length}/6</Cap>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: INSET }}>
          {form.images.map((src, index) => (
            <Animated.View key={`${index}-${String(src).slice(-12)}`} entering={ZoomIn.duration(220)} style={[styles.photo, { backgroundColor: st.card }]}>
              <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {index === 0 ? <View style={styles.cover}><T size={10} weight="700" color="#fff">Copertina</T></View> : null}
              <Pressable accessibilityLabel="Rimuovi" hitSlop={6} onPress={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, at) => at !== index) }))} style={styles.photoX}>
                <X size={11} weight="bold" color="#fff" />
              </Pressable>
            </Animated.View>
          ))}
          {form.images.length < 6 ? (
            <Pressable onPress={() => { tap(); setTray((value) => !value); }} style={[styles.photo, styles.photoAdd, { borderColor: "rgba(0,149,246,0.55)" }]}>
              <Plus size={22} weight="bold" color={theme.blue} />
              <T size={12} weight="600" color={theme.blue}>Aggiungi</T>
            </Pressable>
          ) : null}
        </ScrollView>
        {tray && form.images.length < 6 ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: INSET, paddingTop: 10 }}>
              <Pressable onPress={fromDevice} style={[styles.trayItem, { backgroundColor: theme.fill, alignItems: "center", justifyContent: "center", gap: 4 }]}>
                <ImageIcon size={22} color={theme.text} /><T size={11.5} weight="600">Libreria</T>
              </Pressable>
              {DEMO_GALLERY.slice(0, 10).map((src) => (
                <Pressable key={src} onPress={() => { tap(); setForm((prev) => ({ ...prev, images: [...prev.images, src].slice(0, 6) })); }} style={({ pressed }) => [styles.trayItem, { backgroundColor: theme.fill, opacity: pressed ? 0.8 : 1 }]}>
                  <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        <Cap>Prodotto</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          {row("Nome", "name", { first: true, max: 60, placeholder: "es. Coppa rossa" })}
          {row("Prezzo", "price", { prefix: "€", placeholder: "0", keyboard: "decimal-pad" })}
          {row("Categoria", "category", { max: 30, placeholder: "es. Tazze" })}
        </View>

        <Cap>Disponibilità</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          <View style={[styles.seg, { backgroundColor: theme.fill }]}>
            {[["stock", "Pronto"], ["order", "Su ordinazione"]].map(([mode, label]) => {
              const on = form.mode === mode;
              return (
                <Pressable key={mode} onPress={() => { tap(); setForm((prev) => ({ ...prev, mode })); }} style={[styles.segBtn, on ? { backgroundColor: st.card, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } } : null]}>
                  <T size={13.5} weight="600" color={on ? theme.text : theme.text2}>{label}</T>
                </Pressable>
              );
            })}
          </View>
          {form.mode === "stock" ? row("Pezzi", "stock", { keyboard: "number-pad" }) : row("Settimane", "weeks", { keyboard: "number-pad" })}
          {row("Varianti", "variants", { placeholder: "Rosso, Blu, Avorio" })}
        </View>

        <Cap>Dettagli</Cap>
        <View style={[styles.card, { backgroundColor: st.card }]}>
          {row("Materiali", "materials", { first: true, placeholder: "es. Gres" })}
          {row("Misure", "size", { placeholder: "Ø 12 cm" })}
        </View>
        <View style={[styles.card, { backgroundColor: st.card, marginTop: 12, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 26 }]}>
          <TextInput
            value={form.description}
            maxLength={500}
            multiline
            onChangeText={set("description")}
            placeholder="Racconta la storia di questo pezzo…"
            placeholderTextColor={theme.text3}
            style={{ minHeight: 88, color: theme.text, fontSize: 15.5, lineHeight: 22, textAlignVertical: "top", padding: 0 }}
          />
          <T size={12.5} color={theme.text3} style={styles.count}>{500 - form.description.length}</T>
        </View>
        {!fresh ? (
          <Pressable onPress={() => setConfirm(true)} style={({ pressed }) => [styles.card, styles.delete, { backgroundColor: pressed ? theme.fill : st.card }]}>
            <T size={15.5} weight="500" color={theme.red}>Elimina prodotto</T>
          </Pressable>
        ) : null}
        <T size={12.5} color={theme.text2} style={styles.note}>Chi compra te lo chiede nel Direct: prezzo, pagamento e spedizione li concordate in chat.</T>
      </ScrollView>
      <ActionSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        hint={`Eliminare «${product?.name || ""}» dallo shop?`}
        items={[{ label: "Elimina prodotto", danger: true, onPress: remove }]}
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
