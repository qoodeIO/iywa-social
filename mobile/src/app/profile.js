import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { useStore } from "../lib/store";
import { AVATAR, avatarFor } from "../data";
import { Checked, ChevronDown, Menu, Plus, Ring, SquarePlus } from "../ui/icons-profile";
import { IconBtn, Sheet, T, tap } from "../ui/kit";
import { MyProfile } from "../ui/profile";

export default function Profile() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const [accounts, setAccounts] = useState(false);
  const users = store.auth?.users || [];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={styles.top}>
        <Pressable onPress={() => { tap(); setAccounts(true); }} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.6 : 1 }]}>
          <T size={22} weight="800" style={{ letterSpacing: -0.5 }}>{String(store.profile.handle).replace(/^@/, "")}</T>
          <ChevronDown size={16} weight="bold" color={theme.text} />
        </Pressable>
        <View style={{ flexDirection: "row" }}>
          <IconBtn icon={SquarePlus} label="Crea" onPress={() => router.push("/create")} />
          <IconBtn icon={Menu} label="Impostazioni" onPress={() => router.push("/settings")} />
        </View>
      </View>
      <MyProfile />
      <Sheet open={accounts} onClose={() => setAccounts(false)}>
        {users.map((user) => {
          const current = user.handle === store.auth?.handle;
          return (
            <Pressable
              key={user.handle}
              onPress={() => { tap(); setAccounts(false); if (!current) store.signIn(user.handle); }}
              style={({ pressed }) => [styles.account, { backgroundColor: pressed ? theme.fill : "transparent" }]}
            >
              <Image source={{ uri: user.handle === "forno.neri" ? store.profile.src || AVATAR : avatarFor(user.name || user.handle) || AVATAR }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="600">{user.handle}</T>
                <T size={13} color={theme.text2}>{user.name}</T>
              </View>
              {current ? <Checked size={24} weight="fill" color={theme.blue} /> : <Ring size={24} color={theme.text3} />}
            </Pressable>
          );
        })}
        <Pressable onPress={() => { setAccounts(false); store.addAccount(); }} style={({ pressed }) => [styles.account, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
          <View style={[styles.addAcc, { borderColor: theme.text3 }]}><Plus size={20} color={theme.text} /></View>
          <T size={15} weight="600">Aggiungi account</T>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: INSET, paddingRight: 6 },
  account: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  addAcc: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
