import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { read, root } from './helpers.mjs';

const dist = join(root, 'dist');
const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? htmlFiles(full) : full.endsWith('.html') ? [full] : [];
  });

test('dist/_headers exists and sends noindex, nosniff and a same-origin referrer policy on every path', () => {
  assert.ok(existsSync(join(dist, '_headers')), 'dist/_headers (copied from public/)');
  const lines = read('dist/_headers').split('\n').map((l) => l.trimEnd());
  const first = lines.findIndex((l) => l === '/*');
  assert.ok(first >= 0, 'one rule for all paths: /*');
  const rule = [];
  for (const l of lines.slice(first + 1)) {
    if (!/^\s+\S/.test(l)) break;
    rule.push(l.trim());
  }
  assert.ok(rule.includes('X-Robots-Tag: noindex, nofollow'), rule.join(' | '));
  assert.ok(rule.includes('X-Content-Type-Options: nosniff'), rule.join(' | '));
  // same-origin, not no-referrer: Back on the recipe page and Exit in cooking read document.referrer to decide whether to step back in history.
  assert.ok(rule.includes('Referrer-Policy: same-origin'), rule.join(' | '));
  assert.ok(!rule.some((l) => /no-referrer/i.test(l)), 'no-referrer would blank document.referrer on this site');
});

test('_headers has no redirects or other rules that could change what is served', () => {
  const text = read('dist/_headers');
  assert.equal(text.split('\n').filter((l) => l.startsWith('/')).length, 1, 'a single path rule');
  assert.ok(!/Set-Cookie|Access-Control-Allow-Origin|Location:/i.test(text));
});

test('every built page carries <meta name="robots" content="noindex"> too', () => {
  const pages = htmlFiles(dist);
  assert.ok(pages.length >= 8, `found ${pages.length} pages`);
  for (const file of pages) assert.match(read(file.slice(root.length + 1)), /<meta name="robots" content="noindex"/, file);
});
