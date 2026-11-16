import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { Heart } from "../../ui/icons";
import { Btn, Empty, Header } from "../../ui/kit";
import { CartButton, Grid } from "../../ui/market";

export default function Wishlist() {
  const theme = useTheme();
  const store = useStore();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Preferiti" subtitle={store.wishlist.length ? `${store.wishlist.length}` : null} right={<CartButton />} />
      <ScrollView contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}>
        {store.wishlist.length ? <Grid refs={store.wishlist} /> : (
          <Empty icon={Heart} title="Ancora nessun preferito" text="Tocca il cuore su un prodotto per salvarlo qui.">
            <Btn title="Vai allo Shop" kind="primary" onPress={() => router.replace("/shop")} style={{ marginTop: 10 }} />
          </Empty>
        )}
      </ScrollView>
    </View>
  );
}
