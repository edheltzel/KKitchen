import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTicksStore } from '../src/scripts/ticks-store.ts';
import { createTicksController } from '../src/scripts/ticks-controller.ts';
import { createUndoSlot } from '../src/scripts/undo-slot.ts';

const ITEMS = ['garlic', 'onion', 'tomato'];

function fakeStorage() {
  const m = new Map();
  const s = { fail: false, failRead: false };
  return Object.assign(s, {
    getItem: (k) => { if (s.failRead) throw new Error('denied'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (s.fail) throw new Error('blocked'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  });
}
function make({ storage = fakeStorage(), recipeId = 'example-1', items = ITEMS } = {}) {
  const drawn = [];
  const slot = createUndoSlot({ render: (offer) => drawn.push(offer ? offer.text : null) });
  const controller = createTicksController({ store: createTicksStore({ storage }), recipeId, itemIds: items, slot });
  controller.init();
  return { storage, controller, slot, drawn, checked: () => [...controller.view().checked].sort() };
}

test('ticking an item shows it ticked and saves it; a new controller (reload) starts with it ticked', () => {
  const { storage, controller, checked } = make();
  controller.toggle('garlic');
  assert.deepEqual(checked(), ['garlic']);
  assert.equal(controller.view().unavailable, false);
  assert.deepEqual(make({ storage }).checked(), ['garlic']);
  controller.toggle('garlic');
  assert.deepEqual(checked(), []);
});

test('items the page does not have are ignored: saved leftovers are not shown, and unknown taps do nothing', () => {
  const storage = fakeStorage();
  createTicksStore({ storage }).set('example-1', 'old-item', true);
  const { controller, checked } = make({ storage });
  assert.deepEqual(checked(), []);
  controller.toggle('not-on-page');
  assert.deepEqual(checked(), []);
});

test('subscribers hear every change; unsubscribe stops it', () => {
  const { controller } = make();
  let heard = 0;
  const off = controller.subscribe(() => heard++);
  controller.toggle('garlic');
  controller.toggle('onion');
  off();
  controller.toggle('tomato');
  assert.equal(heard, 2);
});

test('reset unticks everything and offers Undo; Undo ticks the same items again', () => {
  const { storage, controller, drawn, slot, checked } = make();
  controller.toggle('garlic');
  controller.toggle('onion');
  assert.equal(controller.reset(), true);
  assert.deepEqual(checked(), []);
  assert.deepEqual(make({ storage }).checked(), [], 'saved as cleared');
  assert.deepEqual(drawn, ['Checks cleared']);
  slot.press();
  assert.deepEqual(checked(), ['garlic', 'onion']);
  assert.deepEqual(make({ storage }).checked(), ['garlic', 'onion'], 'Undo is saved too');
});

test('reset with nothing ticked does nothing and offers nothing', () => {
  const { controller, drawn } = make();
  assert.equal(controller.reset(), false);
  assert.deepEqual(drawn, []);
});

test('Undo after ticking something new keeps the new tick too', () => {
  const { controller, slot, checked } = make();
  controller.toggle('garlic');
  controller.reset();
  controller.toggle('tomato');
  slot.press();
  assert.deepEqual(checked(), ['garlic', 'tomato']);
});

test('the Undo offer text can be set (cooking mode says what was cleared)', () => {
  const { controller, drawn } = make();
  controller.toggle('garlic');
  controller.reset({ text: 'Ingredient checks cleared' });
  assert.deepEqual(drawn, ['Ingredient checks cleared']);
});

test('another offer replacing ours just means no Undo for the reset: the clear stays', () => {
  const { controller, slot, checked } = make();
  controller.toggle('garlic');
  controller.reset();
  slot.offer({ text: 'Family favorite removed', run() {}, drop() {} });
  assert.deepEqual(checked(), []);
});

test('per-recipe isolation: two controllers on the same storage do not see each other', () => {
  const storage = fakeStorage();
  const a = make({ storage, recipeId: 'example-1' });
  const b = make({ storage, recipeId: 'example-2' });
  a.controller.toggle('garlic');
  assert.deepEqual(b.checked(), []);
  b.controller.reset();
  assert.deepEqual(a.checked(), ['garlic']);
});

test('refresh picks up a tick made in another tab, without losing the tick made here', () => {
  const { storage, controller, checked } = make();
  controller.toggle('garlic');
  createTicksStore({ storage }).set('example-1', 'onion', true);
  controller.refresh();
  assert.deepEqual(checked(), ['garlic', 'onion']);
});

test('storage blocked: ticks still work on screen, the view says unavailable, nothing is saved', () => {
  const storage = fakeStorage();
  storage.fail = true;
  const { controller, checked } = make({ storage });
  controller.toggle('garlic');
  assert.deepEqual(checked(), ['garlic']);
  assert.equal(controller.view().unavailable, true);
  storage.fail = false;
  assert.deepEqual(make({ storage }).checked(), [], 'not saved while blocked');
});

test('storage blocked: Retry saves what is on screen and clears the banner; while still blocked it stays', () => {
  const storage = fakeStorage();
  storage.fail = true;
  const { controller, checked } = make({ storage });
  controller.toggle('garlic');
  controller.toggle('onion');
  controller.retry();
  assert.equal(controller.view().unavailable, true);
  storage.fail = false;
  controller.retry();
  assert.equal(controller.view().unavailable, false);
  assert.deepEqual(checked(), ['garlic', 'onion']);
  assert.deepEqual(make({ storage }).checked(), ['garlic', 'onion']);
});

test('storage blocked: reset still works on screen and Undo still offers', () => {
  const storage = fakeStorage();
  storage.fail = true;
  const { controller, slot, checked } = make({ storage });
  controller.toggle('garlic');
  controller.reset();
  assert.deepEqual(checked(), []);
  slot.press();
  assert.deepEqual(checked(), ['garlic']);
});

test('storage that cannot even be read at start: empty, unavailable, and Retry loads once it works', () => {
  const storage = fakeStorage();
  createTicksStore({ storage }).set('example-1', 'tomato', true);
  storage.failRead = true;
  const { controller, checked } = make({ storage });
  assert.equal(controller.view().unavailable, true);
  assert.deepEqual(checked(), []);
  storage.failRead = false;
  controller.retry();
  assert.equal(controller.view().unavailable, false);
  assert.deepEqual(checked(), ['tomato'], 'what was saved is not lost');
});

test('storage blocked: Undo after a new tick keeps the new tick (on-screen merge, not only the saved merge)', () => {
  const storage = fakeStorage();
  storage.fail = true;
  const { controller, slot, checked } = make({ storage });
  controller.toggle('garlic');
  controller.reset();
  controller.toggle('tomato');
  slot.press();
  assert.deepEqual(checked(), ['garlic', 'tomato']);
});
