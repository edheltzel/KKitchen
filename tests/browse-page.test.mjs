import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { read, decode, distFiles, root } from './helpers.mjs';

const home = decode(read('dist/index.html'));
const tray = home.match(/<dialog[\s\S]*?<\/dialog>/)?.[0] ?? '';
const cards = [...home.matchAll(/<article [^>]*data-example[^>]*>/g)].map((m) => m[0]);

test('every card carries its search data (name, ingredients, meal, minutes, diet)', () => {
  assert.equal(cards.length, 6);
  for (const c of cards) {
    for (const attr of ['data-name', 'data-ingredients', 'data-meal', 'data-minutes', 'data-diet']) {
      assert.match(c, new RegExp(`${attr}(=|\\s|>)`), `${attr} on ${c.slice(0, 60)}`);
    }
  }
  assert.match(home, /data-ingredients="[^"]*tomato[^"]*"/);
});

const SECRETS = ['saffron', 'Hidden Draft', 'Nut-free', 'Draft-only'];

// Case-insensitive scan of every text file under a folder (binary files, detected by a NUL byte, are skipped).
function leaks(dir) {
  const found = [];
  for (const file of distFiles(dir)) {
    const buf = readFileSync(file);
    if (buf.includes(0)) continue;
    const text = buf.toString('utf8').toLowerCase();
    for (const secret of SECRETS) if (text.includes(secret.toLowerCase())) found.push(`${relative(dir, file)}: ${secret}`);
  }
  return found;
}

test('unapproved notes and unconfirmed tags never reach ANY file in dist', () => {
  assert.ok(distFiles(join(root, 'dist')).length >= 5, 'dist has files to scan');
  assert.deepEqual(leaks(join(root, 'dist')), []);
  assert.ok(home.includes('Meatless'), 'confirmed tag still shows');
});

test('the leak scan itself catches a planted secret in a nested file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kk-leak-'));
  mkdirSync(join(dir, 'a', 'b'), { recursive: true });
  writeFileSync(join(dir, 'a', 'b', 'x.js'), 'var s = "SaFFron";');
  writeFileSync(join(dir, 'y.css'), '.x::after{content:"nut-FREE"}');
  writeFileSync(join(dir, 'a', 'z.html'), '<span>DRAFT-only</span><p>hidden draft</p>');
  assert.deepEqual(leaks(dir).map((f) => f.split(': ')[1]).sort(), ['Draft-only', 'Hidden Draft', 'Nut-free', 'saffron']);
  rmSync(dir, { recursive: true, force: true });
});

test('one live count element, announced politely', () => {
  const counts = [...home.matchAll(/id="recipe-count"/g)];
  assert.equal(counts.length, 1);
  assert.match(home, /<p[^>]*id="recipe-count"[^>]*aria-live="polite"[^>]*>6 recipes<\/p>/);
});

test('Filters button works: no aria-disabled, opens the dialog, 44px, shows a count slot', () => {
  const btn = home.match(/<button[^>]*id="filters-button"[^>]*>/)?.[0];
  assert.ok(btn, 'filters button');
  assert.ok(!/aria-disabled/.test(btn));
  assert.match(btn, /aria-haspopup="dialog"/);
  assert.match(btn, /\bh-11\b/);
  assert.match(home, /id="filters-count"[^>]*hidden/);
});

test('tray is a daisyUI bottom-sheet modal with Done and a backdrop close', () => {
  assert.match(tray, /<dialog[^>]*id="filter-tray"[^>]*class="modal modal-bottom"/);
  assert.match(tray, /<form method="dialog" class="modal-backdrop">/);
  assert.match(tray, /<button[^>]*>\s*Done\s*<\/button>/);
  assert.match(tray, /id="clear-filters"/);
});

test('tray offers only meal, time and confirmed diet options, each target >= 44px', () => {
  const chips = [...tray.matchAll(/<button[^>]*data-group="(\w+)"[^>]*data-value="([^"]*)"[^>]*>/g)];
  const by = (g) => chips.filter((c) => c[1] === g).map((c) => c[2]);
  assert.deepEqual(by('meal'), ['breakfast', 'lunch', 'dinner']);
  assert.deepEqual(by('time'), ['15', '30', '45']);
  assert.deepEqual(by('diet'), ['Meatless']);
  for (const c of chips) {
    assert.match(c[0], /aria-pressed="false"/);
    assert.match(c[0], /class="kk-chip"/);
  }
  assert.ok(!/rating/i.test(tray), 'no rating group yet (branch 3a)');
  assert.ok(!/gluten/i.test(home));
});

test('empty state, chips row and grid hooks exist', () => {
  assert.match(home, /id="recipe-grid"/);
  assert.match(home, /id="chips"/);
  assert.match(home, /<div[^>]*id="empty"[^>]*hidden/);
  assert.match(home, /<p[^>]*id="empty-message"/);
  assert.match(home, /<button[^>]*id="clear-all"[^>]*min-h-11[^>]*>\s*Clear\s*<\/button>/);
});

test('tray copy: diet says "needs all", the general hint no longer claims any-of for every group', () => {
  assert.match(tray, /Diet tags: a recipe needs all you pick\./);
  assert.ok(!/Pick several in one group to see any of them/.test(tray));
  assert.match(tray, /Meal and time: pick several to see any of them\./);
});

test('time chips read "N min or less" (tray labels also feed the chips row)', () => {
  const labels = [...tray.matchAll(/<button[^>]*data-group="time"[^>]*>([^<]*)<\/button>/g)].map((m) => m[1].trim());
  assert.deepEqual(labels, ['15 min or less', '30 min or less', '45 min or less']);
  assert.ok(!/Under \d+ min/.test(home), 'old label is gone from the page');
});
