import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTicksStore, TicksUnavailableError, TICKS_KEY } from '../src/scripts/ticks-store.ts';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()], raw: (k) => m.get(k) };
}
const blocked = () => ({ getItem: () => null, setItem: () => { throw new Error('storage blocked'); }, removeItem: () => {} });
const readBlocked = () => ({ getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} });

test('empty at first; a tick is saved under ONE key and a fresh store (reload) sees it', () => {
  const storage = fakeStorage();
  const store = createTicksStore({ storage });
  assert.deepEqual(store.read('example-1'), []);
  assert.deepEqual(store.set('example-1', 'garlic', true), ['garlic']);
  assert.deepEqual(storage.keys(), [TICKS_KEY]);
  assert.deepEqual(createTicksStore({ storage }).read('example-1'), ['garlic']);
});

test('ticks are per recipe: another recipe with the same item id is not affected', () => {
  const store = createTicksStore({ storage: fakeStorage() });
  store.set('example-1', 'garlic', true);
  store.set('example-2', 'onion', true);
  assert.deepEqual(store.read('example-1'), ['garlic']);
  assert.deepEqual(store.read('example-2'), ['onion']);
  store.clear('example-1');
  assert.deepEqual(store.read('example-1'), []);
  assert.deepEqual(store.read('example-2'), ['onion'], 'clearing one recipe leaves the others');
});

test('every write re-reads storage and merges: two tabs ticking different items keep both', () => {
  const storage = fakeStorage();
  const tabA = createTicksStore({ storage });
  const tabB = createTicksStore({ storage });
  tabA.set('example-1', 'garlic', true);
  tabB.set('example-1', 'onion', true); // tab B never saw garlic
  assert.deepEqual(tabA.read('example-1').sort(), ['garlic', 'onion']);
  tabA.set('example-1', 'garlic', false);
  assert.deepEqual(tabB.read('example-1'), ['onion']);
});

test('ticking twice is the same as once; unticking something not ticked changes nothing', () => {
  const store = createTicksStore({ storage: fakeStorage() });
  store.set('example-1', 'garlic', true);
  assert.deepEqual(store.set('example-1', 'garlic', true), ['garlic']);
  assert.deepEqual(store.set('example-1', 'onion', false), ['garlic']);
});

test('clear returns what was ticked (for Undo); add puts items back without losing newer ticks', () => {
  const store = createTicksStore({ storage: fakeStorage() });
  store.set('example-1', 'garlic', true);
  store.set('example-1', 'onion', true);
  const before = store.clear('example-1');
  assert.deepEqual(before.sort(), ['garlic', 'onion']);
  store.set('example-1', 'tomato', true); // ticked after the reset
  assert.deepEqual(store.add('example-1', before).sort(), ['garlic', 'onion', 'tomato']);
});

test('an emptied recipe leaves nothing behind in storage', () => {
  const storage = fakeStorage();
  const store = createTicksStore({ storage });
  store.set('example-1', 'garlic', true);
  store.clear('example-1');
  assert.deepEqual(JSON.parse(storage.raw(TICKS_KEY)), { v: 1, ticks: {} });
});

test('garbled, wrong-version or odd saved data reads as empty, and odd ids are dropped', () => {
  for (const raw of ['not json', '{"v":2,"ticks":{"example-1":["a"]}}', 'null', '[]', '{"v":1,"ticks":5}']) {
    const storage = fakeStorage();
    storage.setItem(TICKS_KEY, raw);
    assert.deepEqual(createTicksStore({ storage }).read('example-1'), [], raw);
  }
  const storage = fakeStorage();
  storage.setItem(TICKS_KEY, JSON.stringify({ v: 1, ticks: { 'example-1': ['garlic', '<b>x</b>', 7, null, 'garlic', 'A'.repeat(80)], '../x': ['a'] } }));
  const store = createTicksStore({ storage });
  assert.deepEqual(store.read('example-1'), ['garlic']);
  assert.throws(() => store.set('../x', 'a', true), TypeError);
  assert.throws(() => store.set('example-1', '<b>', true), TypeError);
});

test('storage that refuses to save: every write throws TicksUnavailableError; reads are just empty', () => {
  const store = createTicksStore({ storage: blocked() });
  assert.deepEqual(store.read('example-1'), []);
  assert.throws(() => store.set('example-1', 'garlic', true), TicksUnavailableError);
  assert.throws(() => store.clear('example-1'), TicksUnavailableError);
  assert.throws(() => store.add('example-1', ['garlic']), TicksUnavailableError);
});

test('storage that refuses to read: read throws TicksUnavailableError', () => {
  assert.throws(() => createTicksStore({ storage: readBlocked() }).read('example-1'), TicksUnavailableError);
});

test('recipe ids that look like object built-ins ("constructor", "toString") are ordinary ids', () => {
  const store = createTicksStore({ storage: fakeStorage() });
  assert.deepEqual(store.read('constructor'), []);
  assert.deepEqual(store.set('toString', 'garlic', true), ['garlic']);
  assert.deepEqual(store.read('toString'), ['garlic']);
  assert.deepEqual(store.clear('constructor'), []);
});
