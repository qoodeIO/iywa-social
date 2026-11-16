// Helpers for translating src/i18n/keys.json into src/i18n/<lang>.json.
//   node scripts/i18n-tool.mjs chunk <lang> <size>   → writes the missing keys in numbered chunks to /tmp/i18n-<lang>-<n>.json
//   node scripts/i18n-tool.mjs merge <lang> <file>   → merges a {"italian": "translation"} file into src/i18n/<lang>.json
//   node scripts/i18n-tool.mjs check [lang…]         → missing keys, placeholder mismatches, untranslated copies
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = new URL("../src/i18n/", import.meta.url).pathname;
const keys = JSON.parse(readFileSync(`${DIR}keys.json`, "utf8"));
const load = (lang) => (existsSync(`${DIR}${lang}.json`) ? JSON.parse(readFileSync(`${DIR}${lang}.json`, "utf8")) : {});
const save = (lang, dict) => {
  const ordered = {};
  for (const key of keys) if (typeof dict[key] === "string") ordered[key] = dict[key];
  writeFileSync(`${DIR}${lang}.json`, `${JSON.stringify(ordered, null, 1)}\n`);
};
const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "chunk") {
  const [lang, size = "150"] = args;
  const dict = load(lang);
  const missing = keys.filter((key) => typeof dict[key] !== "string" || !dict[key]);
  const n = Number(size);
  let count = 0;
  for (let i = 0; i < missing.length; i += n) {
    count += 1;
    writeFileSync(`/tmp/i18n-${lang}-${count}.json`, `${JSON.stringify(missing.slice(i, i + n), null, 1)}\n`);
  }
  console.log(`${lang}: ${missing.length} missing → ${count} chunks /tmp/i18n-${lang}-1..${count}.json`);
} else if (cmd === "merge") {
  const [lang, file] = args;
  const part = JSON.parse(readFileSync(file, "utf8"));
  const dict = load(lang);
  const known = new Set(keys);
  let added = 0;
  const problems = [];
  for (const [key, value] of Object.entries(part)) {
    if (!known.has(key)) { problems.push(`unknown key: ${JSON.stringify(key)}`); continue; }
    if (typeof value !== "string" || !value.trim()) { problems.push(`empty: ${JSON.stringify(key)}`); continue; }
    if (holes(key) !== holes(value)) { problems.push(`placeholders differ: ${JSON.stringify(key)} → ${JSON.stringify(value)}`); continue; }
    dict[key] = value;
    added += 1;
  }
  save(lang, dict);
  console.log(`${lang}: merged ${added}`);
  if (problems.length) console.log(problems.join("\n"));
} else if (cmd === "check") {
  const langs = args.length ? args : JSON.parse(readFileSync(`${DIR}langs.json`, "utf8"));
  let bad = 0;
  for (const lang of langs) {
    const dict = load(lang);
    const missing = keys.filter((key) => typeof dict[key] !== "string" || !dict[key]);
    const holesBad = keys.filter((key) => typeof dict[key] === "string" && holes(key) !== holes(dict[key]));
    const same = keys.filter((key) => dict[key] === key && /[a-zà-ù]{4,}/i.test(key));
    if (missing.length || holesBad.length) bad += 1;
    console.log(`${lang}: ${keys.length - missing.length}/${keys.length}${holesBad.length ? `, ${holesBad.length} placeholder errors` : ""}${same.length ? `, ${same.length} identical to Italian` : ""}`);
  }
  process.exit(bad ? 1 : 0);
} else {
  console.log("usage: chunk <lang> [size] | merge <lang> <file> | check [lang…]");
}
