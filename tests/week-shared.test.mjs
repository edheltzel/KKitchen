import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedWeek } from '../src/lib/week-shared.ts';

// The statements the shared week runs, against an in-memory table. Enough to prove the rules, not the SQL.
const fakeDb = () => {
  const rows = [];
  const seen = new Map();
  const key = (day, meal) => `${day}/${meal}`;
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              const [day, meal] = args;
              return { results: rows.filter((row) => row.day === day && row.meal === meal).sort((a, b) => a.position - b.position) };
            },
            async run() {
              if (sql.startsWith('DELETE')) {
                for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].day === args[0] && rows[i].meal === args[1]) rows.splice(i, 1);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('UPDATE meal_slots')) {
                const [next, day, meal, previous] = args;
                const changed = seen.get(key(day, meal)) === previous;
                if (changed) seen.set(key(day, meal), next);
                return { meta: { changes: changed ? 1 : 0 } };
              }
              if (sql.startsWith('INSERT INTO meal_slots')) {
                const [week, day, meal, next] = args;
                if (seen.has(key(day, meal))) return { meta: { changes: 0 } };
                seen.set(key(day, meal), next);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('INSERT INTO slot_items')) {
                const [week, day, meal, position, recipeId] = args;
                rows.push({ week, day, meal, position, recipe_id: recipeId });
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
};

test('adding a recipe to an empty dinner writes it', async () => {
  const week = createSharedWeek(fakeDb());
  const saved = await week.set('2026-11-16', 'dinner', ['roast'], []);
  assert.deepEqual(saved.recipes, ['roast']);
  assert.equal(saved.week, '2026-11-16');
});

test('a write that last saw a different list is refused and changes nothing', async () => {
  const week = createSharedWeek(fakeDb());
  await week.set('2026-11-16', 'dinner', ['roast'], []);
  const result = await week.set('2026-11-16', 'dinner', ['soup'], []);
  assert.equal(result.conflict, true);
  assert.deepEqual(result.current, ['roast']);
  assert.deepEqual((await week.get('2026-11-16', 'dinner')).recipes, ['roast']);
});

test('a replace that confirms the current list overwrites it', async () => {
  const week = createSharedWeek(fakeDb());
  await week.set('2026-11-16', 'dinner', ['roast'], []);
  const saved = await week.set('2026-11-16', 'dinner', ['soup'], ['roast']);
  assert.deepEqual(saved.recipes, ['soup']);
});

test('a meal from an older week is still there', async () => {
  const week = createSharedWeek(fakeDb());
  await week.set('2026-10-05', 'breakfast', ['oats', 'eggs'], []);
  const slot = await week.get('2026-10-05', 'breakfast');
  assert.equal(slot.week, '2026-10-05');
  assert.deepEqual(slot.recipes, ['oats', 'eggs']);
});
