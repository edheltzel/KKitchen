import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, read, decode, distFiles } from './helpers.mjs';

test('dist titles use the straight apostrophe', () => {
  for (const page of ['index.html', 'week/index.html', 'favorites/index.html']) {
    const html = decode(read(`dist/${page}`));
    assert.match(html, /<title>[^<]*Kris's Kitchen<\/title>/);
  }
});

test('manifest names use the straight apostrophe', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name, "Kris's Kitchen");
  assert.equal(m.short_name, "Kris's");
});

test('no curly apostrophes anywhere in source, public or dist text', () => {
  const files = ['src', 'public', 'dist']
    .flatMap((d) => distFiles(join(root, d)))
    .filter((f) => /\.(astro|ts|css|html|webmanifest|js)$/.test(f));
  assert.ok(files.length > 5);
  for (const f of files) {
    assert.ok(!/[\u2018\u2019]/.test(readFileSync(f, 'utf8')), `curly quote in ${f}`);
  }
});

test('package.json name does not contain the site name; deps are pinned exactly', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!/kris/i.test(pkg.name), pkg.name);
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [dep, version] of Object.entries(pkg[section] ?? {})) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${dep}@${version} must be pinned`);
    }
  }
});
