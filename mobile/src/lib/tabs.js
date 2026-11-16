// The five main pages (plus the story camera on the left of Home) live side by side in one
// horizontal pager on the "/" route, so moving between them is a native swipe and every
// page stays mounted. This module is the pager's shared state: which page is showing,
// params handed to a page (a search query, a reel to open) and the live scroll offset.
import { useSyncExternalStore } from "react";
import { Animated } from "react-native";
import { router, useIsFocused } from "expo-router";

export const PAGES = ["camera", "home", "search", "reels", "messages", "profile"];
export const HOME = 1;

let state = { index: HOME, params: {} };
const subs = new Set();
let scrollTo = null;

// Horizontal scroll offset of the pager, driven natively; the tab bar slides with it.
export const pagerX = new Animated.Value(0);

function set(next) {
  state = { ...state, ...next };
  subs.forEach((fn) => fn());
}

export function setPageIndex(index) {
  if (index !== state.index) set({ index });
}

export function registerPager(fn) {
  scrollTo = fn;
  return () => { if (scrollTo === fn) scrollTo = null; };
}

export function useTabs() {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => state);
}

export function currentPage() {
  return PAGES[state.index];
}

// Params for a page, e.g. { q } for search or { id } for reels; `at` changes on every open.
export function useTabParams(name) {
  return useTabs().params[name] || {};
}

// True while this page is the one on screen and nothing is pushed over the pager.
export function usePageFocused(name) {
  const focused = useIsFocused();
  const { index } = useTabs();
  return focused && PAGES[index] === name;
}

// Opens a main page from anywhere: closes pushed screens and jumps the pager.
export function openTab(name, params, { animated = false } = {}) {
  const index = PAGES.indexOf(name);
  if (index < 0) return;
  if (params) set({ params: { ...state.params, [name]: { ...params, at: Date.now() } } });
  if (router.canDismiss()) router.dismissAll();
  set({ index });
  scrollTo?.(index, animated);
}
