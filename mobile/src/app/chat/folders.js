import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { defaultFolders, folderSummary } from "../../live/format";
import { Hint, SubHead, useChatTheme } from "../../ui/chat";
import { AddCircle, Folder, Trash } from "../../ui/chatIcons";
import { T, tap } from "../../ui/kit";
import { INSET } from "../../theme";

export function Cap({ children }) {
  const theme = useChatTheme();
  return <T size={13} weight="500" color={theme.text2} style={{ marginTop: 18, marginHorizontal: 30, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>{children}</T>;
}

export function Card({ children }) {
  const theme = useChatTheme();
  return <View style={{ marginHorizontal: INSET, borderRadius: 14, backgroundColor: theme.bg, overflow: "hidden" }}>{children}</View>;
}

export default function Folders() {
  const theme = useChatTheme();
  const store = useStore();
  const folders = store.dmFolders || defaultFolders();
  const used = new Set(folders.map((entry) => entry.id));
  const suggested = defaultFolders().filter((entry) => !used.has(entry.id));
  const border = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={t("Cartelle chat")} />
      <ScrollView style={{ backgroundColor: theme.page }} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.hero}>
          <Animated.View entering={ZoomIn.springify().damping(12)}>
            <LinearGradient colors={["#5ec4ff", "#2a7bf2"]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={styles.heroIcon}><Folder size={40} weight="fill" color="#fff" /></LinearGradient>
          </Animated.View>
          <T size={14} color={theme.text2} style={{ textAlign: "center", lineHeight: 19.6 }}>{t("Crea cartelle per diversi gruppi di chat e passa rapidamente da una all'altra.")}</T>
        </View>
        <Cap>{t("Le mie cartelle")}</Cap>
        <Card>
          <View style={styles.cell}><Folder size={22} weight="fill" color={theme.blue} /><T size={15.5} weight="500">{t("Tutte le chat")}</T></View>
          {folders.map((entry) => (
            <View key={entry.id} style={[styles.cell, border]}>
              <Pressable onPress={() => { tap(); router.push({ pathname: "/chat/folder", params: { id: entry.id } }); }} style={({ pressed }) => [styles.cellMain, pressed && { opacity: 0.6 }]}>
                <Folder size={22} weight="fill" color={theme.blue} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={15.5} weight="500" lines={1}>{t(entry.name)}</T>
                  <T size={13} color={theme.text2} lines={1}>{folderSummary(entry)}</T>
                </View>
              </Pressable>
              <Pressable accessibilityLabel={t("Elimina {name}", { name: t(entry.name) })} hitSlop={6} onPress={() => { tap(); store.setDmFolders(folders.filter((item) => item.id !== entry.id)); }} style={styles.del}>
                <Trash size={18} color={theme.text3} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => { tap(); router.push("/chat/folder"); }} style={({ pressed }) => [styles.cell, border, pressed && { backgroundColor: theme.fill }]}>
            <AddCircle size={22} weight="fill" color={theme.blue} />
            <T size={15.5} weight="500" color={theme.blue}>{t("Crea una nuova cartella")}</T>
          </Pressable>
        </Card>
        {suggested.length ? (
          <>
            <Cap>{t("Cartelle suggerite")}</Cap>
            <Card>
              {suggested.map((entry, index) => (
                <View key={entry.id} style={[styles.cell, index && border]}>
                  <View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}>
                    <T size={15.5} weight="500">{t(entry.name)}</T>
                    <T size={13} color={theme.text2} lines={1}>{folderSummary(entry)}</T>
                  </View>
                  <Pressable onPress={() => { tap(); store.setDmFolders([...folders, entry]); }} style={[styles.add, { backgroundColor: theme.blue }]}><T size={13.5} weight="600" color="#fff">{t("Aggiungi")}</T></Pressable>
                </View>
              ))}
            </Card>
          </>
        ) : null}
        <Hint style={{ marginHorizontal: 30 }}>{t("Suggerimento: tieni premuta una cartella per modificarla.")}</Hint>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 10, paddingTop: 18, paddingHorizontal: 30, paddingBottom: 6 },
  heroIcon: { width: 76, height: 76, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#2a7bf2", shadowOpacity: 0.35, shadowRadius: 13, shadowOffset: { width: 0, height: 10 } },
  cell: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingVertical: 4, paddingHorizontal: 14 },
  cellMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  del: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  add: { height: 30, paddingHorizontal: 14, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
