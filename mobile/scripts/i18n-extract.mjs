// Lists every t("…") string in src/ into src/i18n/keys.json (Italian source text),
// and reports, per language, how many keys are still missing.
// Usage: node scripts/i18n-extract.mjs [--missing <lang>]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../src/", import.meta.url).pathname;
const SKIP = new Set();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

// t( followed by a single string literal ("…", '…' or `…` without ${}).
const CALL = /(?<![\w$.])tk?\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\$]|\\.)*`)\s*[,)]/g;

function unquote(literal) {
  const body = literal.slice(1, -1);
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (match, esc) => {
    if (esc[0] === "u") return String.fromCodePoint(parseInt(esc.replace(/[u{}]/g, ""), 16));
    if (esc[0] === "x") return String.fromCharCode(parseInt(esc.slice(1), 16));
    return { n: "\n", t: "\t", r: "\r", "0": "\0" }[esc] ?? esc;
  });
}

const keys = new Set();
for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  for (const match of src.matchAll(CALL)) keys.add(unquote(match[1]));
}

const sorted = [...keys].sort((a, b) => a.localeCompare(b, "it"));
writeFileSync(join(ROOT, "i18n/keys.json"), `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`${sorted.length} keys → src/i18n/keys.json`);

const want = process.argv.indexOf("--missing");
for (const name of readdirSync(join(ROOT, "i18n"))) {
  if (!name.endsWith(".json") || name === "keys.json" || name === "langs.json") continue;
  const lang = name.replace(/\.json$/, "");
  const dict = JSON.parse(readFileSync(join(ROOT, "i18n", name), "utf8"));
  const missing = sorted.filter((key) => typeof dict[key] !== "string" || !dict[key]);
  if (want >= 0 && process.argv[want + 1] === lang) {
    writeFileSync(join(ROOT, `i18n/.missing-${lang}.json`), `${JSON.stringify(missing, null, 1)}\n`);
  }
  if (missing.length) console.log(`${lang}: ${missing.length} missing`);
}
