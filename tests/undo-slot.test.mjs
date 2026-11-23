import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUndoSlot } from '../src/scripts/undo-slot.ts';

const make = () => {
  const drawn = [];
  const slot = createUndoSlot({ render: (offer) => drawn.push(offer ? offer.text : null) });
  const offer = (text) => {
    const o = { text, ran: 0, dropped: 0, run() { o.ran++; }, drop() { o.dropped++; } };
    return o;
  };
  return { slot, drawn, offer };
};

test('one Undo offer at a time: a new offer replaces the old one, which is told it was dropped', () => {
  const { slot, drawn, offer } = make();
  const a = offer('Family favorite removed');
  const b = offer('Checks cleared');
  slot.offer(a);
  slot.offer(b);
  assert.deepEqual(drawn, ['Family favorite removed', 'Checks cleared']);
  assert.equal(a.dropped, 1);
  assert.equal(b.dropped, 0);
  slot.press();
  assert.equal(b.ran, 1);
  assert.equal(a.ran, 0, 'only the offer on show runs');
});

test('offering the same thing again does not drop it or redraw it as new', () => {
  const { slot, drawn, offer } = make();
  const a = offer('A');
  slot.offer(a);
  slot.offer(a);
  assert.equal(a.dropped, 0);
  assert.deepEqual(drawn, ['A', 'A']);
});

test('retract only clears the offer that is on show (a stale source cannot hide a newer offer)', () => {
  const { slot, drawn, offer } = make();
  const a = offer('A');
  const b = offer('B');
  slot.offer(a);
  slot.offer(b);
  slot.retract(a);
  assert.deepEqual(drawn.at(-1), 'B', 'B still showing');
  slot.retract(b);
  assert.equal(drawn.at(-1), null);
  slot.press();
  assert.equal(b.ran, 0, 'nothing to undo any more');
});

test('a source that drops its own offer while being replaced cannot clear the new one (re-entrancy)', () => {
  const { slot, drawn, offer } = make();
  const a = offer('A');
  a.drop = () => { a.dropped++; slot.retract(a); };
  const b = offer('B');
  slot.offer(a);
  slot.offer(b);
  assert.equal(drawn.at(-1), 'B');
  assert.equal(a.dropped, 1);
});

test('expire drops the offer on show and clears the bar', () => {
  const { slot, drawn, offer } = make();
  const a = offer('A');
  slot.offer(a);
  slot.expire();
  assert.equal(a.dropped, 1);
  assert.equal(drawn.at(-1), null);
  slot.expire();
  assert.equal(a.dropped, 1, 'expiring an empty bar does nothing');
});

test('press runs the offer once, clears the bar, and a second press does nothing', () => {
  const { slot, drawn, offer } = make();
  const a = offer('A');
  slot.offer(a);
  slot.press();
  slot.press();
  assert.equal(a.ran, 1);
  assert.equal(drawn.at(-1), null);
  assert.equal(a.dropped, 0, 'used, not dropped');
});
