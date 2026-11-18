import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedRatings } from '../src/lib/ratings-shared.ts';

const fakeDb = () => {
  const rows = [];
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              return { results: rows };
            },
            async run() {
              const [recipeId, person, value] = args;
              const at = rows.findIndex((row) => row.recipe_id === recipeId && row.person === (person ?? args[1]));
              if (sql.startsWith('DELETE')) {
                const index = rows.findIndex((row) => row.recipe_id === args[0] && row.person === args[1]);
                if (index >= 0) rows.splice(index, 1);
              } else if (at >= 0) rows[at] = { recipe_id: recipeId, person, value };
              else rows.push({ recipe_id: recipeId, person, value });
            },
          };
        },
      };
    },
  };
};

const ids = ['soup', 'roast'];

test('a recipe both loved is in all three lists', async () => {
  const ratings = createSharedRatings(fakeDb());
  await ratings.set('soup', 'ed', 'loved');
  await ratings.set('soup', 'kristina', 'loved');
  const lists = await ratings.lists(ids);
  assert.deepEqual(lists.family, ['soup']);
  assert.deepEqual(lists.ed, ['soup']);
  assert.deepEqual(lists.kristina, ['soup']);
});

test('a recipe only one person loved is absent from Family favorites', async () => {
  const ratings = createSharedRatings(fakeDb());
  await ratings.set('roast', 'ed', 'loved');
  const lists = await ratings.lists(ids);
  assert.deepEqual(lists.family, []);
  assert.deepEqual(lists.ed, ['roast']);
  assert.deepEqual(lists.kristina, []);
});

test('It was fine appears in none of the three lists', async () => {
  const ratings = createSharedRatings(fakeDb());
  await ratings.set('soup', 'ed', 'fine');
  await ratings.set('soup', 'kristina', 'fine');
  const lists = await ratings.lists(ids);
  assert.deepEqual(lists, { ed: [], kristina: [], family: [] });
});

test('a rating saved by one person is what the other person reads', async () => {
  const shared = fakeDb();
  await createSharedRatings(shared).set('soup', 'ed', 'loved');
  const seen = await createSharedRatings(shared).load();
  assert.equal(seen.soup.ed.value, 'loved');
});
