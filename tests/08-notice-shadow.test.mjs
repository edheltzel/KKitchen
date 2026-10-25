import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { read, distFiles } from './helpers.mjs';

const src = read('src/styles/global.css');
const built = distFiles().filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n');

for (const name of ['kk-light', 'kk-dark']) {
  test(`${name} defines a notice shadow colour token`, () => {
    const block = src.split('@plugin "daisyui/theme" {').slice(1).find((b) => b.includes(`name: "${name}"`)) ?? '';
    assert.match(block.slice(0, block.indexOf('\n}')), /--kk-shadow:\s*rgb\([^)]+\);/, `--kk-shadow in ${name}`);
  });
}

test('the notice shadow uses the token; no hard-coded rgb(0 0 0 / .12) is left in source or built CSS', () => {
  assert.match(src, /\.kk-notice\s*\{[^}]*box-shadow:[^;}]*var\(--kk-shadow\)/);
  const hard = /rgb\(\s*0\s+0\s+0\s*\/\s*0?\.12\s*\)|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.12\s*\)|#0000001f/i;
  assert.ok(!hard.test(src), 'source');
  assert.ok(built.length > 0 && !hard.test(built), 'built css');
});
