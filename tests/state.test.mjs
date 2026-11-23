import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseState,
  serializeState,
  filterRecipes,
  toggleValue,
  activeFilterCount,
  emptyMessage,
  emptyState,
  createSession,
} from '../src/scripts/browse-state.ts';
import { exampleRecipes, confirmedTags } from '../src/data/examples.ts';

const OPTIONS = {
  meal: ['breakfast', 'lunch', 'dinner'],
  time: ['15', '30', '45'],
  diet: ['Meatless'],
  who: ['favorite', 'ed', 'kristina', 'untried'],
  source: ['stated'],
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
  assert.deepEqual(state, { q: 'tomato', meal: ['lunch', 'dinner'], time: ['30'], diet: ['Meatless'], who: [], source: [] });
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
  assert.deepEqual(names({ q: 'PASTA', meal: [], time: [], diet: [], who: [], source: [] }), ['Weeknight Pasta']);
  assert.deepEqual(names({ q: 'Tomato', meal: [], time: [], diet: [], who: [], source: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: 'rolled', meal: [], time: [], diet: [], who: [], source: [] }), ['Overnight Oats']);
});

test('every word of the search must match a name or an ingredient', () => {
  assert.deepEqual(names({ q: 'tomato garlic', meal: [], time: [], diet: [], who: [], source: [] }), ['Weeknight Pasta']);
  assert.deepEqual(names({ q: 'tomato oats', meal: [], time: [], diet: [], who: [], source: [] }), []);
});

test('filters are AND across groups; meal is any-of, time is loosest-wins', () => {
  assert.deepEqual(names({ q: '', meal: ['lunch', 'dinner'], time: [], diet: [], who: [], source: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: '', meal: ['lunch', 'dinner'], time: ['30'], diet: [], who: [], source: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: '', meal: ['lunch', 'dinner'], time: ['15'], diet: [], who: [], source: [] }), []);
  assert.deepEqual(names({ q: '', meal: [], time: ['15', '30'], diet: ['Meatless'], who: [], source: [] }), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(names({ q: 'tomato', meal: ['dinner'], time: [], diet: [], who: [], source: [] }), ['Weeknight Pasta']);
});

test('a 30-minute recipe (Tomato Soup) appears under the "30 min or less" chip', () => {
  const searchable = exampleRecipes.map((r) => ({ name: r.name, ingredients: [...r.ingredients], meal: r.meal, minutes: r.minutes, diet: confirmedTags(r) }));
  const shown = filterRecipes(searchable, { q: '', meal: [], time: ['30'], diet: [], who: [], source: [] }).map((r) => r.name);
  assert.ok(shown.includes('Tomato Soup'));
  assert.ok(!shown.includes('Sheet-Pan Vegetables'), '40 minutes is not 30 or less');
});

test('toggleValue adds and removes one filter value without touching the rest', () => {
  const s1 = toggleValue({ q: 'x', meal: [], time: [], diet: [], who: [], source: [] }, 'meal', 'dinner', OPTIONS);
  assert.deepEqual(s1, { q: 'x', meal: ['dinner'], time: [], diet: [], who: [], source: [] });
  const s2 = toggleValue(s1, 'meal', 'lunch', OPTIONS);
  assert.deepEqual(s2.meal, ['lunch', 'dinner']);
  assert.deepEqual(toggleValue(s2, 'meal', 'lunch', OPTIONS).meal, ['dinner']);
  assert.equal(activeFilterCount(s2), 2);
  assert.equal(activeFilterCount({ q: 'only search', meal: [], time: [], diet: [], who: [], source: [] }), 0);
});

test('zero-result messages', () => {
  assert.equal(emptyMessage({ q: 'saffron', meal: [], time: [], diet: [], who: [], source: [] }), "No recipe lists 'saffron'");
  assert.equal(emptyMessage({ q: 'saffron', meal: ['dinner'], time: [], diet: [], who: [], source: [] }), "No recipe lists 'saffron' with these filters");
  assert.equal(emptyMessage({ q: '', meal: ['dinner'], time: [], diet: [], who: [], source: [] }), 'No recipes match these filters');
});

test('diet tags combine with "every": a recipe needs ALL the picked tags', () => {
  const options = { meal: [], time: [], diet: ['A', 'B'], who: [], source: [] };
  const fixtures = [
    { name: 'Only A', ingredients: ['x'], meal: 'dinner', minutes: 10, diet: ['A'] },
    { name: 'A and B', ingredients: ['y'], meal: 'dinner', minutes: 10, diet: ['A', 'B'] },
    { name: 'Neither', ingredients: ['z'], meal: 'dinner', minutes: 10, diet: [] },
  ];
  const pick = (diet) => filterRecipes(fixtures, { q: '', meal: [], time: [], diet, who: [], source: [] }).map((r) => r.name);
  assert.deepEqual(pick(['A']), ['Only A', 'A and B']);
  assert.deepEqual(pick(['A', 'B']), ['A and B']);
  assert.deepEqual(pick(['B']), ['A and B']);
  assert.deepEqual(pick([]), ['Only A', 'A and B', 'Neither']);
  assert.deepEqual(toggleValue(toggleValue({ q: '', meal: [], time: [], diet: [], who: [], source: [] }, 'diet', 'B', options), 'diet', 'A', options).diet, ['A', 'B']);
});

// --- tab switches / Back: the session remembers the Recipes URL and the scroll per URL ----------
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] };
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

test('one storage entry only: the last Recipes URL and its scroll', () => {
  const store = fakeStorage();
  const session = createSession(store);
  session.saveRecipesUrl('/?q=pasta');
  session.saveScroll('/?q=pasta', 640.4);
  assert.equal(session.readScroll('/?q=pasta'), 640);
  assert.equal(session.recipesHref(), '/?q=pasta');
  session.saveScroll('/', 120);
  assert.equal(session.readScroll('/'), 120);
  assert.equal(session.readScroll('/?q=pasta'), 0, 'older URLs are forgotten');
  assert.equal(store.keys().length, 1, `one key, got ${store.keys()}`);
  assert.ok(!store.keys().some((k) => k.startsWith('kk:scroll:')), 'no per-URL scroll keys');
});

test('saving the same URL again keeps its scroll; a new URL starts at the top', () => {
  const session = createSession(fakeStorage());
  session.saveScroll('/?q=a', 300);
  session.saveRecipesUrl('/?q=a');
  assert.equal(session.readScroll('/?q=a'), 300);
  session.saveRecipesUrl('/?q=b');
  assert.equal(session.readScroll('/?q=b'), 0);
});

test('a poisoned or garbled entry falls back to "/" and the top', () => {
  for (const raw of ['garbage', '{"url":"//evil.example/","y":5}', '{"url":"/?q=a","y":"NaN"}', '{"url":"/?q=a","y":-50}', 'null']) {
    const store = fakeStorage();
    store.setItem('kk:recipes', raw);
    const session = createSession(store);
    const okUrl = raw.includes('"/?q=a"');
    assert.equal(session.recipesHref(), okUrl ? '/?q=a' : '/', raw);
    assert.equal(session.readScroll('/?q=a'), 0, raw);
  }
});

test('session survives storage that throws (private mode)', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const session = createSession(broken);
  session.saveRecipesUrl('/?q=a');
  session.saveScroll('/', 5);
  assert.equal(session.recipesHref(), '/');
  assert.equal(session.readScroll('/'), 0);
});

// --- "Who liked it" rating filter -------------------------------------------------------------
const rated = [
  { id: 'r-pasta', name: 'Weeknight Pasta', ingredients: ['tomato'], meal: 'dinner', minutes: 25, diet: [] },
  { id: 'r-soup', name: 'Tomato Soup', ingredients: ['tomato'], meal: 'lunch', minutes: 30, diet: [] },
  { id: 'r-oats', name: 'Overnight Oats', ingredients: ['oats'], meal: 'breakfast', minutes: 10, diet: [] },
  { id: 'r-rice', name: 'Lemon Rice', ingredients: ['rice'], meal: 'lunch', minutes: 20, diet: [] },
];
const at = (value) => ({ value, at: 1 });
const ratings = {
  'r-pasta': { ed: at('loved'), kristina: at('loved') }, // Family favorite
  'r-soup': { ed: at('loved') },
  'r-oats': { kristina: at('loved'), ed: at('not-for-us') },
  // r-rice: nobody has rated it
};
const whoNames = (who, extra = {}, r = ratings) =>
  filterRecipes(rated, { q: '', meal: [], time: [], diet: [], who, source: [], ...extra }, r).map((x) => x.name);

test('who: address round trip in canonical order; unknown values are dropped', () => {
  const state = parseState('?who=untried,bob,ed&diet=Meatless&q=x&meal=lunch', OPTIONS);
  assert.deepEqual(state.who, ['ed', 'untried']);
  assert.equal(serializeState(state, OPTIONS), '?q=x&meal=lunch&diet=Meatless&who=ed%2Cuntried', 'who comes last, in option order');
  assert.deepEqual(parseState(serializeState(state, OPTIONS), OPTIONS), state);
  assert.deepEqual(parseState('?who=bob,%3Cscript%3E', OPTIONS).who, []);
  assert.equal(serializeState(parseState('?who=favorite&who=ed', OPTIONS), OPTIONS), '?who=favorite', 'first who parameter only');
});

test('who: toggling and counting', () => {
  const s1 = toggleValue({ q: '', meal: [], time: [], diet: [], who: [], source: [] }, 'who', 'untried', OPTIONS);
  const s2 = toggleValue(s1, 'who', 'favorite', OPTIONS);
  assert.deepEqual(s2.who, ['favorite', 'untried']);
  assert.equal(activeFilterCount(s2), 2);
  assert.deepEqual(toggleValue(s2, 'who', 'favorite', OPTIONS).who, ['untried']);
});

test('who: Family favorites shows only recipes both people loved', () => {
  assert.deepEqual(whoNames(['favorite']), ['Weeknight Pasta']);
});

test('who: "Ed loved it" / "Kristina loved it" / "Not tried yet"', () => {
  assert.deepEqual(whoNames(['ed']), ['Weeknight Pasta', 'Tomato Soup']);
  assert.deepEqual(whoNames(['kristina']), ['Weeknight Pasta', 'Overnight Oats']);
  assert.deepEqual(whoNames(['untried']), ['Lemon Rice']);
});

test('who: several picks mean any of them; different groups still all have to match', () => {
  assert.deepEqual(whoNames(['ed', 'kristina']), ['Weeknight Pasta', 'Tomato Soup', 'Overnight Oats']);
  assert.deepEqual(whoNames(['ed', 'untried']), ['Weeknight Pasta', 'Tomato Soup', 'Lemon Rice']);
  assert.deepEqual(whoNames(['ed', 'kristina'], { meal: ['lunch'] }), ['Tomato Soup']);
  assert.deepEqual(whoNames(['favorite'], { meal: ['lunch'] }), []);
  assert.deepEqual(filterRecipes(rated, { q: 'tomato', meal: [], time: [], diet: [], who: ['ed'], source: [] }, ratings).map((x) => x.name), ['Weeknight Pasta', 'Tomato Soup']);
});

test('who: an empty "no ratings yet" store and an unavailable store (null) both keep browsing working', () => {
  assert.deepEqual(whoNames([], {}, null), ['Weeknight Pasta', 'Tomato Soup', 'Overnight Oats', 'Lemon Rice']);
  assert.deepEqual(whoNames(['favorite'], {}, {}), [], 'nothing is a favorite yet');
  assert.equal(whoNames(['untried'], {}, {}).length, 4, 'everything is untried yet');
  assert.equal(whoNames(['favorite'], {}, null).length, 4, 'ratings unavailable: the rating filter is not applied');
});

// --- "per source" filter: uses only the recipe's own sourceStated flag (the glutenFreePerSource flag on the page side) -----------
const sourced = [
  { id: 's-chicken', name: 'Fried Chicken', ingredients: ['chicken'], meal: 'dinner', minutes: 60, diet: [], sourceStated: true },
  { id: 's-brownies', name: 'Brownies', ingredients: ['cocoa'], meal: 'snack', minutes: 25, diet: [], sourceStated: true },
  { id: 's-roast', name: 'Roast', ingredients: ['pork'], meal: 'dinner', minutes: 385, diet: [] },
  { id: 's-other', name: 'Other', ingredients: ['pork'], meal: 'dinner', minutes: 20, diet: [], sourceStated: false },
];
const sourceNames = (extra = {}) => filterRecipes(sourced, { ...emptyState(), source: ['stated'], ...extra }).map((r) => r.id);

test('source: address round trip; unknown values are dropped; empty state stays empty', () => {
  const state = parseState('?source=stated&meal=dinner&q=chick', OPTIONS);
  assert.deepEqual(state, { q: 'chick', meal: ['dinner'], time: [], diet: [], who: [], source: ['stated'] });
  assert.equal(serializeState(state, OPTIONS), '?q=chick&meal=dinner&source=stated');
  assert.deepEqual(parseState('?source=yes,stated,gluten', OPTIONS).source, ['stated']);
  assert.deepEqual(parseState('?source=gluten-free', OPTIONS).source, []);
  assert.equal(serializeState(parseState('?source=bogus', OPTIONS), OPTIONS), '');
  assert.deepEqual(emptyState().source, []);
});

test('source: only a recipe whose flag is exactly true matches; missing and false do not', () => {
  assert.deepEqual(sourceNames(), ['s-chicken', 's-brownies']);
  assert.deepEqual(filterRecipes(sourced, emptyState()).map((r) => r.id), ['s-chicken', 's-brownies', 's-roast', 's-other'], 'no chip: everything shows');
  const odd = [{ id: 'x', name: 'X', ingredients: [], meal: 'dinner', minutes: 5, diet: ['gluten-free'], sourceStated: 'true' }];
  assert.deepEqual(filterRecipes(odd, { ...emptyState(), source: ['stated'] }), [], 'a string or a diet tag is not the flag');
});

test('source: combines with every other filter and with search (AND)', () => {
  assert.deepEqual(sourceNames({ meal: ['snack'] }), ['s-brownies']);
  assert.deepEqual(sourceNames({ time: ['30'] }), ['s-brownies']);
  assert.deepEqual(sourceNames({ q: 'chick' }), ['s-chicken']);
  assert.deepEqual(sourceNames({ q: 'pork' }), [], 'the roast matches the search but not the flag');
  assert.deepEqual(sourceNames({ meal: ['snack'], q: 'chick' }), []);
});

test('source: toggling adds and removes it, counts as one active filter, and leaves the others alone', () => {
  const on = toggleValue({ ...emptyState(), q: 'x', meal: ['dinner'] }, 'source', 'stated', OPTIONS);
  assert.deepEqual(on.source, ['stated']);
  assert.equal(activeFilterCount(on), 2);
  assert.deepEqual(on.meal, ['dinner']);
  const off = toggleValue(on, 'source', 'stated', OPTIONS);
  assert.deepEqual(off.source, []);
  assert.equal(activeFilterCount(off), 1);
  assert.equal(toggleValue(emptyState(), 'source', 'bogus', OPTIONS).source.length, 0, 'unknown value is not kept');
});

test('source: zero results reuse the generic messages and never make a gluten-free claim', () => {
  const s = { ...emptyState(), source: ['stated'] };
  assert.equal(emptyMessage(s), 'No recipes match these filters');
  assert.equal(emptyMessage({ ...s, q: 'pork' }), "No recipe lists 'pork' with these filters");
  assert.ok(!/gluten/i.test(emptyMessage(s)));
});
