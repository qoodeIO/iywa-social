import { View } from "react-native";
import { router } from "expo-router";
import { useMe } from "../lib/session";
import { AuthScreen } from "../ui/auth";

// "Aggiungi account" (profile switcher, Settings → Account): the sign-in screen, with a way back
// to the current account.
export default function AuthRoute() {
  const me = useMe();
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={{ flex: 1 }}>
      <AuthScreen backHandle={me?.handle || null} onDone={leave} />
    </View>
  );
}
