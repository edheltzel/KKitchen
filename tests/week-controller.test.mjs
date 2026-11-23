import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeekController } from '../src/scripts/week-controller.ts';
import { createLocalWeekStore } from '../src/scripts/week-store.ts';
import { weekDays, dinnerOn } from '../src/scripts/week-plan.ts';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let t = 0;
const now = () => (t += 5);
const days = weekDays(new Date(2026, 9, 29)).map((d) => d.key);
const [MON, TUE, WED, THU, FRI] = days;

/** One phone. `calls` records every save that reached the store, in order. */
function phone(backing = fakeStorage()) {
  const failures = { load: false, save: false };
  const inner = createLocalWeekStore({ storage: backing, now, failures });
  const calls = [];
  const store = { load: () => inner.load(), set: (day, id) => (calls.push([day, id]), inner.set(day, id)) };
  const controller = createWeekController({ store, days });
  return { controller, failures, calls, backing };
}
const dinner = (c, day) => dinnerOn(c.view().plan ?? {}, day);

test('init loads the saved plan', async () => {
  const backing = fakeStorage();
  const a = phone(backing);
  await a.controller.init();
  await a.controller.plan(TUE, 'r1');
  const reopened = phone(backing);
  assert.equal(reopened.controller.view().plan, null, 'nothing before it loads');
  await reopened.controller.init();
  assert.equal(dinner(reopened.controller, TUE), 'r1');
});

test('planning an empty day: saved, and a "planned" note on that day', async () => {
  const { controller } = phone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  assert.equal(dinner(controller, TUE), 'r1');
  assert.deepEqual(controller.view().note, { kind: 'planned', day: TUE });
});

test('planning on a day with a dinner replaces it (one dinner per day) and says what it replaced', async () => {
  const { controller } = phone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  await controller.plan(TUE, 'r2');
  assert.equal(dinner(controller, TUE), 'r2');
  assert.deepEqual(controller.view().note, { kind: 'replaced', day: TUE, replaced: 'r1' });
});

test('planning a recipe that is on another day MOVES it and the note says from where', async () => {
  const { controller } = phone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  await controller.plan(THU, 'r1');
  assert.equal(dinner(controller, THU), 'r1');
  assert.equal(dinner(controller, TUE), null, 'no longer on Tuesday');
  assert.deepEqual(controller.view().note, { kind: 'moved', day: THU, from: TUE });
  const plan = controller.view().plan;
  assert.equal(days.filter((d) => dinnerOn(plan, d) === 'r1').length, 1, 'only one day has it');
});

test('planning the same dinner on the same day changes nothing and saves nothing', async () => {
  const { controller, calls } = phone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  const before = calls.length;
  await controller.plan(TUE, 'r1');
  assert.equal(calls.length, before);
});

test('remove clears the day, offers Undo, and Undo puts the same dinner back on the same day', async () => {
  const { controller } = phone();
  await controller.init();
  await controller.plan(WED, 'r1');
  await controller.remove(WED);
  assert.equal(dinner(controller, WED), null);
  assert.deepEqual(controller.view().undo, { day: WED, recipeId: 'r1' });
  await controller.undo();
  assert.equal(dinner(controller, WED), 'r1');
  assert.equal(controller.view().undo, null);
});

test('removing a day twice removes once: one save, and the Undo offer still holds the dinner', async () => {
  const { controller, calls } = phone();
  await controller.init();
  await controller.plan(WED, 'r1');
  const before = calls.length;
  await Promise.all([controller.remove(WED), controller.remove(WED)]); // a double tap
  await controller.remove(WED); // and a late third
  assert.equal(calls.length - before, 1);
  assert.deepEqual(controller.view().undo, { day: WED, recipeId: 'r1' });
});

test('removing an empty day does nothing', async () => {
  const { controller, calls } = phone();
  await controller.init();
  await controller.remove(WED);
  assert.equal(calls.length, 0);
  assert.equal(controller.view().undo, null);
});

test('Undo works once, and any other change dismisses the offer first', async () => {
  const { controller, calls } = phone();
  await controller.init();
  await controller.plan(WED, 'r1');
  await controller.remove(WED);
  await controller.undo();
  const saves = calls.length;
  await controller.undo();
  assert.equal(calls.length, saves, 'a second Undo does nothing');
  await controller.remove(WED);
  await controller.plan(FRI, 'r2');
  assert.equal(controller.view().undo, null, 'planning something else ends the offer');
  await controller.undo();
  assert.equal(dinner(controller, WED), null, 'so Undo cannot bring back an older removal');
});

test('dismissUndo ends the offer without changing the plan', async () => {
  const { controller } = phone();
  await controller.init();
  await controller.plan(WED, 'r1');
  await controller.remove(WED);
  controller.dismissUndo();
  assert.equal(controller.view().undo, null);
  assert.equal(dinner(controller, WED), null);
});

test('a removal on one phone is not brought back by the other phone saving afterwards', async () => {
  const backing = fakeStorage();
  const a = phone(backing);
  const b = phone(backing);
  await a.controller.init();
  await b.controller.init();
  await a.controller.plan(WED, 'r1');
  await b.controller.refresh();
  await b.controller.remove(WED);
  await a.controller.plan(THU, 'r2'); // A still shows Wednesday until it reloads, then saves another day
  await a.controller.refresh();
  assert.equal(dinner(a.controller, WED), null);
  assert.equal(dinner(a.controller, THU), 'r2');
});

test('when a save fails: unavailable, the plan is not trusted, the Undo offer goes, and Retry saves it', async () => {
  const { controller, failures } = phone();
  await controller.init();
  await controller.plan(WED, 'r1');
  await controller.remove(WED);
  assert.ok(controller.view().undo);
  failures.save = true;
  await controller.plan(THU, 'r2');
  const v = controller.view();
  assert.equal(v.unavailable, true);
  assert.equal(v.plan, null);
  assert.equal(v.undo, null);
  failures.save = false;
  await controller.retry();
  assert.equal(controller.view().unavailable, false);
  assert.equal(dinner(controller, THU), 'r2');
});

test('changes made while unavailable wait behind the failed one and Retry replays them in order', async () => {
  const { controller, failures, calls } = phone();
  await controller.init();
  failures.save = true;
  await controller.plan(TUE, 'r1');
  await controller.plan(TUE, 'r2');
  await controller.plan(THU, 'r3');
  failures.save = false;
  calls.length = 0;
  await controller.retry();
  assert.deepEqual(calls, [[TUE, 'r1'], [TUE, 'r2'], [THU, 'r3']]);
  assert.equal(dinner(controller, TUE), 'r2');
  assert.equal(dinner(controller, THU), 'r3');
});

test('Retry that fails again stays unavailable and keeps the order for the next Retry', async () => {
  const { controller, failures, calls } = phone();
  await controller.init();
  failures.save = true;
  await controller.plan(TUE, 'r1');
  await controller.plan(WED, 'r2');
  await controller.retry();
  assert.equal(controller.view().unavailable, true);
  failures.save = false;
  calls.length = 0;
  await controller.retry();
  assert.deepEqual(calls, [[TUE, 'r1'], [WED, 'r2']]);
  assert.equal(controller.view().unavailable, false);
});

test('a failed move is retried as a whole: the new day is set and the old day cleared', async () => {
  const { controller, failures } = phone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  failures.save = true;
  await controller.plan(THU, 'r1');
  failures.save = false;
  await controller.retry();
  assert.equal(dinner(controller, THU), 'r1');
  assert.equal(dinner(controller, TUE), null);
});

/** A phone whose store lets `allow` saves through, then fails every save after that (a move cut off halfway). */
function halfFailingPhone() {
  const backing = fakeStorage();
  const inner = createLocalWeekStore({ storage: backing, now });
  const state = { allow: Infinity, saves: 0 };
  const store = {
    load: () => inner.load(),
    set: (day, id) => {
      if (state.saves >= state.allow) return Promise.reject(new Error('cut off'));
      state.saves++;
      return inner.set(day, id);
    },
  };
  const controller = createWeekController({ store, days });
  const heal = () => (state.allow = Infinity);
  return { controller, state, heal, inner };
}

test('a move cut off halfway (new day saved, old day not) is finished by Retry: old day cleared, banner gone', async () => {
  const { controller, state, heal, inner } = halfFailingPhone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  state.allow = state.saves + 1; // the first save of the move lands, the second fails
  await controller.plan(THU, 'r1');
  assert.equal(controller.view().unavailable, true);
  const half = await inner.load();
  assert.equal(dinnerOn(half, THU), 'r1', 'the new day was saved');
  assert.equal(dinnerOn(half, TUE), 'r1', 'the old day still holds it: a duplicate, not a loss');
  heal();
  const savesBefore = state.saves;
  await controller.retry();
  assert.equal(state.saves - savesBefore, 1, 'Retry writes only what is missing (the clear), not the day that already landed');
  assert.equal(controller.view().unavailable, false);
  assert.equal(dinner(controller, TUE), null, 'the old day is cleared');
  assert.equal(dinner(controller, THU), 'r1');
  assert.equal(dinnerOn(await inner.load(), TUE), null, 'and that is what was saved');
  assert.deepEqual(controller.view().note, { kind: 'moved', day: THU, from: TUE });
});

test('a move whose Retry is cut off again still finishes on the next Retry', async () => {
  const { controller, state, heal, inner } = halfFailingPhone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  state.allow = state.saves + 1;
  await controller.plan(THU, 'r1');
  await controller.retry(); // still failing: nothing may be forgotten
  assert.equal(controller.view().unavailable, true);
  heal();
  await controller.retry();
  assert.equal(controller.view().unavailable, false);
  assert.equal(dinnerOn(await inner.load(), TUE), null);
  assert.equal(dinnerOn(await inner.load(), THU), 'r1');
});

test('a move onto a day with a dinner, cut off halfway, still says what it replaced after Retry', async () => {
  const { controller, state, heal } = halfFailingPhone();
  await controller.init();
  await controller.plan(TUE, 'r1');
  await controller.plan(THU, 'r2');
  state.allow = state.saves + 1;
  await controller.plan(THU, 'r1');
  heal();
  await controller.retry();
  assert.equal(dinner(controller, TUE), null);
  assert.equal(dinner(controller, THU), 'r1');
  assert.deepEqual(controller.view().note, { kind: 'moved', day: THU, from: TUE, replaced: 'r2' });
});

test('a failed first load is retried; nothing else is saved while it is unavailable', async () => {
  const { controller, failures } = phone();
  failures.load = true;
  await controller.init();
  assert.equal(controller.view().unavailable, true);
  failures.load = false;
  await controller.retry();
  assert.equal(controller.view().unavailable, false);
  assert.deepEqual(controller.view().plan, {});
});

test('subscribers hear about each change and can stop listening', async () => {
  const { controller } = phone();
  let heard = 0;
  const stop = controller.subscribe(() => heard++);
  await controller.init();
  assert.ok(heard > 0);
  stop();
  const after = heard;
  await controller.plan(TUE, 'r1');
  assert.equal(heard, after);
});
