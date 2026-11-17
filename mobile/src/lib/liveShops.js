// Live sellers for the Shop (web ShopHome payApi("/shops") and LiveShopScreen "/shop").
// Results go into the registry in src/data, so storeOf("@handle") / findProduct work everywhere.
import { useEffect, useSyncExternalStore } from "react";
import { isLiveOwner, liveShopOf, liveSnapshot, onLiveShops, putLiveShops } from "../data";
import { payApi } from "./pay";

let loadedAt = 0;
let pending = null;
const asked = new Map();

export function loadLiveShops(force = false) {
  if (pending) return pending;
  if (!force && Date.now() - loadedAt < 30_000) return Promise.resolve();
  pending = payApi("/shops")
    .then((data) => {
      loadedAt = Date.now();
      putLiveShops(data.shops || [], { partial: true });
    })
    .catch(() => {})
    .finally(() => { pending = null; });
  return pending;
}

// One seller's full catalogue (the /shops list carries at most 12 products each).
export function fetchLiveShop(seller) {
  const handle = String(seller || "").replace(/^@/, "");
  if (!handle) return Promise.resolve(null);
  const last = asked.get(handle);
  if (last && Date.now() - last < 15_000) return Promise.resolve(liveShopOf(handle));
  asked.set(handle, Date.now());
  return payApi(`/shop?handle=${encodeURIComponent(handle)}`)
    .then((data) => {
      if (data?.products?.length) putLiveShops([data]);
      return liveShopOf(handle);
    })
    .catch(() => liveShopOf(handle));
}

// Re-renders when the registry changes and loads the list of live shops once.
export function useLiveShops() {
  const version = useSyncExternalStore(onLiveShops, liveSnapshot);
  useEffect(() => { loadLiveShops(); }, []);
  return version;
}

// For a route owner like "@handle": makes sure that seller's shop is loaded.
export function useLiveShop(owner) {
  const version = useSyncExternalStore(onLiveShops, liveSnapshot);
  useEffect(() => {
    if (isLiveOwner(owner)) fetchLiveShop(owner);
  }, [owner]);
  return version;
}
