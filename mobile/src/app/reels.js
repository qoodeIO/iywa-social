// Old links to /reels (and shared links) open the reels page of the main pager.
import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { openTab } from "../lib/tabs";

export default function Linkreels() {
  const params = useLocalSearchParams();
  useEffect(() => {
    const extra = Object.keys(params).length ? { ...params } : undefined;
    if (router.canGoBack()) openTab("reels", extra);
    else {
      router.replace("/");
      setTimeout(() => openTab("reels", extra), 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
