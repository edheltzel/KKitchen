import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecipeStore, RecipeRejected } from '../src/lib/recipe-store.ts';

// A bucket in memory, standing in for the RECIPES bucket the endpoint writes to.
const memoryBucket = () => {
  const objects = new Map();
  return {
    objects,
    async get(key) {
      const value = objects.get(key);
      return value === undefined ? null : { text: async () => value };
    },
    async put(key, value) {
      objects.set(key, value);
    },
    async list() {
      return { objects: [...objects.keys()].map((key) => ({ key })) };
    },
  };
};

const soup = {
  id: 'tomato-soup',
  name: 'Tomato soup',
  minutes: 30,
  meal: 'lunch',
  ingredients: '4 tomatoes\n1 onion',
  method: 'Chop the onion.\nSimmer everything.',
};

test('posting a recipe writes it to the bucket and reading it back gives the same recipe', async () => {
  const bucket = memoryBucket();
  const store = createRecipeStore(bucket);
  const saved = await store.save(soup);
  assert.equal(bucket.objects.has('tomato-soup.md'), true);

  const read = (await store.list()).find((recipe) => recipe.id === saved.id);
  assert.ok(read);
  assert.equal(read.name, 'Tomato soup');
  assert.deepEqual(read.ingredients, ['4 tomatoes', '1 onion']);
  assert.deepEqual(read.steps.map((step) => step.text), ['Chop the onion.', 'Simmer everything.']);
  assert.equal(read.approved, true);
});

test('a recipe with no name is rejected and nothing is written', async () => {
  const bucket = memoryBucket();
  const store = createRecipeStore(bucket);
  await assert.rejects(store.save({ ...soup, name: '   ' }), RecipeRejected);
  assert.equal(bucket.objects.size, 0);
});

test('editing a recipe keeps its source, notes and prep', async () => {
  const store = createRecipeStore(memoryBucket());
  const previous = { ...soup, source: 'https://example.com/soup', notes: ['Best the next day'], prep: 10, serves: 4, tags: [], approved: true, groups: [], steps: [] };
  const saved = await store.save({ ...soup, name: 'Tomato soup, revised', previous });
  assert.equal(saved.source, 'https://example.com/soup');
  assert.deepEqual(saved.notes, ['Best the next day']);
  assert.equal(saved.prep, 10);
  assert.equal(saved.name, 'Tomato soup, revised');
});

test('a recipe with no ingredient is rejected', async () => {
  const store = createRecipeStore(memoryBucket());
  await assert.rejects(store.save({ ...soup, ingredients: '\n  \n' }), /at least one ingredient/);
});

test('an empty bucket falls back to the bundled recipes', async () => {
  const store = createRecipeStore(memoryBucket());
  const recipes = await store.list();
  assert.ok(recipes.length >= 3);
  assert.ok(recipes.some((recipe) => recipe.id === 'fried-chicken'));
});

test('saving one recipe keeps the bundled ones', async () => {
  const store = createRecipeStore(memoryBucket());
  await store.save(soup);
  const recipes = await store.list();
  assert.ok(recipes.some((recipe) => recipe.id === 'tomato-soup'));
  assert.ok(recipes.some((recipe) => recipe.id === 'fried-chicken'));
});
