// Tiny app-wide toast ("Post condiviso"), shown by FeedOverlay in the root layout.
const listeners = new Set();
export function showToast(toast) {
  const entry = { id: Date.now(), ...toast };
  listeners.forEach((fn) => fn(entry));
}
export function onToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
