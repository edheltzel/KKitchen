import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapDecision, BACK_FRACTION } from '../src/scripts/tap-zones.ts';
import { exitAction } from '../src/scripts/cook-exit.ts';

const tap = (over = {}) => tapDecision({ x: 300, width: 390, onInteractive: false, selectionText: '', canForward: true, ...over });

test('a tap on the right side goes forward, on the left side goes back', () => {
  assert.equal(tap({ x: 300 }), 'next');
  assert.equal(tap({ x: 389 }), 'next');
  assert.equal(tap({ x: 10 }), 'back');
  assert.equal(tap({ x: 0 }), 'back');
});

test('the left zone is the left 35%: just inside goes back, the boundary and past it go forward', () => {
  assert.equal(BACK_FRACTION, 0.35);
  assert.equal(tap({ x: 136 }), 'back'); // 136 / 390 = 0.3487
  assert.equal(tap({ x: 137 }), 'next'); // 137 / 390 = 0.3513
  assert.equal(tapDecision({ x: 35, width: 100, onInteractive: false, selectionText: '', canForward: true }), 'next', 'exactly 35% is already forward');
});

test('on the last step the forward zone is off (only the Finish button opens Done); the back zone still works', () => {
  assert.equal(tap({ x: 300, canForward: false }), 'none');
  assert.equal(tap({ x: 389, canForward: false }), 'none');
  assert.equal(tap({ x: 137, canForward: false }), 'none');
  assert.equal(tap({ x: 10, canForward: false }), 'back');
  assert.equal(tap({ x: 136, canForward: false }), 'back');
  assert.equal(tap({ x: 300, canForward: true }), 'next');
});

test('taps on buttons, links, inputs, labels and anything marked are never a zone tap', () => {
  assert.equal(tap({ onInteractive: true, x: 10 }), 'none');
  assert.equal(tap({ onInteractive: true, x: 300 }), 'none');
});

test('while text is selected a tap does not turn the page (even a little selection)', () => {
  assert.equal(tap({ selectionText: 'sauté' }), 'none');
  assert.equal(tap({ selectionText: ' ', x: 10 }), 'none', 'a selected space still counts as selected');
  assert.equal(tap({ selectionText: '' }), 'next');
});

test('bad geometry never turns the page', () => {
  assert.equal(tap({ width: 0 }), 'none');
  assert.equal(tap({ x: -5 }), 'none');
  assert.equal(tap({ x: Number.NaN }), 'none');
  assert.equal(tap({ x: 500 }), 'none', 'a tap reported outside the width is ignored');
});

test('exit goes back in history only when the recipe page is what we came from, otherwise it is a plain link', () => {
  const base = { origin: 'https://kk.example', recipeId: 'example-1', historyLength: 3 };
  assert.equal(exitAction({ ...base, referrer: 'https://kk.example/recipe/example-1/' }), 'back');
  assert.equal(exitAction({ ...base, referrer: 'https://kk.example/recipe/example-1/#ingredients' }), 'back');
  assert.equal(exitAction({ ...base, referrer: 'https://kk.example/recipe/example-1/?x=1' }), 'back');
  assert.equal(exitAction({ ...base, referrer: '' }), 'link', 'opened directly or after a reload from elsewhere');
  assert.equal(exitAction({ ...base, referrer: 'https://kk.example/' }), 'link');
  assert.equal(exitAction({ ...base, referrer: 'https://kk.example/recipe/example-2/' }), 'link');
  assert.equal(exitAction({ ...base, referrer: 'https://other.example/recipe/example-1/' }), 'link');
  assert.equal(exitAction({ ...base, referrer: 'https://kk.example/recipe/example-1/', historyLength: 1 }), 'link');
});
