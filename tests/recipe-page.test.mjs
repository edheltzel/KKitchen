import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { allExampleNotes, exampleRecipes, exampleTitle, flatItems, recipeMeta, confirmedTags } from '../src/data/examples.ts';
import { readFileSync } from 'node:fs';
import { root, read, decode, distFiles } from './helpers.mjs';

const page = (r) => decode(read(`dist/recipe/${r.id}/index.html`));

test('one static page per approved recipe, and none for a note that is not approved', () => {
  const built = readdirSync(join(root, 'dist/recipe')).sort();
  assert.deepEqual(built, exampleRecipes.map((r) => r.id).sort());
  for (const r of allExampleNotes.filter((n) => !n.approved)) {
    assert.ok(!existsSync(join(root, 'dist/recipe', r.id)), `${r.id} has no page`);
  }
});

test('every page is noindex, has the title, meta line, and only confirmed tags', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.match(html, new RegExp(`<h1[^>]*>${exampleTitle(r)}</h1>`));
    assert.ok(html.includes(recipeMeta(r)), `${r.id}: meta line`);
    for (const tag of r.tags) assert.equal(html.includes(`>${tag.label}<`), confirmedTags(r).includes(tag.label), `${r.id}: tag ${tag.label}`);
    assert.ok(!/Hidden Draft Note/.test(html));
  }
});

test('ingredients: one tick box per item in its group, labelled by its text, saved by item id', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    const boxes = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => m[0]);
    assert.deepEqual(boxes.map((b) => b.match(/data-item="([^"]+)"/)[1]), flatItems(r).map((i) => i.id), `${r.id}: item ids in page order`);
    for (const item of flatItems(r)) assert.ok(html.includes(item.text), `${r.id}: ${item.text}`);
    for (const g of r.groups) if (g.title) assert.match(html, new RegExp(`<h3[^>]*>${g.title}</h3>`));
    assert.match(html, /<button[^>]*id="reset-ticks"[^>]*>Reset checks<\/button>/);
  }
});

test('steps are one numbered list in order', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    const list = html.match(/<ol[^>]*id="steps"[^>]*>([\s\S]*?)<\/ol>/);
    assert.ok(list, `${r.id}: steps list`);
    const items = [...list[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    assert.deepEqual(items, r.steps.map((s) => s.text));
  }
});

test('the original-recipe link appears only when the data has a source, in a new tab with noopener noreferrer', () => {
  let withSource = 0;
  for (const r of exampleRecipes) {
    const html = page(r);
    const links = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).filter((a) => /href="https?:/.test(a));
    if (!r.source) {
      assert.deepEqual(links, [], `${r.id}: no external link`);
      continue;
    }
    withSource++;
    assert.equal(links.length, 1);
    assert.ok(links[0].includes(`href="${r.source}"`));
    assert.match(links[0], /target="_blank"/);
    assert.match(links[0], /rel="noopener noreferrer"/);
    assert.match(html, />Original recipe/);
  }
  assert.ok(withSource > 0 && withSource < exampleRecipes.length, 'some recipes have a source and some do not');
});

test('the page reuses the rating buttons, the Ed/Kristina picker, the plan button and sheet, banners and the shared Undo bar', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    assert.match(html, new RegExp(`<article[^>]*data-id="${r.id}"`));
    assert.match(html, /data-me="ed"[^>]*>I'm Ed</);
    assert.match(html, /data-me="kristina"[^>]*>I'm Kristina</);
    assert.match(html, /data-rating="loved"[^>]*>Loved it</);
    assert.match(html, /data-rating="not-for-us"[^>]*>Not for us</);
    assert.match(html, /data-role="plan"/);
    assert.match(html, /id="plan-sheet"/);
    for (const id of ['ratings-unavailable', 'ratings-retry', 'week-unavailable', 'week-retry', 'ticks-unavailable', 'ticks-retry', 'undo-bar', 'undo-text', 'undo-button', 'plan-live']) {
      assert.match(html, new RegExp(`id="${id}"`), `${r.id}: #${id}`);
    }
    assert.ok(!/Start cooking/.test(html), 'Start cooking comes with the cooking branch');
  }
});

test('the Back link starts as a link to the Recipes list, and the Recipes tab is the current tab', () => {
  const html = page(exampleRecipes[0]);
  assert.match(html, /<a [^>]*id="back"[^>]*href="\/"|<a [^>]*href="\/"[^>]*id="back"/);
  assert.match(html, /data-tab="recipes"[^>]*>|aria-current="page"/);
});

test('cards on the home page link to their recipe page, once each, from the title', () => {
  const html = decode(read('dist/index.html'));
  for (const r of exampleRecipes) {
    const links = html.match(new RegExp(`<a [^>]*href="/recipe/${r.id}/"`, 'g')) ?? [];
    assert.equal(links.length, 1, `${r.id}: one link`);
  }
  assert.ok(!/href="\/recipe\/example-7\//.test(html));
});

test('the page works without any name, id or title being invented: ids come from the data', () => {
  for (const r of exampleRecipes) assert.match(r.id, /^example-\d+$/);
});

test('nothing under dist/recipe (any file, any depth) mentions the unapproved note or its tag, ingredient or step', () => {
  const files = distFiles(join(root, 'dist/recipe'));
  assert.ok(files.length >= exampleRecipes.length, `scanned ${files.length} files`);
  for (const file of files) {
    const buf = readFileSync(file);
    if (buf.includes(0)) continue;
    const text = buf.toString('utf8').toLowerCase();
    for (const secret of ['Hidden Draft Note', 'Draft-only', 'saffron', 'Draft only.', 'example-7']) {
      assert.ok(!text.includes(secret.toLowerCase()), `${file}: ${secret}`);
    }
  }
});

test('page order: title, meta, tags, ONE row of the three actions, then ingredients and steps, then the who-and-status block and the source link', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    const at = (needle) => {
      const i = html.indexOf(needle);
      assert.ok(i >= 0, `${r.id}: ${needle}`);
      return i;
    };
    const order = [at('<h1'), at('class="kk-actions"'), at('id="ingredients-title"'), at('id="steps-title"'), at('id="ratings-title"'), at('data-person="ed"'), at('id="me-picker"')];
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${r.id}: order ${order}`);
    if (r.source) assert.ok(at('class="kk-source"') > at('id="me-picker"'), `${r.id}: source link last`);
    const actions = html.match(/<div class="kk-actions"[\s\S]*?<\/div>/)[0];
    assert.deepEqual([...actions.matchAll(/data-rating="([^"]+)"|data-role="(plan)"/g)].map((m) => m[1] ?? m[2]), ['loved', 'not-for-us', 'plan'], `${r.id}: one row, in order`);
    assert.equal([...html.matchAll(/data-person="ed"/g)].length, 1, 'one status line per person');
  }
});

test('the in-place Ed / Kristina row is hidden until needed, sits right after the actions, and names both people', () => {
  const html = page(exampleRecipes[0]);
  const inline = html.match(/<fieldset id="me-inline"[^>]*>[\s\S]*?<\/fieldset>/)[0];
  assert.match(inline, /^<fieldset id="me-inline" hidden/);
  assert.match(inline, /data-me="ed"[^>]*>I'm Ed</);
  assert.match(inline, /data-me="kristina"[^>]*>I'm Kristina</);
  assert.ok(html.indexOf('id="me-inline"') > html.indexOf('class="kk-actions"') && html.indexOf('id="me-inline"') < html.indexOf('id="ingredients-title"'));
});
