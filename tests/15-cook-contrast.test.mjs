// Cooking mode colors: the dark "Couldn't keep the screen on" banner, the Screen stays on pill and the Screen may sleep chip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme, contrast } from './helpers.mjs';

const themes = { 'kk-light': theme('kk-light'), 'kk-dark': theme('kk-dark') };
const report = (label, ratio) => console.log(`  contrast ${ratio.toFixed(2)}:1  ${label}`);

for (const [name, t] of Object.entries(themes)) {
  test(`${name}: banner text and its "Got it" accent are >= 4.5 on the dark banner`, () => {
    for (const token of ['--kk-banner', '--kk-banner-text', '--kk-banner-accent']) assert.ok(t[token], `${token} exists`);
    for (const [label, fg] of [['text', t['--kk-banner-text']], ['Got it', t['--kk-banner-accent']]]) {
      const r = contrast(fg, t['--kk-banner']);
      report(`${name} banner ${label} ${fg} on ${t['--kk-banner']}`, r);
      assert.ok(r >= 4.5, `${label} ${r}`);
    }
  });

  test(`${name}: "Screen stays on" pill (base-100 on base-content) and the "Screen may sleep" chip (muted on base-100 and card) are >= 4.5`, () => {
    const pill = contrast(t['--color-base-100'], t['--color-base-content']);
    report(`${name} pill`, pill);
    assert.ok(pill >= 4.5);
    for (const bg of [t['--color-base-100'], t['--kk-card']]) {
      const r = contrast(t['--kk-muted'], bg);
      report(`${name} chip muted on ${bg}`, r);
      assert.ok(r >= 4.5);
    }
  });

  test(`${name}: progress segments (primary vs base-300 track) are told apart by >= 3:1 against the page`, () => {
    for (const color of [t['--color-primary'], t['--color-base-300']]) {
      assert.ok(color);
    }
    const done = contrast(t['--color-primary'], t['--color-base-100']);
    report(`${name} segment done on page`, done);
    assert.ok(done >= 3);
  });
}
