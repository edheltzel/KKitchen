import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allExampleNotes, exampleRecipes, recipeMeta, flatItems } from '../src/data/examples.ts';
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
  assert.ok(!/gluten|fried chicken|keto|vegan/i.test(JSON.stringify(allExampleNotes)));
  assert.deepEqual([...new Set(allExampleNotes.flatMap((n) => n.tags.map((t) => t.label)))].sort(), ['Draft-only', 'Meatless', 'Nut-free']);
});
