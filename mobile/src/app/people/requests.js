import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { INSET, useTheme } from "../../theme";
import { answerRequest, useRequests } from "../../lib/social";
import { errorText } from "../../lib/api";
import { openProfile } from "../../lib/profile-data";
import { UserPlus } from "../../ui/icons-profile";
import { Btn, Header, T } from "../../ui/kit";
import { IgEmpty, useToast } from "../../ui/profile-kit";
import { Face } from "../../ui/profile";
import { t } from "../../lib/i18n";

// People asking to follow my private account.
export default function Requests() {
  const theme = useTheme();
  const { data, loading, error, refresh } = useRequests();
  const [busy, setBusy] = useState([]);
  const [pulling, setPulling] = useState(false);
  const [toast, say] = useToast();
  const people = data || [];

  async function answer(person, accept) {
    setBusy((prev) => [...prev, person.handle]);
    try {
      await answerRequest(person.handle, accept);
      say(accept ? t("Richiesta accettata") : t("Richiesta rifiutata"));
    } catch (err) {
      say(errorText(err, t));
    } finally {
      setBusy((prev) => prev.filter((item) => item !== person.handle));
    }
  }

  async function pull() {
    setPulling(true);
    try { await refresh(); } finally { setPulling(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Richieste di follow")} border />
      <ScrollView refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} />} contentContainerStyle={{ paddingVertical: 6 }}>
        {loading && !people.length ? <View style={{ paddingVertical: 40 }}><ActivityIndicator color={theme.text2} /></View> : null}
        {error && !people.length ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 40 }}>
            <T size={14} color={theme.text2}>{errorText(error, t)}</T>
            <Btn title={t("Riprova")} height={32} onPress={refresh} />
          </View>
        ) : null}
        {!loading && !error && !people.length ? (
          <IgEmpty icon={UserPlus} title={t("Nessuna richiesta")} text={t("Con un account privato, chi vuole seguirti appare qui.")} />
        ) : null}
        {people.map((person) => {
          const working = busy.includes(person.handle);
          return (
            <View key={person.handle} style={styles.row}>
              <Pressable onPress={() => openProfile(person.handle)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Face src={person.avatar} name={person.name || person.handle} size={44} />
                <View style={{ flex: 1 }}>
                  <T size={14} weight="600" lines={1}>{person.handle}</T>
                  {person.name ? <T size={13.5} color={theme.text2} lines={1}>{person.name}</T> : null}
                </View>
              </Pressable>
              <Btn title={t("Conferma")} kind="primary" height={30} disabled={working} style={{ paddingHorizontal: 14 }} onPress={() => answer(person, true)} />
              <Btn title={t("Elimina")} height={30} disabled={working} style={{ paddingHorizontal: 14 }} onPress={() => answer(person, false)} />
            </View>
          );
        })}
      </ScrollView>
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: INSET },
});
