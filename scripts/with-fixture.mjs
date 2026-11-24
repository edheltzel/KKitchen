// The build prerenders inside workerd, which reads KK_DATA from wrangler.jsonc's vars rather than the shell.
// This sets that var for one command and puts it back, so a fixture build never changes the committed file.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../wrangler.jsonc', import.meta.url);
const original = readFileSync(file, 'utf8');
const fixture = original.replace(/"KK_DATA": ""/, '"KK_DATA": "fixture"');
if (fixture === original) {
  console.error('wrangler.jsonc has no "KK_DATA": "" to set');
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
writeFileSync(file, fixture);
const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, KK_DATA: 'fixture' } });
writeFileSync(file, original);
process.exit(result.status ?? 1);
