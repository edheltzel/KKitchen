import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedTicks } from '../src/lib/ticks-shared.ts';

const fakeDb = () => {
  const rows = [];
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              const [recipeId, person] = args;
              return { results: rows.filter((row) => row.recipe_id === recipeId && row.person === person) };
            },
            async run() {
              const [recipeId, person, itemId] = args;
              const index = rows.findIndex((row) => row.recipe_id === recipeId && row.person === person && row.item_id === itemId);
              if (sql.startsWith('DELETE')) { if (index >= 0) rows.splice(index, 1); }
              else if (index < 0) rows.push({ recipe_id: recipeId, person, item_id: itemId });
            },
          };
        },
      };
    },
  };
};

test('one person sees the same ticks from two devices', async () => {
  const shared = fakeDb();
  const phone = createSharedTicks(shared);
  const computer = createSharedTicks(shared);
  await phone.set('soup', 'ed', 'onion', true);
  assert.deepEqual(await computer.read('soup', 'ed'), ['onion']);
});

test('two people keep separate ticks for the same recipe', async () => {
  const ticks = createSharedTicks(fakeDb());
  await ticks.set('soup', 'ed', 'onion', true);
  await ticks.set('soup', 'kristina', 'tomato', true);
  assert.deepEqual(await ticks.read('soup', 'ed'), ['onion']);
  assert.deepEqual(await ticks.read('soup', 'kristina'), ['tomato']);
});
