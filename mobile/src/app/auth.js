import { View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { AuthScreen } from "../ui/auth";

// "Aggiungi account" from Settings: the sign-in screen, with a way back to the current account.
export default function AuthRoute() {
  const store = useStore();
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={{ flex: 1 }}>
      <AuthScreen backHandle={store.auth?.handle || null} onDone={leave} />
    </View>
  );
}
