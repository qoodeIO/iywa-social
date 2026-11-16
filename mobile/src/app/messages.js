// Old links to /messages (and shared links) open the messages page of the main pager.
import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { openTab } from "../lib/tabs";

export default function Linkmessages() {
  const params = useLocalSearchParams();
  useEffect(() => {
    const extra = Object.keys(params).length ? { ...params } : undefined;
    if (router.canGoBack()) openTab("messages", extra);
    else {
      router.replace("/");
      setTimeout(() => openTab("messages", extra), 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
