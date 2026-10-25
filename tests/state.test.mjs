import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseState,
  serializeState,
  filterRecipes,
  toggleValue,
  activeFilterCount,
  emptyMessage,
  createSession,
} from '../src/scripts/browse-state.ts';

const OPTIONS = {
  meal: ['breakfast', 'lunch', 'dinner'],
  time: ['15', '30', '45'],
  diet: ['Meatless'],
};

const recipes = [
  { name: 'Weeknight Pasta', ingredients: ['spaghetti', 'tomato', 'garlic'], meal: 'dinner', minutes: 25, diet: ['Meatless'] },
  { name: 'Tomato Soup', ingredients: ['tomato', 'onion', 'basil'], meal: 'lunch', minutes: 30, diet: ['Meatless'] },
  { name: 'Overnight Oats', ingredients: ['rolled oats', 'milk'], meal: 'breakfast', minutes: 10, diet: [] },
];
const names = (state) => filterRecipes(recipes, state).map((r) => r.name);

// --- shared link / refresh: URL <-> state round trip -------------------------------------------
test('state round-trips through the address (refresh and shared link give the same results)', () => {
  const link = '?q=tomato&meal=lunch,dinner&time=30&diet=Meatless';
  const state = parseState(link, OPTIONS);
  assert.deepEqual(state, { q: 'tomato', meal: ['lunch', 'dinner'], time: ['30'], diet: ['Meatless'] });
  assert.equal(serializeState(state, OPTIONS), '?q=tomato&meal=lunch%2Cdinner&time=30&diet=Meatless');
  const again = parseState(serializeState(state, OPTIONS), OPTIONS);
  assert.deepEqual(again, state);
  assert.deepEqual(names(again), names(state));
});

test('serialization is canonical: param order and option order in a shared link do not matter', () => {
  const a = parseState('?meal=dinner,lunch&q=x', OPTIONS);
  const b = parseState('?q=x&meal=lunch,dinner', OPTIONS);
  assert.equal(serializeState(a, OPTIONS), serializeState(b, OPTIONS));
});

test('empty state serializes to an empty string', () => {
  assert.equal(serializeState(parseState('', OPTIONS), OPTIONS), '');
  assert.equal(serializeState(parseState('?q=%20%20', OPTIONS), OPTIONS), '');
});

test('unknown params and values from a hand-edited link are dropped; q is capped', () => {
  const s = parseState('?meal=dinner,brunch&time=999&diet=Gluten&evil=1&q=' + 'a'.repeat(500), OPTIONS);
  assert.deepEqual(s.meal, ['dinner']);
  assert.deepEqual(s.time, []);
  assert.deepEqual(s.diet, []);
  assert.equal(s.q.length, 100);
});

// --- filter logic ---------------------------------------------------------------------------------
test('search matches names and ingredients, case-insensitively', () => {
  assert.deepEqual(names({ q: 'PASTA', meal: [], time: [], diet: [] }), ['Weeknight Pasta']);
  assert.deepEqual(names({ q: 'Tomato', meal: [], time: [], diet: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: 'rolled', meal: [], time: [], diet: [] }), ['Overnight Oats']);
});

test('every word of the search must match a name or an ingredient', () => {
  assert.deepEqual(names({ q: 'tomato garlic', meal: [], time: [], diet: [] }), ['Weeknight Pasta']);
  assert.deepEqual(names({ q: 'tomato oats', meal: [], time: [], diet: [] }), []);
});

test('filters are AND across groups; meal is any-of, time is loosest-wins', () => {
  assert.deepEqual(names({ q: '', meal: ['lunch', 'dinner'], time: [], diet: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: '', meal: ['lunch', 'dinner'], time: ['30'], diet: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: '', meal: ['lunch', 'dinner'], time: ['15'], diet: [] }), []);
  assert.deepEqual(names({ q: '', meal: [], time: ['15', '30'], diet: ['Meatless'] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: 'tomato', meal: ['dinner'], time: [], diet: [] }), ['Weeknight Pasta']);
});

test('toggleValue adds and removes one filter value without touching the rest', () => {
  const s1 = toggleValue({ q: 'x', meal: [], time: [], diet: [] }, 'meal', 'dinner', OPTIONS);
  assert.deepEqual(s1, { q: 'x', meal: ['dinner'], time: [], diet: [] });
  const s2 = toggleValue(s1, 'meal', 'lunch', OPTIONS);
  assert.deepEqual(s2.meal, ['lunch', 'dinner']);
  assert.deepEqual(toggleValue(s2, 'meal', 'lunch', OPTIONS).meal, ['dinner']);
  assert.equal(activeFilterCount(s2), 2);
  assert.equal(activeFilterCount({ q: 'only search', meal: [], time: [], diet: [] }), 0);
});

test('zero-result messages', () => {
  assert.equal(emptyMessage({ q: 'saffron', meal: [], time: [], diet: [] }), "No recipe lists 'saffron'");
  assert.equal(emptyMessage({ q: 'saffron', meal: ['dinner'], time: [], diet: [] }), "No recipe lists 'saffron' with these filters");
  assert.equal(emptyMessage({ q: '', meal: ['dinner'], time: [], diet: [] }), 'No recipes match these filters');
});

test('diet tags combine with "every": a recipe needs ALL the picked tags', () => {
  const options = { meal: [], time: [], diet: ['A', 'B'] };
  const fixtures = [
    { name: 'Only A', ingredients: ['x'], meal: 'dinner', minutes: 10, diet: ['A'] },
    { name: 'A and B', ingredients: ['y'], meal: 'dinner', minutes: 10, diet: ['A', 'B'] },
    { name: 'Neither', ingredients: ['z'], meal: 'dinner', minutes: 10, diet: [] },
  ];
  const pick = (diet) => filterRecipes(fixtures, { q: '', meal: [], time: [], diet }).map((r) => r.name);
  assert.deepEqual(pick(['A']), ['Only A', 'A and B']);
  assert.deepEqual(pick(['A', 'B']), ['A and B']);
  assert.deepEqual(pick(['B']), ['A and B']);
  assert.deepEqual(pick([]), ['Only A', 'A and B', 'Neither']);
  assert.deepEqual(toggleValue(toggleValue({ q: '', meal: [], time: [], diet: [] }, 'diet', 'B', options), 'diet', 'A', options).diet, ['A', 'B']);
});

// --- tab switches / Back: the session remembers the Recipes URL and the scroll per URL ----------
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('Recipes tab returns to the last search/filters; plain "/" when nothing is stored', () => {
  const session = createSession(fakeStorage());
  assert.equal(session.recipesHref(), '/');
  session.saveRecipesUrl('/?q=pasta&meal=dinner');
  assert.equal(session.recipesHref(), '/?q=pasta&meal=dinner');
  session.saveRecipesUrl('/');
  assert.equal(session.recipesHref(), '/');
});

test('a stored Recipes URL can never point off-site or to another page', () => {
  for (const bad of ['//evil.example/', 'https://evil.example/', '/week/', 'javascript:alert(1)', '/\\evil', '']) {
    const session = createSession(fakeStorage());
    session.saveRecipesUrl(bad);
    assert.equal(session.recipesHref(), '/', `rejects ${JSON.stringify(bad)}`);
  }
});

test('scroll is remembered per URL and bad values fall back to the top', () => {
  const store = fakeStorage();
  const session = createSession(store);
  session.saveScroll('/?q=pasta', 640.4);
  session.saveScroll('/', 120);
  assert.equal(session.readScroll('/?q=pasta'), 640);
  assert.equal(session.readScroll('/'), 120);
  assert.equal(session.readScroll('/?q=other'), 0);
  store.setItem('kk:scroll:/?q=bad', 'NaN');
  assert.equal(session.readScroll('/?q=bad'), 0);
  store.setItem('kk:scroll:/?q=neg', '-50');
  assert.equal(session.readScroll('/?q=neg'), 0);
});

test('session survives storage that throws (private mode)', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const session = createSession(broken);
  session.saveRecipesUrl('/?q=a');
  session.saveScroll('/', 5);
  assert.equal(session.recipesHref(), '/');
  assert.equal(session.readScroll('/'), 0);
});
