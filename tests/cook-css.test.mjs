import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

const css = read('src/styles/global.css');
const start = css.indexOf('/* Cooking mode (branch 4b)');

test('cooking mode CSS has no transition or animation outside the no-preference media block (reduced motion is respected)', () => {
  const section = css.slice(start);
  const block = section.indexOf('@media (prefers-reduced-motion: no-preference)');
  assert.ok(block > 0, 'the no-preference block exists');
  const outside = section.slice(0, block);
  assert.ok(!/transition|animation|scroll-behavior/.test(outside), 'no motion outside the block');
  assert.match(section.slice(block), /transition/);
});

test('the cook screens obey [hidden] (flex would otherwise win) and every tap target is at least 44px', () => {
  assert.match(css, /\.kk-cook-screen\[hidden\][\s\S]*?display: none/);
  const section = css.slice(start);
  for (const cls of ['.kk-exit,', '.kk-wake-dismiss', '.kk-cook-main', '.kk-cook-back']) assert.ok(section.includes(cls), cls);
  for (const m of section.matchAll(/min-height: ([\d.]+)rem/g)) assert.ok(Number(m[1]) >= 2.25, m[0]);
});

test('on a step the Use now rows are not struck through or greyed; the strike stays the general rule (Gather)', () => {
  assert.match(css, /\.kk-use-now \.kk-tick:has\(input:checked\) span \{\s*color: inherit;\s*text-decoration: none;\s*\}/);
  assert.match(css, /\.kk-tick:has\(input:checked\) span \{[^}]*line-through/);
  assert.match(read('src/pages/cook/[id].astro'), /id="use-now" class="[^"]*kk-use-now/);
});

test('over 900px the step sentence, Use now rows and Next step scale up; the phone sizes stay in the base rules', () => {
  const m = css.match(/@media \(min-width: 901px\) \{([\s\S]*?)\n\}\n/);
  assert.ok(m, 'a min-width 901px block in the cooking section');
  assert.ok(css.indexOf(m[0]) > start);
  for (const sel of ['.kk-step-text', '.kk-ticks-big .kk-tick', '.kk-cook-main']) assert.ok(m[1].includes(sel), sel);
  assert.match(m[1], /\.kk-step-text \{\s*font-size: 2\.5rem/);
  assert.match(css, /\.kk-step-text \{[^}]*font-size: 1\.875rem/);
  for (const x of m[1].matchAll(/min-height: ([\d.]+)rem/g)) assert.ok(Number(x[1]) >= 2.25);
});
