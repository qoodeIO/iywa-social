// Old links to /search (and shared links) open the search page of the main pager.
import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { openTab } from "../lib/tabs";

export default function Linksearch() {
  const params = useLocalSearchParams();
  useEffect(() => {
    const extra = Object.keys(params).length ? { ...params } : undefined;
    if (router.canGoBack()) openTab("search", extra);
    else {
      router.replace("/");
      setTimeout(() => openTab("search", extra), 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
