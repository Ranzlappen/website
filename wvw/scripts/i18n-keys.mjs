// Lists every UI string passed to t() / msg() in src/ (string literals only, incl.
// both branches of a ternary) — the i18n test checks each has a German entry.
// Usage: node scripts/i18n-keys.mjs [--missing]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' || f === 'shared' || f === 'i18n' ? [] : walk(p);
    return /\.(tsx?|mts)$/.test(f) ? [p] : [];
  });
}

/** String literals inside the first argument of every `t(` call. */
export function extractKeys(src) {
  const keys = new Set();
  const re = /(?<![\w.$])(?:t|msg)\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let str = null;
    let buf = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (str) {
        if (c === '\\') {
          buf += src[i + 1];
          i++;
        } else if (c === str) {
          if (str !== '`' || !buf.includes('${')) keys.add(buf);
          str = null;
          buf = '';
        } else buf += c;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        // A literal compared against (x === 'weekly' ? …) is not a UI string.
        str = /[!=]==?\s*$/.test(src.slice(Math.max(0, i - 6), i)) ? null : c;
        if (!str) {
          const end = src.indexOf(c, i + 1);
          if (end > i) i = end;
          continue;
        }
      }
      else if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) break;
    }
  }
  return keys;
}

export function allKeys() {
  const keys = new Set();
  for (const f of walk(root)) for (const k of extractKeys(readFileSync(f, 'utf8'))) keys.add(k);
  return [...keys].filter(Boolean).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const k of allKeys()) console.log(k);
}
