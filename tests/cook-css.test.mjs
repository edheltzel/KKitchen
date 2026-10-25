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
