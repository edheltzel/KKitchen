import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exampleRecipes, allExampleNotes, confirmedTags, filterOptions } from '../src/data/examples.ts';

test('only approved notes are exposed to the site', () => {
  assert.ok(allExampleNotes.some((n) => n.approved !== true), 'data includes an unapproved example');
  assert.equal(exampleRecipes.length, 6);
  for (const r of exampleRecipes) assert.equal(r.approved, true);
  const hidden = allExampleNotes.filter((n) => n.approved !== true);
  for (const h of hidden) assert.ok(!exampleRecipes.includes(h));
});

test('unconfirmed diet tags never become a visible tag or a filter option', () => {
  const unconfirmed = allExampleNotes.flatMap((n) => n.tags).filter((t) => t.confirmed !== true);
  assert.ok(unconfirmed.length > 0, 'data includes an unconfirmed tag');
  const options = filterOptions();
  for (const t of unconfirmed) {
    assert.ok(!options.diet.includes(t.label), `${t.label} must not be a filter`);
    for (const r of exampleRecipes) assert.ok(!confirmedTags(r).includes(t.label), `${t.label} must not show on a card`);
  }
  assert.ok(options.diet.length > 0, 'confirmed tags still show');
});

test('filter options come only from approved recipes', () => {
  const o = filterOptions();
  assert.deepEqual(o.meal, ['breakfast', 'lunch', 'dinner']);
  assert.deepEqual(o.time, ['15', '30', '45']);
  for (const r of exampleRecipes) {
    assert.ok(o.meal.includes(r.meal));
    assert.ok(r.ingredients.length > 0);
  }
});

test('example data stays obviously fake and makes no gluten-free claim', () => {
  const blob = JSON.stringify(allExampleNotes);
  assert.ok(!/gluten|fried chicken|keto/i.test(blob));
  for (const r of exampleRecipes) assert.ok(r.name.length > 0);
});

test('npm test builds and runs on the example fixture, never on the real recipes', () => {
  assert.equal(process.env.KK_DATA, 'fixture');
  assert.ok(exampleRecipes.every((r) => /^example-\d+$/.test(r.id)));
});
