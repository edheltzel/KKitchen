import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allExampleNotes, exampleRecipes, recipeMeta, flatItems, formatMinutes, cardTime } from '../src/data/examples.ts';
import { isValidId } from '../src/scripts/ratings.ts';

const ITEM_ID = /^[a-z][a-z0-9-]{0,39}$/;

test('every example has prep, cook, serves, ingredient groups and numbered steps', () => {
  for (const r of allExampleNotes) {
    assert.ok(Number.isInteger(r.prep) && r.prep > 0, `${r.id} prep`);
    assert.ok(Number.isInteger(r.cook) && r.cook >= 0, `${r.id} cook`);
    assert.ok(Number.isInteger(r.serves) && r.serves > 0, `${r.id} serves`);
    assert.equal(r.prep + r.cook, r.minutes, `${r.id}: prep + cook is the total minutes shown on the card`);
    assert.ok(r.groups.length > 0 && r.steps.length > 0, `${r.id} groups and steps`);
  }
});

test('ingredient item ids are hand-written, valid and unique within a recipe (they are the tick keys)', () => {
  for (const r of allExampleNotes) {
    const ids = flatItems(r).map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${r.id}: item ids unique`);
    for (const id of ids) assert.match(id, ITEM_ID, `${r.id}/${id}`);
    assert.ok(isValidId(r.id));
  }
});

test('the search keywords and the displayed items agree: every keyword is in some item line', () => {
  for (const r of allExampleNotes) {
    const lines = flatItems(r).map((i) => i.text.toLowerCase());
    for (const word of r.ingredients) assert.ok(lines.some((l) => l.includes(word.toLowerCase())), `${r.id}: ${word}`);
  }
});

test('steps are short plain lines: no stories, no blog text', () => {
  for (const r of allExampleNotes) {
    for (const s of r.steps) {
      assert.ok(s.text.length > 0 && s.text.length <= 120, `${r.id}: step length ${s.text.length}`);
      assert.ok(!/\n/.test(s.text));
    }
    for (const i of flatItems(r)) assert.ok(i.text.length <= 60, `${r.id}/${i.id}`);
  }
});

test('a source link exists only on some examples, and is always a plain https example.com address', () => {
  const withSource = exampleRecipes.filter((r) => r.source);
  assert.ok(withSource.length >= 1 && withSource.length < exampleRecipes.length, 'some have one, some do not');
  for (const r of withSource) assert.match(r.source, /^https:\/\/example\.com\/[a-z0-9-]+$/);
});

test('the meta line says prep, cook and serves, and says so when nothing is cooked', () => {
  const pasta = exampleRecipes.find((r) => r.id === 'example-1');
  assert.equal(recipeMeta(pasta), 'Prep 10 min · Cook 15 min · Serves 4');
  const oats = exampleRecipes.find((r) => r.id === 'example-4');
  assert.equal(recipeMeta(oats), 'Prep 10 min · No cooking · Serves 2');
});

test('this data adds no gluten-free (or any new diet) claim', () => {
  assert.ok(!/gluten|fried chicken|keto|vegan/i.test(JSON.stringify(allExampleNotes).split('"glutenFreePerSource":true').join('')), 'only the fixture flag key may say gluten');
  assert.deepEqual([...new Set(allExampleNotes.flatMap((n) => n.tags.map((t) => t.label)))].sort(), ['Draft-only', 'Meatless', 'Nut-free']);
});

test('a step may mark the ingredients it uses (ids of that recipe, no repeats); some do, some do not', () => {
  const marked = [];
  for (const r of allExampleNotes) {
    const ids = new Set(flatItems(r).map((i) => i.id));
    for (const [n, s] of r.steps.entries()) {
      if (s.uses === undefined) continue;
      assert.ok(Array.isArray(s.uses) && s.uses.length > 0, `${r.id} step ${n + 1}: uses is omitted or lists something`);
      assert.equal(new Set(s.uses).size, s.uses.length, `${r.id} step ${n + 1}: no repeats`);
      for (const id of s.uses) assert.ok(ids.has(id), `${r.id} step ${n + 1}: unknown item ${id}`);
      marked.push(r.id);
    }
  }
  assert.ok(marked.length >= 3, 'some steps mark their ingredients');
  const recipesWithMarks = new Set(marked);
  assert.ok(exampleRecipes.some((r) => !recipesWithMarks.has(r.id)), 'one whole recipe has no marks: its steps show no "Use now"');
  assert.ok(exampleRecipes.some((r) => r.steps.some((s) => s.uses) && r.steps.some((s) => !s.uses)), 'one recipe marks only some of its steps');
});

test('the meta line leaves the prep out when the note gives no prep time, so it never claims "Prep 0 min"', () => {
  const base = exampleRecipes[0];
  assert.equal(recipeMeta({ ...base, prep: 0, cook: 25, serves: 8 }), 'Cook 25 min · Serves 8');
  assert.equal(recipeMeta({ ...base, prep: 0, cook: 0, serves: 2 }), 'No cooking · Serves 2');
});

test('formatMinutes: minutes up to 119, hours from 120 (120 is "2 h")', () => {
  const cases = [[0, '0 min'], [1, '1 min'], [45, '45 min'], [119, '119 min'], [120, '2 h'], [121, '2 h 1 min'], [125, '2 h 5 min'], [180, '3 h'], [360, '6 h'], [385, '6 h 25 min'], [480, '8 h'], [1450, '24 h 10 min']];
  for (const [n, text] of cases) assert.equal(formatMinutes(n), text, String(n));
});

test('a wait (marinate, chill) is shown after the active time: "+ 2 h marinate" on the card, "Plus 2 h marinate" in the meta line, and only when set', () => {
  const base = exampleRecipes[0];
  const waiting = { ...base, prep: 15, cook: 45, minutes: 60, serves: 6, wait: '2 h marinate' };
  assert.equal(cardTime(waiting), '60 min +\u00a02\u00a0h\u00a0marinate');
  assert.equal(recipeMeta(waiting), 'Prep 15 min · Cook 45 min · Plus\u00a02\u00a0h\u00a0marinate · Serves 6');
  const plain = { ...waiting, wait: undefined };
  assert.equal(cardTime(plain), '60 min');
  assert.equal(recipeMeta(plain), 'Prep 15 min · Cook 45 min · Serves 6');
  assert.equal(cardTime({ ...plain, minutes: 385 }), '6 h 25 min');
  assert.equal(recipeMeta({ ...plain, prep: 25, cook: 360, serves: 8 }), 'Prep 25 min · Cook 6 h · Serves 8');
});

// FIXTURE ONLY: two example recipes carry the flag so the filter tests have a positive and a negative case. It is example data, not a claim about any real recipe.
test('exactly two example recipes (Overnight Oats, Lemon Rice Bowl) set glutenFreePerSource, as a plain true; the other four leave it unset', () => {
  assert.deepEqual(exampleRecipes.filter((r) => r.glutenFreePerSource !== undefined).map((r) => [r.id, r.glutenFreePerSource]), [['example-4', true], ['example-5', true]]);
  assert.ok(exampleRecipes.filter((r) => r.glutenFreePerSource === undefined).length === 4);
});
