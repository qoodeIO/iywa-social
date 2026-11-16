// Demo people react to what you publish, so notifications fill up like a real network
// (same timings and copy as the web store's publish() and addComment()).
import { PEOPLE } from "../data";

const ECHO_LINES = ["Bellissimo 🔥", "Che lavoro pulito!", "Lo voglio vedere dal vivo 😍", "Bravissima, come sempre.", "Questo colore è incredibile."];

function somePerson(skip = []) {
  const list = PEOPLE.filter((person) => !skip.includes(person.name));
  return list[Math.floor(Math.random() * list.length)] || PEOPLE[0];
}

function mentionedPeople(text) {
  return [...new Set((String(text || "").match(/@([\w.]+)/g) || []).map((tag) => tag.slice(1).replace(/\.$/, "").toLowerCase()))]
    .map((handle) => PEOPLE.find((person) => person.handle === handle))
    .filter(Boolean);
}

const later = (delay, run) => setTimeout(run, delay);

export function publishPost(store, item) {
  store.publish(item);
  const me = String(store.profile?.handle || "").replace(/^@/, "");
  if (item?.kind !== "post" && item?.kind !== "reel") return;
  const fan = somePerson();
  const critic = somePerson([fan.name]);
  const what = item.kind === "reel" ? "reel" : "post";
  later(4000, () => store.pushNote({ type: "like", name: fan.name, src: fan.src, text: `ha messo mi piace al tuo ${what}.`, target: { kind: "post", id: item.id } }));
  later(10000, () => store.pushNote({ type: "comment", name: critic.name, src: critic.src, text: `ha commentato: “${ECHO_LINES[Math.floor(Math.random() * ECHO_LINES.length)]}”`, target: { kind: "post", id: item.id } }));
  for (const name of item.tags || []) {
    const person = PEOPLE.find((entry) => entry.name === name);
    if (person) later(7000, () => store.pushNote({ type: "like", name: person.name, src: person.src, text: "ha visto che l'hai taggato e ha messo mi piace.", target: { kind: "post", id: item.id } }));
  }
  for (const person of mentionedPeople(item.text)) {
    later(8000, () => store.pushNote({ type: "reply", name: person.name, src: person.src, text: `ha risposto alla tua menzione: “@${me} grazie! ❤️”`, target: { kind: "post", id: item.id } }));
  }
}

export function commentPost(store, id, text) {
  const clean = String(text || "").trim();
  if (!id || !clean) return;
  store.addComment(id, clean);
  const me = String(store.profile?.handle || "").replace(/^@/, "");
  const fan = somePerson();
  later(4500, () => store.pushNote({ type: "like", name: fan.name, src: fan.src, text: `ha messo mi piace al tuo commento: “${clean.slice(0, 60)}”`, target: { kind: "post", id } }));
  for (const person of mentionedPeople(clean)) {
    later(7500, () => store.pushNote({ type: "reply", name: person.name, src: person.src, text: `ha risposto al tuo commento: “@${me} assolutamente sì!”`, target: { kind: "post", id } }));
  }
}

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
