import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root, decode } from './helpers.mjs';

// `npm test` builds dist with KK_DATA=fixture (the old example recipes, for the other tests). This file builds the site the way
// `npm run build` does, with no KK_DATA, into a temp folder, and proves that build holds only the three real recipes.
const IDS = ['fried-chicken', 'high-protein-brownies', 'slow-cooker-roast'];
const TITLES = {
  'fried-chicken': 'Fried Chicken',
  'slow-cooker-roast': 'Slow Cooker Roast',
  'high-protein-brownies': 'High Protein Brownies',
};
let out;
const page = (rel) => decode(readFileSync(join(out, rel), 'utf8'));
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

before(() => {
  out = mkdtempSync(join(tmpdir(), 'kk-real-'));
  const env = { ...process.env };
  delete env.KK_DATA;
  execFileSync(join(root, 'node_modules/.bin/astro'), ['build', '--outDir', out], { cwd: root, env, stdio: 'pipe' });
});
after(() => rmSync(out, { recursive: true, force: true }));

test('a build with no KK_DATA has one recipe page and one cooking page for each real recipe, and nothing else', () => {
  assert.deepEqual(readdirSync(join(out, 'recipe')).sort(), IDS);
  assert.deepEqual(readdirSync(join(out, 'cook')).sort(), IDS);
});

test('the home page lists the three real recipes by their note titles, with no Example badge and no placeholder line', () => {
  const html = page('index.html');
  assert.equal((html.match(/<article/g) ?? []).length, 3);
  assert.match(html, />3 recipes</);
  for (const id of IDS) assert.match(html, new RegExp(`data-id="${id}"`));
  for (const t of Object.values(TITLES)) assert.ok(html.includes(`>${t}</a>`), t);
  assert.ok(!/>Example</.test(html) && !/Example recipe/.test(html) && !/placeholder content/.test(html));
  assert.ok(!/<img/i.test(html));
});

test('the week page offers the real titles with no placeholder line', () => {
  const html = page('week/index.html');
  for (const t of Object.values(TITLES)) assert.ok(html.includes(`>${t}</span>`), t);
  assert.ok(!/placeholder content/.test(html) && !/Example/.test(html));
});

test('every recipe page and cooking page carries the real title and no Example badge, no image, no tags', () => {
  for (const id of IDS) {
    const recipe = page(`recipe/${id}/index.html`);
    assert.ok(recipe.includes(`>${TITLES[id]}</h1>`), id);
    assert.ok(!/>Example</.test(recipe) && !/<img/i.test(recipe));
    assert.ok(!/aria-label="Tags"/.test(recipe), `${id}: no tag list`);
    assert.match(recipe, /rel="noopener noreferrer" class="kk-source"/);
    assert.ok(page(`cook/${id}/index.html`).includes(`Cooking ${TITLES[id]}`), id);
  }
});

test('gluten-free is held: no diet filter group, no diet value on any card, only Dinner and Snack as meal choices', () => {
  const home = page('index.html');
  assert.ok(!/Diet tags/.test(home));
  assert.ok(!/data-group="diet"/.test(home));
  assert.deepEqual([...home.matchAll(/data-diet(?:="([^"]*)")?[ >]/g)].map((m) => m[1] ?? ''), ['', '', '']);
  assert.deepEqual([...home.matchAll(/data-group="meal" data-value="([^"]*)"/g)].map((m) => m[1]), ['dinner', 'snack']);
  assert.deepEqual([...home.matchAll(/data-group="time" data-value="([^"]*)"/g)].map((m) => m[1]), ['15', '30', '45']);
});

test('the author is stored, not shown: no page carries an author name', () => {
  for (const f of walk(out).filter((f) => /\.(html|js|json)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/Linley Hanson|Instructables/.test(s), f);
  }
});

test('leak scan: no example recipe, fixture-only text or vault path anywhere in the real build', () => {
  const banned = [
    'Weeknight Pasta', 'Tomato Soup', 'Sheet-Pan Vegetables', 'Overnight Oats', 'Banana Pancakes', 'Hidden Draft Note',
    'saffron', 'Nut-free', 'Draft-only', 'Meatless', 'Example recipe', 'example-1', 'example.com',
    'FieldNotes', 'iCloud', 'Mobile Documents', 'Obsidian', '/Users/',
  ];
  const files = walk(out);
  assert.ok(files.length > 10);
  for (const f of files.filter((f) => !/\.(png|ico|woff2?|jpg|jpeg|webp)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    for (const b of banned) assert.ok(!s.includes(b), `${f.slice(out.length)} contains ${b}`);
  }
});

test('the real build stays under the same 102,400 byte CSS cap', () => {
  const bytes = walk(out).filter((f) => f.endsWith('.css')).reduce((n, f) => n + statSync(f).size, 0);
  console.log(`  real build CSS: ${bytes} bytes of 102400`);
  assert.ok(bytes > 0 && bytes <= 102400, `${bytes}`);
});

test('each recipe page shows its notes under the steps, one line per note, and the marinate time is the first chicken note', () => {
  const counts = { 'fried-chicken': 5, 'slow-cooker-roast': 4, 'high-protein-brownies': 3 };
  for (const id of IDS) {
    const html = page(`recipe/${id}/index.html`);
    const section = html.match(/<section aria-labelledby="notes-title"[\s\S]*?<\/section>/);
    assert.ok(section, `${id}: Notes section`);
    assert.match(section[0], /<h2 id="notes-title"[^>]*>Notes<\/h2>/);
    assert.equal((section[0].match(/<li/g) ?? []).length, counts[id], `${id}: one line per note`);
    assert.ok(html.indexOf('id="steps"') < html.indexOf('id="notes-title"'), `${id}: notes come after the steps`);
  }
  assert.match(page('recipe/fried-chicken/index.html'), /<li[^>]*>Plus at least 2 hours to marinate, overnight is best\./);
  assert.match(page('recipe/high-protein-brownies/index.html'), /<li[^>]*>Equipment: bowl, whisk/);
});

test('the Done screen says "Dinner\'s ready" for the dinners and "All done" for the brownies (a snack)', () => {
  const heading = (id) => page(`cook/${id}/index.html`).match(/<h2[^>]*id="done-title"[^>]*>([^<]*)<\/h2>/)?.[1];
  assert.equal(heading('fried-chicken'), "Dinner's ready");
  assert.equal(heading('slow-cooker-roast'), "Dinner's ready");
  assert.equal(heading('high-protein-brownies'), 'All done');
});

test('home cards and recipe pages show honest times: the wait next to the minutes, hours from 120 min', () => {
  const home = page('index.html');
  assert.ok(home.includes('60 min +\u00a02\u00a0h\u00a0marinate'));
  assert.ok(home.includes('6 h 25 min'));
  assert.ok(!home.includes('385 min'));
  assert.ok(home.includes('25 min'));
  assert.ok(page('recipe/fried-chicken/index.html').includes('Prep 15 min · Cook 45 min · Plus\u00a02\u00a0h\u00a0marinate · Serves 6'));
  assert.ok(page('recipe/slow-cooker-roast/index.html').includes('Prep 25 min · Cook 6 h · Serves 8'));
  assert.ok(!page('recipe/slow-cooker-roast/index.html').includes('360 min'));
  assert.match(home, /data-minutes="60"/);
  assert.match(home, /data-minutes="385"/);
});
