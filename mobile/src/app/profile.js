// Old links to /profile (and shared links) open the profile page of the main pager.
import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { openTab } from "../lib/tabs";

export default function Linkprofile() {
  const params = useLocalSearchParams();
  useEffect(() => {
    const extra = Object.keys(params).length ? { ...params } : undefined;
    if (router.canGoBack()) openTab("profile", extra);
    else {
      router.replace("/");
      setTimeout(() => openTab("profile", extra), 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
