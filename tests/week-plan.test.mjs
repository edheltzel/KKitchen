import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekDays, weekRange, isValidDay, dinnerOn, dayOfRecipe, mergePlans, sanitizePlan, planChange } from '../src/scripts/week-plan.ts';

const keys = (today) => weekDays(today).map((d) => d.key);

test('the week runs Monday to Sunday and contains today', () => {
  assert.deepEqual(keys(new Date(2026, 9, 29)), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.deepEqual(weekDays(new Date(2026, 9, 29)).map((d) => d.short), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(weekDays(new Date(2026, 9, 29)).map((d) => d.long)[1], 'Tuesday');
});

test('Sunday belongs to the week that started the Monday before; Monday starts a new one', () => {
  assert.equal(keys(new Date(2026, 9, 25))[0], '2026-10-19');
  assert.equal(keys(new Date(2026, 9, 26))[0], '2026-10-26');
});

test('weeks cross month, year and daylight-saving changes without skipping or repeating a day', () => {
  assert.deepEqual(keys(new Date(2026, 11, 31)), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.deepEqual(keys(new Date(2026, 9, 31, 23, 59)).slice(5), ['2026-10-31', '2026-11-01']);
  assert.equal(new Set(keys(new Date(2026, 2, 12))).size, 7); // 2026-03-08 is the spring-forward Sunday
});

test('the range reads like "Oct 26 – Nov 1", and like "Dec 28 – Jan 3" across a year', () => {
  assert.equal(weekRange(weekDays(new Date(2026, 9, 29))), 'Oct 26 – Nov 1');
  assert.equal(weekRange(weekDays(new Date(2026, 11, 31))), 'Dec 28 – Jan 3');
});

test('isValidDay accepts real calendar dates only', () => {
  assert.equal(isValidDay('2026-10-29'), true);
  for (const bad of ['2026-02-30', '2026-13-01', '26-10-29', '2026-10-29T00:00', '', 5, null, '__proto__']) assert.equal(isValidDay(bad), false, String(bad));
});

test('merging two phones: a newer removal beats the older dinner, in either order', () => {
  const phoneA = { '2026-10-28': { recipeId: 'r-soup', at: 100 }, '2026-10-29': { recipeId: 'r-pasta', at: 100 } };
  const phoneB = { '2026-10-28': { recipeId: null, at: 200 } }; // B removed Wednesday after A planned it
  for (const merged of [mergePlans(phoneA, phoneB), mergePlans(phoneB, phoneA)]) {
    assert.deepEqual(merged['2026-10-28'], { recipeId: null, at: 200 });
    assert.equal(dinnerOn(merged, '2026-10-28'), null, 'the removed dinner does not come back');
    assert.equal(dinnerOn(merged, '2026-10-29'), 'r-pasta', 'days nobody touched are kept');
  }
});

test('merging two phones: a newer plan beats an older removal, and the empty entry is kept with its time', () => {
  const removedEarly = { '2026-10-28': { recipeId: null, at: 100 } };
  const plannedLater = { '2026-10-28': { recipeId: 'r-oats', at: 300 } };
  assert.equal(dinnerOn(mergePlans(removedEarly, plannedLater), '2026-10-28'), 'r-oats');
  assert.deepEqual(mergePlans(removedEarly, {}), removedEarly);
});

test('merging with the same time picks the same winner in either order (a removal wins a tie)', () => {
  const a = { '2026-10-28': { recipeId: 'r-a', at: 50 } };
  const b = { '2026-10-28': { recipeId: null, at: 50 } };
  const c = { '2026-10-28': { recipeId: 'r-b', at: 50 } };
  assert.deepEqual(mergePlans(a, b), mergePlans(b, a));
  assert.equal(dinnerOn(mergePlans(a, b), '2026-10-28'), null);
  assert.deepEqual(mergePlans(a, c), mergePlans(c, a));
});

test('merging does not change its inputs', () => {
  const a = { '2026-10-28': { recipeId: 'r-a', at: 1 } };
  const b = { '2026-10-28': { recipeId: 'r-b', at: 2 } };
  const copyA = JSON.stringify(a);
  const out = mergePlans(a, b);
  out['2026-10-28'].recipeId = 'changed';
  assert.equal(JSON.stringify(a), copyA);
  assert.equal(b['2026-10-28'].recipeId, 'r-b');
});

test('sanitizePlan keeps good days and drops anything malformed, including prototype keys', () => {
  const raw = JSON.parse(
    '{"2026-10-28":{"recipeId":"r1","at":5},"2026-10-29":{"recipeId":null,"at":6},"nope":{"recipeId":"r1","at":1},"2026-10-30":{"recipeId":"bad id!","at":1},"2026-10-31":{"recipeId":"r1","at":"x"},"2026-11-01":{"recipeId":7,"at":2},"__proto__":{"recipeId":"r1","at":1},"2026-02-30":{"recipeId":"r1","at":1}}',
  );
  assert.deepEqual(sanitizePlan(raw), { '2026-10-28': { recipeId: 'r1', at: 5 }, '2026-10-29': { recipeId: null, at: 6 } });
  for (const junk of [null, 'x', 7, [], undefined]) assert.deepEqual(sanitizePlan(junk), {});
});

const days = keys(new Date(2026, 9, 29));
const [mon, tue, wed] = days;

test('dayOfRecipe finds where a dinner is planned this week, and ignores removed days', () => {
  const plan = { [tue]: { recipeId: 'r1', at: 1 }, [wed]: { recipeId: null, at: 2 } };
  assert.equal(dayOfRecipe(plan, days, 'r1'), tue);
  assert.equal(dayOfRecipe(plan, days, 'r2'), null);
  assert.equal(dayOfRecipe({ '2026-01-01': { recipeId: 'r1', at: 1 } }, days, 'r1'), null, 'other weeks do not count');
});

test('planning on an empty day is a plain plan', () => {
  assert.deepEqual(planChange({}, days, tue, 'r1'), { writes: [{ day: tue, recipeId: 'r1' }], note: { kind: 'planned', day: tue } });
});

test('planning on a day that has a dinner replaces it and says what it replaced', () => {
  const plan = { [tue]: { recipeId: 'r1', at: 1 } };
  assert.deepEqual(planChange(plan, days, tue, 'r2'), { writes: [{ day: tue, recipeId: 'r2' }], note: { kind: 'replaced', day: tue, replaced: 'r1' } });
});

test('planning a recipe that is on another day MOVES it: new day set, old day cleared, "Moved from" note', () => {
  const plan = { [tue]: { recipeId: 'r1', at: 1 } };
  assert.deepEqual(planChange(plan, days, wed, 'r1'), {
    writes: [{ day: wed, recipeId: 'r1' }, { day: tue, recipeId: null }],
    note: { kind: 'moved', day: wed, from: tue },
  });
});

test('moving onto a day that has another dinner moves and replaces; it never leaves two of the same dinner', () => {
  const plan = { [mon]: { recipeId: 'r2', at: 1 }, [tue]: { recipeId: 'r1', at: 1 } };
  const change = planChange(plan, days, mon, 'r1');
  assert.deepEqual(change.writes, [{ day: mon, recipeId: 'r1' }, { day: tue, recipeId: null }]);
  assert.deepEqual(change.note, { kind: 'moved', day: mon, from: tue, replaced: 'r2' });
});

test('planning the dinner that is already on that day changes nothing', () => {
  const plan = { [tue]: { recipeId: 'r1', at: 1 } };
  assert.deepEqual(planChange(plan, days, tue, 'r1'), { writes: [], note: null });
});

test('planning on a day outside this week, or an invalid recipe id, is refused', () => {
  assert.throws(() => planChange({}, days, '2026-01-01', 'r1'), /day/i);
  assert.throws(() => planChange({}, days, tue, 'bad id!'), /recipe/i);
});

import { noteText } from '../src/scripts/week-plan.ts';

test('noteText says it in words: "Moved from Tuesday", "Replaced Tomato Soup", nothing for a plain plan', () => {
  const week = weekDays(new Date(2026, 9, 29));
  const long = (key) => week.find((d) => d.key === key).long;
  const name = (id) => ({ r1: 'Weeknight Pasta', r2: 'Tomato Soup' })[id] ?? 'A recipe';
  assert.equal(noteText({ kind: 'moved', day: wed, from: tue }, long, name), 'Moved from Tuesday');
  assert.equal(noteText({ kind: 'moved', day: wed, from: tue, replaced: 'r2' }, long, name), 'Moved from Tuesday. Replaced Tomato Soup.');
  assert.equal(noteText({ kind: 'replaced', day: wed, replaced: 'r1' }, long, name), 'Replaced Weeknight Pasta');
  assert.equal(noteText({ kind: 'planned', day: wed }, long, name), null);
  assert.equal(noteText(null, long, name), null);
});
