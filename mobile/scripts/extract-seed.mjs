// Pulls the demo data out of the web app (src/App.jsx) into mobile/src/data/seed.json,
// so both apps show the same people, posts, stories, thoughts and shops.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const src = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");

function grab(name, kind = "const") {
  const head = kind === "function" ? `function ${name}(` : `const ${name} =`;
  const start = src.indexOf(`\n${head}`);
  if (start < 0) throw new Error(`missing ${name}`);
  let i = start + 1;
  let depth = 0;
  let quote = null;
  let started = false;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if ("([{".includes(ch)) { depth += 1; started = true; }
    if (")]}".includes(ch)) depth -= 1;
    if (kind === "function" && started && depth === 0 && ch === "}") return src.slice(start + 1, i + 1);
    if (kind === "const" && depth === 0 && ch === ";" ) return src.slice(start + 1, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const consts = ["PORTRAIT", "DEFAULT_AVATAR", "SHOT_FIRE", "SHOT_CUPS", "VOICE_WAVE", "PEOPLE", "THREADS", "CONTACTS", "WORKS", "HERO", "POSTS", "STORY_DECKS", "HIGHLIGHTS", "REELS", "MEET", "FEED_PAGES",
  "shot", "SEARCH_PEOPLE", "EXPLORE_SEED", "EXPLORE_TOPICS", "MIN", "HOUR", "DAY", "BOOT", "THOUGHT_SEED", "NOW0", "NOTIFY_SEED", "WEEK", "pic", "SHOPS",
  "MY_PRODUCTS_SEED", "DEFAULT_BUSINESS", "PROFILE_SEED", "REVIEW_LINES", "SHOP_TOPICS", "STORY_PLACES", "STORY_HASH", "STORY_EMOJI", "AVATAR_TONES"];
const fns = ["avatarFor", "author"];
const pieces = [];
for (const name of consts) {
  try { pieces.push(grab(name)); } catch (error) { console.warn(String(error.message)); }
}
for (const name of fns) pieces.push(grab(name, "function"));
const code = `const VOICE_DEMO = "";\n${pieces.join("\n").replace("const DEFAULT_AVATAR", "var DEFAULT_AVATAR")}`;
const ordered = code.replace(/^const HERO =/m, "let AVATAR = DEFAULT_AVATAR;\nconst HERO =");
const sandbox = { console, Date, Math, encodeURIComponent, btoa: (s) => Buffer.from(s, "binary").toString("base64"), unescape, Set, Map, Object, Array, JSON, String, Number };
vm.createContext(sandbox);
const names = consts.filter((name) => name === name.toUpperCase() && pieces.some((p) => p.startsWith(`const ${name} =`) || p.startsWith(`var ${name} =`)));
vm.runInContext(`${ordered}\nthis.__out = { ${names.join(", ")}, AVATAR };`, sandbox);
const out = sandbox.__out;
// times relative to BOOT are stored as offsets so the app can rebase them at launch
out.BOOT_AT = out.BOOT;
delete out.MIN; delete out.HOUR; delete out.DAY; delete out.BOOT;
fs.mkdirSync(path.join(root, "mobile/src/data"), { recursive: true });
fs.writeFileSync(path.join(root, "mobile/src/data/seed.json"), JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : typeof v}`).join(" "));
