import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allExampleNotes, exampleRecipes } from '../src/data/examples.ts';
import { filterRecipes, emptyState } from '../src/scripts/browse-state.ts';
import { isValidId, isFamilyFavorite, ratingOf } from '../src/scripts/ratings.ts';
import { read } from './helpers.mjs';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

test('every recipe has a fixed, unique id field that is not made from its title', () => {
  const ids = allExampleNotes.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const r of allExampleNotes) {
    assert.ok(isValidId(r.id), `${r.id} is a valid rating key`);
    assert.match(r.id, /^example-\d+$/, 'a plain counter id, written by hand in the data');
    assert.notEqual(r.id, slug(r.name), 'the id is not the slugged title');
    assert.ok(!r.id.includes(slug(r.name)), 'the title is not inside the id');
  }
});

test('the data file never derives an id from a title', () => {
  const src = read('src/data/examples.ts');
  assert.ok(!/id:\s*[^'\n]*name/.test(src), 'no id built from name');
  assert.ok(!/slug|toLowerCase|replace\(/.test(src), 'no slug helper in the data');
});

test('renaming a recipe keeps its id, so its ratings and Family favorite stay attached', () => {
  const ratings = { 'example-1': { ed: { value: 'loved', at: 1 }, kristina: { value: 'loved', at: 2 } } };
  const original = exampleRecipes.map((r) => ({ ...r, diet: [] }));
  const renamed = original.map((r) => (r.id === 'example-1' ? { ...r, name: 'A Completely New Title' } : r));
  const state = { ...emptyState(), who: ['favorite'] };
  assert.deepEqual(filterRecipes(original, state, ratings).map((r) => r.id), ['example-1']);
  assert.deepEqual(filterRecipes(renamed, state, ratings).map((r) => r.id), ['example-1']);
  assert.equal(renamed.find((r) => r.id === 'example-1').name, 'A Completely New Title');
  assert.ok(isFamilyFavorite(ratings, 'example-1'));
  assert.equal(ratingOf(ratings, 'example-1', 'ed'), 'loved');
});

test('the built cards carry the id separately from the title', () => {
  const html = read('dist/index.html');
  for (const r of exampleRecipes) {
    assert.match(html, new RegExp(`data-id="${r.id}"[^>]*data-name="${r.name.replace(/[-]/g, '\\-')}"`));
  }
});
