import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realNotes } from '../src/data/recipes.ts';
import { flatItems, recipeMeta, cardTime, confirmedTags, TIME_OPTIONS } from '../src/data/examples.ts';
import { isValidId } from '../src/scripts/ratings.ts';

// These tests read the real data module directly, so they pass whatever KK_DATA says.
const by = (id) => realNotes.find((r) => r.id === id);
const json = JSON.stringify(realNotes);
const ITEM_ID = /^[a-z][a-z0-9-]{0,39}$/;

test('exactly three real recipes, with fixed ids and the titles exactly as the notes have them', () => {
  assert.deepEqual(realNotes.map((r) => [r.id, r.name]), [
    ['gluten-free-fried-chicken', 'Gluten-Free Fried Chicken'],
    ['slow-cooker-roast', 'Slow Cooker Roast'],
    ['high-protein-brownies', 'High Protein Gluten Free Brownies That Actually Taste Good'],
  ]);
  for (const r of realNotes) {
    assert.ok(isValidId(r.id));
    assert.equal(r.approved, true, `${r.id}: the captain asked for these, so they are treated as approved`);
  }
});

test('the stub, the furniture note and the Recipes index are not in the data', () => {
  assert.equal(realNotes.length, 3);
  for (const r of realNotes) assert.ok(!/bread(?!\s*pan)|furniture|^recipes$/i.test(`${r.id} ${r.name}`), r.id);
  assert.ok(!/youtube|furniture/i.test(json));
});

test('fried chicken: serves 6, prep 15, cook 45, three groups, 16 ingredients, 6 steps, 5 notes', () => {
  const r = by('gluten-free-fried-chicken');
  assert.equal(r.meal, 'dinner');
  assert.deepEqual([r.serves, r.prep, r.cook, r.minutes], [6, 15, 45, 60]);
  assert.deepEqual(r.groups.map((g) => [g.title, g.items.length]), [['Marinade', 6], ['Breading', 9], ['For frying', 1]]);
  assert.equal(flatItems(r).length, 16);
  assert.equal(r.steps.length, 6);
  assert.equal(r.notes.length, 5);
  assert.equal(recipeMeta(r), 'Prep 15 min · Cook 45 min · Plus\u00a02\u00a0h\u00a0marinate · Serves 6');
  assert.equal(cardTime(r), '60 min +\u00a02\u00a0h\u00a0marinate');
});

test('fried chicken: the 2 hour marinate is in the first note and in step 1, so 60 min is not the whole story', () => {
  const r = by('gluten-free-fried-chicken');
  assert.match(r.notes[0], /at least 2 hours to marinate/);
  assert.match(r.steps[0].text, /at least 2 hours/);
  assert.ok(r.minutes > Math.max(...TIME_OPTIONS), 'no "N min or less" choice includes it');
});

test('roast: serves 8, prep 25, cook 6 to 8 hours on HIGH, three groups, 19 ingredients, 12 steps, 4 notes', () => {
  const r = by('slow-cooker-roast');
  assert.equal(r.meal, 'dinner');
  assert.deepEqual([r.serves, r.prep, r.cook, r.minutes], [8, 25, 360, 385]);
  assert.deepEqual(r.groups.map((g) => [g.title, g.items.length]), [[undefined, 11], ['Pork Dry Rub', 7], ['Thickener', 1]]);
  assert.equal(flatItems(r).length, 19);
  assert.equal(r.steps.length, 12);
  assert.equal(r.notes.length, 4);
  assert.match(r.notes[0], /6 to 8 hours on HIGH/);
  assert.match(r.steps[8].text, /6-8 hours/);
  assert.equal(r.author, 'Linley Hanson');
});

test('brownies: a snack, 9 ingredients, 3 steps, notes carry the equipment, no prep time invented', () => {
  const r = by('high-protein-brownies');
  assert.equal(r.meal, 'snack');
  assert.equal(r.prep, 0, 'the note gives no prep time');
  assert.deepEqual([r.serves, r.cook, r.minutes], [8, 25, 25]);
  assert.equal(flatItems(r).length, 9);
  assert.equal(r.steps.length, 3);
  assert.equal(r.notes.length, 3);
  assert.match(r.steps[1].text, /375F/);
  assert.match(r.steps[1].text, /20 to 25 minutes/);
  assert.ok(r.notes.some((n) => /^Equipment: .*5x9-inch bread pan/.test(n)));
  assert.ok(r.notes.some((n) => /small curd cottage cheese/.test(n)));
  assert.equal(r.author, 'Instructables');
  assert.equal(recipeMeta(r), 'Cook 25 min · Serves 8');
});

test('quantities and temperatures stay as the notes have them', () => {
  const chicken = JSON.stringify(by('gluten-free-fried-chicken'));
  for (const s of ['350°F', '165°F', '15-18 minutes', '4 cups vegetable oil (peanut oil is great)', '3 cups milk (dairy-free: unsweetened almond, cashew or coconut milk)']) assert.ok(chicken.includes(s), s);
  const roast = JSON.stringify(by('slow-cooker-roast'));
  for (const s of ['3 lbs. boneless pork shoulder roast', '1.5 tablespoons cornstarch', '45 seconds', '1/4 teaspoon cinnamon', '1/2 cup red wine']) assert.ok(roast.includes(s), s);
  const brownies = JSON.stringify(by('high-protein-brownies'));
  for (const s of ['3/4 cup of cottage cheese (170g)', '1 1/2 tsp of baking powder (7g)', '375F/190C', '1/2 cup of chocolate chips, optional (80g)']) assert.ok(brownies.includes(s), s);
});

test('gluten-free is held: no diet tag at all on any of them, so no badge and no filter value', () => {
  for (const r of realNotes) {
    assert.deepEqual(r.tags, [], `${r.id}: no tags until the captain confirms them`);
    assert.deepEqual(confirmedTags(r), []);
  }
  assert.ok(!/gluten/i.test(JSON.stringify(realNotes.flatMap((r) => [r.tags, r.notes ?? []]))), 'no gluten words in tags or notes');
  assert.ok(!/gluten/i.test(JSON.stringify(by('slow-cooker-roast'))), 'the roast makes no gluten-free claim at all');
});

test('no image, no image link, no affiliate link, no promo or review text, no vault path', () => {
  assert.ok(!/<img|!\[|\[\[|\.(jpe?g|png|gif|webp|svg|heic)\b/i.test(json), 'no image');
  assert.ok(!/http:\/\//.test(json), 'no plain http link');
  assert.ok(!/amzn|affiliate|goto\.|Jump to Recipe|votes|kcal|Rick|youtube|inthekitchenwithmatt/i.test(json));
  assert.ok(!/FieldNotes|iCloud|Mobile Documents|Obsidian|\/Users\//.test(json));
  const urls = json.match(/https?:\/\/[^"\\]+/g) ?? [];
  assert.equal(urls.length, 3, 'only the three source links');
});

test('every recipe has its source link, and only the roast and the brownies name an author', () => {
  assert.equal(by('gluten-free-fried-chicken').source, 'https://www.mamaknowsglutenfree.com/gluten-free-fried-chicken/');
  assert.equal(by('slow-cooker-roast').source, 'https://fitfoodiefinds.com/slow-cooker-pork-roast/');
  assert.equal(by('high-protein-brownies').source, 'https://www.instructables.com/High-Protein-Gluten-Free-Brownies-That-Actually-Ta/');
  assert.equal(by('gluten-free-fried-chicken').author, undefined);
});

test('the shared data rules hold: prep + cook = minutes, valid unique item ids, keywords are in the items, uses are real ids', () => {
  for (const r of realNotes) {
    assert.equal(r.prep + r.cook, r.minutes, r.id);
    const items = flatItems(r);
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${r.id}: unique item ids`);
    for (const id of ids) assert.match(id, ITEM_ID, `${r.id}/${id}`);
    const lines = items.map((i) => i.text.toLowerCase());
    assert.ok(r.ingredients.length > 0);
    for (const word of r.ingredients) assert.ok(lines.some((l) => l.includes(word.toLowerCase())), `${r.id}: ${word}`);
    for (const [n, s] of r.steps.entries()) {
      assert.ok(s.text.length > 0 && !/\n/.test(s.text));
      if (s.uses === undefined) continue;
      assert.equal(new Set(s.uses).size, s.uses.length, `${r.id} step ${n + 1}: no repeats`);
      for (const id of s.uses) assert.ok(ids.includes(id), `${r.id} step ${n + 1}: unknown item ${id}`);
    }
    for (const n of r.notes) assert.ok(n.length > 0 && !/\n/.test(n));
  }
});

test('fried chicken: the wait is 2 h marinate, "at least" stays in the notes, and a note says frying in batches takes longer than the 45 min', () => {
  const r = by('gluten-free-fried-chicken');
  assert.equal(r.wait, '2 h marinate');
  assert.match(r.notes[0], /at least 2 hours to marinate, overnight is best/);
  assert.ok(r.notes.some((n) => /12 pieces/.test(n) && /3 or 4 at a time/.test(n) && /15-18 minutes/.test(n) && /longer than the 45 min/.test(n)));
  assert.deepEqual([r.prep, r.cook, r.minutes], [15, 45, 60], 'the figures stay as the note has them');
});

test('only the fried chicken has a wait, and the roast reads in hours', () => {
  assert.deepEqual(realNotes.filter((r) => r.wait).map((r) => r.id), ['gluten-free-fried-chicken']);
  const roast = by('slow-cooker-roast');
  assert.equal(cardTime(roast), '6 h 25 min');
  assert.equal(recipeMeta(roast), 'Prep 25 min · Cook 6 h · Serves 8');
  assert.match(roast.notes[0], /6 to 8 hours on HIGH/);
  assert.equal(cardTime(by('high-protein-brownies')), '25 min');
});
