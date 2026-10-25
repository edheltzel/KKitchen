import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER, back, encode, next, parse, segments, stepCount } from '../src/scripts/cook-machine.ts';

const step = (index) => ({ phase: 'step', index });
const DONE = { phase: 'done' };

test('gather -> step 1 -> ... -> last step -> done', () => {
  let s = GATHER;
  s = next(s, 3);
  assert.deepEqual(s, step(0));
  s = next(s, 3);
  assert.deepEqual(s, step(1));
  s = next(s, 3);
  assert.deepEqual(s, step(2));
  s = next(s, 3);
  assert.deepEqual(s, DONE);
});

test('next clamps at done; back clamps at gather', () => {
  assert.deepEqual(next(DONE, 3), DONE);
  assert.deepEqual(back(GATHER, 3), GATHER);
});

test('back walks the other way: done -> last step -> ... -> step 1 -> gather', () => {
  assert.deepEqual(back(DONE, 3), step(2));
  assert.deepEqual(back(step(2), 3), step(1));
  assert.deepEqual(back(step(1), 3), step(0));
  assert.deepEqual(back(step(0), 3), GATHER);
});

test('a recipe with no steps goes straight from gather to done, and back returns to gather', () => {
  assert.deepEqual(next(GATHER, 0), DONE);
  assert.deepEqual(back(DONE, 0), GATHER);
});

test('a step index outside the recipe is pulled back inside', () => {
  assert.deepEqual(next(step(-4), 3), step(1)); // treated as step 1
  assert.deepEqual(next(step(9), 3), DONE); // treated as the last step
  assert.deepEqual(back(step(9), 3), step(1));
});

test('encode writes nothing for gather, "#step-N" (counting from 1) and "#done"', () => {
  assert.equal(encode(GATHER), '');
  assert.equal(encode(step(0)), '#step-1');
  assert.equal(encode(step(4)), '#step-5');
  assert.equal(encode(DONE), '#done');
});

test('parse restores the position from the address, and anything odd starts at gather', () => {
  assert.deepEqual(parse('', 5), GATHER);
  assert.deepEqual(parse('#step-1', 5), step(0));
  assert.deepEqual(parse('#step-5', 5), step(4));
  assert.deepEqual(parse('#done', 5), DONE);
  for (const bad of ['#', '#gather', '#step-', '#step-abc', '#step-1.5', '#step-0', '#step--2', '#step-1x', '#STEP-2', '#done!', '#step-2#done', 'step-2', undefined, null, 7])
    assert.deepEqual(parse(bad, 5), GATHER, String(bad));
});

test('a saved step past the end (the recipe got shorter) lands on the last step, not on done', () => {
  assert.deepEqual(parse('#step-9', 5), step(4));
  assert.deepEqual(parse('#step-2', 1), step(0));
  assert.deepEqual(parse('#step-1', 0), GATHER);
  assert.deepEqual(parse('#done', 0), DONE);
});

test('encode and parse round-trip every position', () => {
  const all = [GATHER, step(0), step(1), step(2), DONE];
  for (const s of all) assert.deepEqual(parse(encode(s), 3), s);
});

test('progress segments: all to do at gather, earlier ones done and one current on a step, all done at the end', () => {
  assert.deepEqual(segments(GATHER, 3), ['todo', 'todo', 'todo']);
  assert.deepEqual(segments(step(0), 3), ['current', 'todo', 'todo']);
  assert.deepEqual(segments(step(2), 3), ['done', 'done', 'current']);
  assert.deepEqual(segments(DONE, 3), ['done', 'done', 'done']);
});

test('stepCount names the screen: "Step 2 of 5"', () => {
  assert.equal(stepCount(step(1), 5), 'Step 2 of 5');
  assert.equal(stepCount(GATHER, 5), null);
  assert.equal(stepCount(DONE, 5), null);
});
