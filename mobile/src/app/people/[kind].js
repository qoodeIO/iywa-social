import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams } from "expo-router";
import { INSET, useTheme } from "../../theme";
import { useMe } from "../../lib/session";
import { removeFollower, toggleFollow, useFollowList } from "../../lib/social";
import { errorText } from "../../lib/api";
import { openProfile } from "../../lib/profile-data";
import { Search, UserPlus, Users } from "../../ui/icons-profile";
import { Btn, Header, T } from "../../ui/kit";
import { ActionSheet, IgEmpty, SlideTabs, useToast } from "../../ui/profile-kit";
import { Face } from "../../ui/profile";
import { t } from "../../lib/i18n";

const KINDS = ["followers", "following"];

// Followers and following of a profile (mine unless ?handle= says otherwise), like Instagram.
export default function People() {
  const theme = useTheme();
  const me = useMe();
  const params = useLocalSearchParams();
  const handle = String(params.handle || me?.handle || "").replace(/^@/, "").toLowerCase();
  const mine = handle === me?.handle;
  const [tab, setTab] = useState(params.kind === "following" ? 1 : 0);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState(null);
  const [toast, say] = useToast();
  const kind = KINDS[tab];
  const list = useFollowList(handle || null, kind);
  const needle = query.trim().toLowerCase().replace(/^@/, "");
  const people = needle ? list.items.filter((person) => `${person.handle} ${person.name || ""}`.toLowerCase().includes(needle)) : list.items;

  async function onFollow(person) {
    try { await toggleFollow(person); } catch (err) { say(errorText(err, t)); }
  }

  async function onRemove() {
    const person = removing;
    setRemoving(null);
    try {
      await removeFollower(person.handle);
      say(t("Follower rimosso"));
    } catch (err) {
      say(errorText(err, t));
    }
  }

  function empty() {
    if (list.loading) return <View style={{ paddingVertical: 40 }}><ActivityIndicator color={theme.text2} /></View>;
    if (list.error) {
      return (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 40 }}>
          <T size={14} color={theme.text2}>{errorText(list.error, t)}</T>
          <Btn title={t("Riprova")} height={32} onPress={list.refresh} />
        </View>
      );
    }
    if (needle) return <T size={14} color={theme.text2} style={{ textAlign: "center", padding: 28 }}>{t("Nessun risultato.")}</T>;
    if (kind === "followers") {
      return <IgEmpty icon={Users} title={mine ? t("Ancora nessun follower") : t("Nessun follower")} text={mine ? t("Quando qualcuno ti segue, lo vedrai qui.") : null} />;
    }
    return (
      <IgEmpty icon={UserPlus} title={mine ? t("Non segui ancora nessuno") : t("Non segue ancora nessuno")} text={mine ? t("Cerca persone da seguire: i loro post arriveranno in Home.") : null}>
        {mine ? <Btn title={t("Trova persone")} kind="primary" height={32} style={{ marginTop: 8, paddingHorizontal: 16 }} onPress={() => router.push("/search")} /> : null}
      </IgEmpty>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={handle} />
      <SlideTabs tabs={[{ key: "followers", label: t("Follower") }, { key: "following", label: t("Seguiti") }]} active={tab} onChange={setTab} height={44} size={14.5} />
      <View style={[styles.search, { backgroundColor: theme.fill }]}>
        <Search size={16} color={theme.text2} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t("Cerca")} placeholderTextColor={theme.text2} accessibilityLabel={t("Cerca persone")} autoCorrect={false} autoCapitalize="none" style={{ flex: 1, height: "100%", color: theme.text, fontSize: 15 }} />
      </View>
      <FlashList
        data={people}
        keyExtractor={(person) => person.handle}
        extraData={[tab, me?.handle]}
        keyboardDismissMode="on-drag"
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={needle ? undefined : list.more}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={empty()}
        ListFooterComponent={list.moreLoading ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={theme.text2} /></View> : null}
        renderItem={({ item: person }) => {
          const self = person.handle === me?.handle;
          const on = person.isFollowing || person.requested;
          const removable = mine && kind === "followers";
          return (
            <View style={styles.row}>
              <Pressable onPress={() => openProfile(person.handle)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Face src={person.avatar} name={person.name || person.handle} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <T size={14} weight="600" lines={1} style={{ flexShrink: 1 }}>{person.handle}</T>
                    {removable && !self && !on ? (
                      <Pressable hitSlop={6} onPress={() => onFollow(person)}><T size={14} weight="600" color={theme.blue}>{` · ${t("Segui")}`}</T></Pressable>
                    ) : null}
                  </View>
                  {person.name ? <T size={13.5} color={theme.text2} lines={1}>{person.name}</T> : null}
                </View>
              </Pressable>
              {self ? null : removable ? (
                <Btn title={t("Rimuovi")} height={30} style={{ paddingHorizontal: 16 }} onPress={() => setRemoving(person)} />
              ) : (
                <Btn
                  title={person.isFollowing ? t("Segui già") : person.requested ? t("Richiesta inviata") : person.followsMe ? t("Segui anche tu") : t("Segui")}
                  kind={on ? "gray" : "primary"}
                  height={30}
                  style={{ paddingHorizontal: 16 }}
                  onPress={() => onFollow(person)}
                />
              )}
            </View>
          );
        }}
      />
      <ActionSheet
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        hint={removing ? t("iywa non avviserà @{handle} che è stato rimosso dai tuoi follower.", { handle: removing.handle }) : null}
        items={[{ label: t("Rimuovi follower"), danger: true, onPress: onRemove }]}
      />
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 36, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginHorizontal: INSET, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: INSET },
});
