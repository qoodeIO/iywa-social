import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../theme";

// space://checkout is where Stripe Checkout sends the buyer back (src/lib/pay.js startCheckout).
// The auth session usually catches it; when the link reaches the router instead (Android),
// this screen steps aside: startCheckout confirms the order and opens the orders itself.
export default function CheckoutReturn() {
  const theme = useTheme();
  useEffect(() => {
    const id = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/shop/orders");
    }, 0);
    return () => clearTimeout(id);
  }, []);
  return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
}
