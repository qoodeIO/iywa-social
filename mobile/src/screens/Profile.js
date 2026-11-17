import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INSET, useTheme } from "../theme";
import { switchAccount, useSession } from "../lib/session";
import { Checked, ChevronDown, Lock, Menu, Plus, Ring, SquarePlus } from "../ui/icons-profile";
import { IconBtn, Sheet, T, tap } from "../ui/kit";
import { Face, MyProfile } from "../ui/profile";
import { t } from "../lib/i18n";

export default function Profile() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const me = session.me;
  const [accounts, setAccounts] = useState(false);
  const [switching, setSwitching] = useState(null);
  const users = session.accounts || [];

  async function pick(user) {
    tap();
    if (user.handle === me?.handle) { setAccounts(false); return; }
    setSwitching(user.handle);
    // A saved account whose session expired needs a fresh sign-in.
    const ok = user.token ? await switchAccount(user.handle) : false;
    setSwitching(null);
    setAccounts(false);
    if (!ok) router.push("/auth");
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={styles.top}>
        <Pressable onPress={() => { tap(); setAccounts(true); }} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, opacity: pressed ? 0.6 : 1 }]}>
          {me?.private ? <Lock size={16} weight="bold" color={theme.text} /> : null}
          <T size={22} weight="800" lines={1} style={{ letterSpacing: -0.5, flexShrink: 1 }}>{me?.handle || ""}</T>
          <ChevronDown size={16} weight="bold" color={theme.text} />
        </Pressable>
        <View style={{ flexDirection: "row" }}>
          <IconBtn icon={SquarePlus} label={t("Crea")} onPress={() => router.push("/create")} />
          <IconBtn icon={Menu} label={t("Impostazioni")} onPress={() => router.push("/settings")} />
        </View>
      </View>
      <MyProfile />
      <Sheet open={accounts} onClose={() => setAccounts(false)}>
        {users.map((user) => {
          const current = user.handle === me?.handle;
          return (
            <Pressable
              key={user.handle}
              disabled={Boolean(switching)}
              onPress={() => pick(user)}
              style={({ pressed }) => [styles.account, { backgroundColor: pressed ? theme.fill : "transparent", opacity: switching && switching !== user.handle ? 0.5 : 1 }]}
            >
              <Face src={current ? me?.avatar : user.avatar} name={user.name || user.handle} size={44} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="600">{user.handle}</T>
                <T size={13} color={theme.text2}>{user.token || current ? user.name : t("Accedi di nuovo")}</T>
              </View>
              {current ? <Checked size={24} weight="fill" color={theme.blue} /> : <Ring size={24} color={theme.text3} />}
            </Pressable>
          );
        })}
        <Pressable onPress={() => { setAccounts(false); router.push("/auth"); }} style={({ pressed }) => [styles.account, { backgroundColor: pressed ? theme.fill : "transparent" }]}>
          <View style={[styles.addAcc, { borderColor: theme.text3 }]}><Plus size={20} color={theme.text} /></View>
          <T size={15} weight="600">{t("Aggiungi account")}</T>
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
