// People to write to: search results while typing, otherwise the accounts I follow and
// then suggestions, with presence from the hub when it knows them.
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { useMe } from "../lib/session";
import { useFollowList, useSearch, useSuggested } from "../lib/social";
import { t } from "../lib/i18n";
import { useLive } from "./LiveStore";
import { seenText } from "./format";

export function useDebounced(value, ms = 250) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return out;
}

export function usePeople(query) {
  const store = useStore();
  const live = useLive();
  const me = useMe()?.handle || null;
  const q = useDebounced(String(query || "").trim());
  const following = useFollowList(me, "following");
  const suggested = useSuggested();
  const search = useSearch(q);
  const blocked = store.prefs?.blocked;
  const hubPeople = live?.people;

  const shape = useMemo(() => {
    const hidden = new Set(Array.isArray(blocked) ? blocked : []);
    return (list) => (list || [])
      .filter((person) => person?.handle && person.handle !== me && !hidden.has(person.name) && !hidden.has(person.handle))
      .map((person) => {
        const hub = hubPeople?.[person.handle];
        const online = Boolean(hub?.online);
        return {
          handle: person.handle,
          name: person.name || person.handle,
          src: person.avatar || hub?.src || "",
          verified: Boolean(person.verified),
          online,
          meta: online ? t("online") : hub?.lastSeen ? `@${person.handle} · ${seenText(hub)}` : `@${person.handle}`,
        };
      });
  }, [blocked, me, hubPeople]);

  const results = useMemo(() => shape(search.data?.people), [shape, search.data]);
  const mine = useMemo(() => shape(following.items), [shape, following.items]);
  const others = useMemo(() => {
    const known = new Set(mine.map((person) => person.handle));
    return shape(suggested.data).filter((person) => !known.has(person.handle));
  }, [shape, suggested.data, mine]);

  return {
    query: q,
    searching: Boolean(q),
    results,
    following: mine,
    suggested: others,
    loading: q ? search.loading || q !== String(query || "").trim() : following.loading || suggested.loading,
    error: q ? search.error : following.error && suggested.error,
    moreLoading: following.moreLoading,
    more: () => { if (!q && !following.done && !following.moreLoading) following.more(); },
    refresh: () => { if (q) search.refresh(); else { following.refresh(); suggested.refresh(); } },
    refreshing: following.refreshing,
  };
}
