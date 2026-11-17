// Shops from the server for the marketplace screens (useShops / useShop in lib/social.js).
// What arrives is also copied into the small registry in src/data, so product stickers in
// stories and posts (findProduct / storeOf there) can still show name, photo and price.
import { useEffect, useMemo } from "react";
import { putLiveShops } from "../data";
import { useShop, useShops } from "./social";
import { myHandle } from "./session";
import { shopFromList } from "../ui/market";

// Every shop except mine, in the shape of shopFromList.
export function useMarketShops() {
  const query = useShops();
  const list = query.data;
  useEffect(() => {
    if (Array.isArray(list)) putLiveShops(list, { partial: true });
  }, [list]);
  const me = myHandle();
  const shops = useMemo(() => (Array.isArray(list) ? list.filter((entry) => entry.seller !== me && entry.products?.length).map(shopFromList) : []), [list, me]);
  return { ...query, shops, all: Array.isArray(list) ? list : [] };
}

// One seller's full catalogue: { seller, business, products, payments }.
export function useSellerShop(handle) {
  const query = useShop(handle);
  const data = query.data;
  useEffect(() => {
    if (!data || !handle) return;
    const business = data.business || {};
    putLiveShops([{ seller: handle, shop: { title: business.title || data.seller?.name || "", city: business.city || "", category: business.category || "" }, payments: data.payments, products: data.products || [] }]);
  }, [data, handle]);
  return query;
}
