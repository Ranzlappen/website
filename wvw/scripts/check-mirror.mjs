// Fails when wvw/src/shared/* drifts from polyvote/functions/src/wvw/shared/*.
// The two copies are intentional (CLAUDE.md "Module boundaries": no
// cross-module imports); only the "MIRRORED FILE" header line may differ.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const client = join(here, '..', 'src', 'shared');
const server = join(here, '..', '..', 'polyvote', 'functions', 'src', 'wvw', 'shared');
const norm = (s) => s.split('\n').filter((l) => !l.includes('MIRRORED FILE')).join('\n');

let bad = 0;
const files = new Set([...readdirSync(client), ...readdirSync(server)].filter((f) => f.endsWith('.ts')));
for (const f of files) {
  let a = null;
  let b = null;
  try { a = readFileSync(join(client, f), 'utf8'); } catch { /* missing */ }
  try { b = readFileSync(join(server, f), 'utf8'); } catch { /* missing */ }
  if (a == null || b == null || norm(a) !== norm(b)) {
    console.error(`✗ shared/${f} differs between wvw/ and polyvote/functions/ (or is missing on one side)`);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`✓ ${files.size} mirrored shared files in sync`);
