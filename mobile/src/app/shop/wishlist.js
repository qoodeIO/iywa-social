import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { t } from "../../lib/i18n";
import { Heart } from "../../ui/icons";
import { Btn, Empty, Header } from "../../ui/kit";
import { CartButton, Grid } from "../../ui/market";

export default function Wishlist() {
  const theme = useTheme();
  const store = useStore();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={t("Preferiti")} subtitle={store.wishlist.length ? `${store.wishlist.length}` : null} right={<CartButton />} />
      <ScrollView contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}>
        {store.wishlist.length ? <Grid refs={store.wishlist} /> : (
          <Empty icon={Heart} title={t("Ancora nessun preferito")} text={t("Tocca il cuore su un prodotto per salvarlo qui.")}>
            <Btn title={t("Vai allo Shop")} kind="primary" onPress={() => router.replace("/shop")} style={{ marginTop: 10 }} />
          </Empty>
        )}
      </ScrollView>
    </View>
  );
}
