import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { read, decode, distFiles } from './helpers.mjs';
import { exampleRecipes, exampleTitle, EXAMPLE_PREFIX } from '../src/data/examples.ts';

const home = decode(read('dist/index.html'));
const cssFile = distFiles().find((f) => f.endsWith('.css'));
const source = read('src/styles/global.css');
const css = decode(readFileSync(cssFile, 'utf8'));

test('dock has 3 labelled tabs, one active, icons hidden from AT', () => {
  const nav = home.match(/<nav class="dock kk-dock" aria-label="Main">([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'dock nav with aria-label');
  const tabs = [...nav[1].matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(tabs.length, 3);
  const labels = tabs.map((t) => t[1].match(/<span class="dock-label">([^<]+)<\/span>/)?.[1]);
  assert.deepEqual(labels, ['Recipes', 'Week', 'Favorites']);
  assert.equal([...nav[1].matchAll(/aria-current="page"/g)].length, 1);
  assert.equal([...nav[1].matchAll(/<svg [^>]*aria-hidden="true"/g)].length, 3);
  assert.equal([...nav[1].matchAll(/dock-active/g)].length, 1);
});

test('tab targets are at least 44px tall', () => {
  // 3.5rem = 56px, set in the source stylesheet (built CSS formatting is the minifier's business)
  assert.match(source.match(/\.kk-dock\s*>\s*a\s*\{[^}]*\}/)?.[0] ?? '', /min-height:\s*3\.5rem/);
  assert.match(home, /input[^>]*min-h-11/); // 44px
  assert.match(home, /<button[^>]*h-11[^>]*min-w-11/); // Filters, 44px
});

test('search input: 16px font, hint text, Filters control labelled', () => {
  const input = home.match(/<input[^>]*id="search-input"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /placeholder="Search recipes"/);
  assert.match(input, /aria-label="Search recipes"/);
  assert.match(input, /text-\[16px\]/);
  assert.match(css, /text-\\\[16px\\\][^}]*font-size:\s*16px/);
  const filters = home.match(/<button[^>]*id=\"filters-button\"[^>]*>\s*<svg[\s\S]*?<\/svg>\s*Filters\s*<span/)?.[0];
  assert.ok(filters, 'Filters button exists with visible label');
  assert.match(home, /<button[^>]*id="filters-button"[^>]*aria-label="Filters"/, 'plain aria-label when no filter is active');
  assert.ok(!/aria-disabled/.test(filters), 'Filters works now (branch 2)');
  assert.match(filters, /\bh-11\b/, '44px tall');
});

test('safe-area padding is present for the bottom bar', () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('example data: 6 clearly fake recipes, no real recipe or gluten-free claims', () => {
  assert.equal(exampleRecipes.length, 6);
  for (const r of exampleRecipes) assert.ok(exampleTitle(r).startsWith(EXAMPLE_PREFIX));
  const blob = JSON.stringify(exampleRecipes) + home;
  assert.ok(!/fried chicken|gluten|keto|vegetarian|dairy/i.test(blob));
});

test('every card is labeled Example and the count text is "6 recipes"', () => {
  const cards = [...home.matchAll(/<article [^>]*data-example[\s\S]*?<\/article>/g)].map((m) => m[0]);
  assert.equal(cards.length, 6);
  for (const c of cards) {
    assert.match(c, /<span class="badge[^"]*"[^>]*>Example<\/span>/);
    assert.match(c, /Example recipe: /);
    assert.equal([...c.matchAll(/class="badge/g)].length, 1, 'one badge per card');
  }
  assert.match(home, />6 recipes</);
});
