import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localCopy, markImported } from '../src/scripts/import-local.ts';

const memory = (values) => {
  const stored = new Map(Object.entries(values));
  return {
    stored,
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
};

const saved = () => memory({
  'kk:ratings': JSON.stringify({ v: 1, entries: { soup: { ed: { value: 'loved', at: 1 } } } }),
  'kk:week': JSON.stringify({ v: 1, entries: { '2026-11-16': { recipeId: 'roast', at: 1 } } }),
});

test('a phone with saved ratings and a week offers them once confirmed', () => {
  const storage = saved();
  const copy = localCopy(storage);
  assert.deepEqual(copy.ratings, [{ recipeId: 'soup', person: 'ed', value: 'loved' }]);
  assert.deepEqual(copy.dinners, [{ day: '2026-11-16', recipeId: 'roast' }]);
  markImported(storage);
  assert.equal(localCopy(storage), null);
});

test('declining leaves the phone unmarked, so the offer can return', () => {
  const storage = saved();
  assert.ok(localCopy(storage));
  assert.equal(storage.getItem('kk:imported'), null);
});

test('a second visit after importing offers nothing', () => {
  const storage = saved();
  markImported(storage);
  assert.equal(localCopy(storage), null);
});

test('a phone with nothing saved offers nothing', () => {
  assert.equal(localCopy(memory({})), null);
});
