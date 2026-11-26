import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root, decode, theme, contrast } from './helpers.mjs';
import { realNotes } from '../src/data/recipes.ts';
import { parseState } from '../src/scripts/browse-state.ts';

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
  const images = [...html.matchAll(/<img[^>]*src="([^"]+)"/gi)].map((m) => m[1]).sort();
  assert.deepEqual(images, IDS.map((id) => `/photos/${id}.jpg`), 'each card shows its own photo from the bucket, and no other image');
});

test('the week page offers the real titles with no placeholder line', () => {
  const html = page('week/index.html');
  for (const t of Object.values(TITLES)) assert.ok(html.includes(`>${t}</span>`), t);
  assert.ok(!/placeholder content/.test(html) && !/Example/.test(html));
});

test('every recipe page and cooking page carries the real title, its own photo and no Example badge, no other image, no tags', () => {
  for (const id of IDS) {
    const recipe = page(`recipe/${id}/index.html`);
    assert.ok(recipe.includes(`>${TITLES[id]}</h1>`), id);
    assert.ok(!/>Example</.test(recipe));
    assert.deepEqual([...recipe.matchAll(/<img[^>]*src="([^"]+)"/gi)].map((m) => m[1]), [`/photos/${id}.jpg`], id);
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
  for (const f of files.filter((f) => !/\.(png|ico|woff2?|jpg|jpeg|webp|map)$/.test(f) && !f.includes('/server/'))) {
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

// The gluten-free wording is held until Ed or Kristina confirm each recipe. The only "gluten" left in the build is what we were told to keep:
// the label on two recipe pages, the two lines naming something to buy, and the two untouched source links.
const KEPT = {
  'all-purpose gluten-free flour': ['recipe/fried-chicken/index.html', 'cook/fried-chicken/index.html'],
  'Combine the gluten-free flour, cornstarch': ['recipe/fried-chicken/index.html', 'cook/fried-chicken/index.html'],
  '>Gluten-free per the original recipe<': ['recipe/fried-chicken/index.html', 'recipe/high-protein-brownies/index.html'],
  // The one filter chip, in the Filters sheet on the home page. Its careful wording is pinned by the filter tests below.
  '>Gluten-free per source<': ['index.html'],
  'https://www.mamaknowsglutenfree.com/gluten-free-fried-chicken/': ['recipe/fried-chicken/index.html'],
  'https://www.instructables.com/High-Protein-Gluten-Free-Brownies-That-Actually-Ta/': ['recipe/high-protein-brownies/index.html'],
};

test('no gluten-free claim anywhere in the real build, except exactly the kept ingredient lines and source links', () => {
  // The bundled recipe files repeat the source data, including glutenFreePerSource. The pages are what a person sees.
// The server bundle repeats the source data, including glutenFreePerSource, for the live recipe route. The pages are what a person sees.
const textFiles = walk(out).filter((f) => !/\.(png|ico|woff2?|jpg|jpeg|webp)$/.test(f) && !f.includes('recipe-files_') && !f.includes('/server/'));
  assert.ok(textFiles.length > 10);
  const seen = {};
  for (const f of textFiles) {
    const rel = f.slice(out.length + 1);
    let s = readFileSync(f, 'utf8');
    for (const [k, where] of Object.entries(KEPT)) {
      if (s.includes(k)) (seen[k] ??= []).push(rel);
      if (where.includes(rel)) s = s.split(k).join(''); // strip a kept line only in the file(s) it is allowed in
    }
    assert.ok(!/gluten|\bgf\b/i.test(s), `${rel} still says gluten: ${(s.match(/.{0,40}(gluten|\bgf\b).{0,40}/i) ?? [''])[0]}`);
  }
  for (const [k, where] of Object.entries(KEPT)) assert.deepEqual((seen[k] ?? []).sort(), where.slice().sort(), k);
});

test('the "Gluten-free per the original recipe" label is on the fried chicken and brownies recipe pages only: not the roast, not a card, a list, the week, a cooking page or the search text', () => {
  const label = /<p[^>]*data-role="recipe-label"[^>]*>Gluten-free per the original recipe<\/p>/;
  for (const id of ['fried-chicken', 'high-protein-brownies']) {
    const html = page(`recipe/${id}/index.html`);
    assert.equal((html.match(/data-role="recipe-label"/g) ?? []).length, 1, id);
    assert.match(html, label, id);
    assert.ok(html.indexOf('data-role="recipe-label"') > html.indexOf('<h1'), 'the label comes after the title');
  }
  assert.ok(!/gluten/i.test(page('recipe/slow-cooker-roast/index.html')), 'no gluten text on the roast page');
  for (const id of ['fried-chicken', 'high-protein-brownies']) assert.ok(!page(`recipe/${id}/index.html`).includes('>Gluten-free<'), `${id}: no bare Gluten-free label, it always says per the original recipe`);
  for (const rel of ['index.html', 'week/index.html', 'favorites/index.html', ...IDS.map((id) => `cook/${id}/index.html`)]) {
    let text = page(rel).replace(/(all-purpose gluten-free flour|Combine the gluten-free flour)/g, '');
    if (rel === 'index.html') text = text.split('>Gluten-free per source<').join(''); // the chip text is allowed on the home page only
    assert.ok(!/gluten-free/i.test(text), `${rel} has no Gluten-free text`);
  }
  for (const f of walk(out).filter((f) => !/\.(png|ico|woff2?|jpg|jpeg|webp|map)$/.test(f) && !f.includes('/server/'))) {
    assert.ok(!/verified|certified/i.test(readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '')), `${f.slice(out.length)} has no verified or certified wording`);
  }
});

test('the label is plain small muted text that wraps and is never cut off, and the muted color reads at 4.5:1 in both themes', () => {
  for (const id of ['fried-chicken', 'high-protein-brownies']) {
    const tag = page(`recipe/${id}/index.html`).match(/<p[^>]*data-role="recipe-label"[^>]*>/)[0];
    const cls = tag.match(/class="([^"]*)"/)[1].split(/\s+/).sort();
    assert.deepEqual(cls, ['mt-1', 'text-[13px]', 'text-kk-muted'], `${id}: existing classes only`);
    assert.ok(!/truncate|line-clamp|ellipsis|nowrap|overflow/.test(tag), `${id}: nothing that cuts the text off`);
  }
  const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
  assert.ok(!/\.kk-recipe-label|\[data-role=.recipe-label.\]/.test(css), 'no style rule that could clamp or hide the label');
  for (const [name, t] of [['kk-light', theme('kk-light')], ['kk-dark', theme('kk-dark')]]) {
    const ratio = contrast(t['--kk-muted'], t['--color-base-100']);
    console.log(`  label contrast ${ratio.toFixed(2)}:1  ${name} ${t['--kk-muted']} on ${t['--color-base-100']}`);
    assert.ok(ratio >= 4.5, `${name}: muted text on the page color is ${ratio.toFixed(2)}`);
  }
});

// --- the "Gluten-free per source" filter chip ---------------------------------------------------------------------------------
// It uses only the glutenFreePerSource flag already on a recipe (the flag behind the recipe-page label). Nothing is inferred.
const flaggedIds = realNotes.filter((r) => r.glutenFreePerSource === true).map((r) => r.id).sort();

test('the home page has exactly one Gluten-free per source chip, in the Filters sheet, worded like the label and never a bare Gluten-free', () => {
  const home = page('index.html');
  const chips = home.match(/<button[^>]*data-group="source"[^>]*>[^<]*<\/button>/g) ?? [];
  assert.equal(chips.length, 1);
  assert.match(chips[0], /^<button type="button" class="kk-chip" aria-pressed="false" data-group="source" data-value="stated">Gluten-free per source<\/button>$/);
  assert.equal((home.match(/Gluten-free per source/g) ?? []).length, 1, 'the wording appears once on the page');
  assert.ok(!home.includes('>Gluten-free<') && !/"Gluten-free"/i.test(home) && !/aria-label="[^"]*gluten/i.test(home));
  assert.match(home, /<legend[^>]*>From the source<\/legend>/);
  assert.ok(home.indexOf('data-group="source"') > home.indexOf('<dialog'), 'the chip lives in the Filters sheet with the other chips');
  for (const f of walk(out).filter((f) => !/\.(png|ico|woff2?|jpg|jpeg|webp)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!s.includes('>Gluten-free<') && !/["'`]Gluten-free["'`]/i.test(s), `${f.slice(out.length)} has no bare Gluten-free`);
  }
});

test('the per-source flag marks exactly the flagged recipes on the home page, read from the data: chicken and brownies yes, the roast no', () => {
  assert.deepEqual(flaggedIds, ['fried-chicken', 'high-protein-brownies'], 'the data still flags the same two');
  const home = page('index.html');
  const cards = [...home.matchAll(/<article [^>]*data-example[^>]*>/g)].map((m) => m[0]);
  const marked = cards.filter((c) => /data-source-stated(=|\s|>)/.test(c)).map((c) => c.match(/data-id="([^"]*)"/)[1]).sort();
  assert.deepEqual(marked, flaggedIds);
  const roast = cards.find((c) => c.includes('data-id="slow-cooker-roast"'));
  assert.ok(roast && !roast.includes('data-source-stated'));
  assert.ok(!/data-source-stated/.test(page('week/index.html')));
    const favCards = [...page('favorites/index.html').matchAll(/<article [^>]*data-example[^>]*>/g)].map((m) => m[0]);
    const favMarked = favCards.filter((c) => /data-source-stated(=|\s|>)/.test(c)).map((c) => c.match(/data-id="([^"]*)"/)[1]).sort();
    assert.deepEqual(favMarked, flaggedIds, 'favorites reuses the card, so the same recipes carry the flag');
});

test('the chip stays off when no recipe has the flag: a shared ?source=stated link is ignored when the group has no options', () => {
  // With no flagged recipe the sheet draws no source group, so parseState gets an empty option list for it.
  const noFlag = { meal: ['dinner'], time: ['30'], diet: [], who: [], source: [] };
  assert.deepEqual(parseState('?source=stated', noFlag).source, []);
  assert.deepEqual(parseState('?source=stated&meal=dinner', noFlag), { q: '', meal: ['dinner'], time: [], diet: [], who: [], source: [] });
  assert.deepEqual(parseState('?source=stated', { ...noFlag, source: ['stated'] }).source, ['stated'], 'and it is honoured when the group does exist');
});
