import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme, contrast, read } from './helpers.mjs';

const css = read('src/styles/global.css');
const report = (label, ratio) => console.log(`  contrast ${ratio.toFixed(2)}:1  ${label}`);

// Week plan (branch 3b): text pairs need 4.5:1, outlines and borders that name a control need 3:1. Existing tokens only.
for (const name of ['kk-light', 'kk-dark']) {
  test(`${name}: Week and Plan text >= 4.5:1, outlines >= 3:1`, () => {
    const t = theme(name);
    const text = [
      ['Plan button text (accent) on the card', t['--kk-accent-text'], t['--kk-card']],
      ['"Moved from" / "Replaced" note and plan status (accent) on the card', t['--kk-accent-text'], t['--kk-card']],
      ['dinner name on the card', t['--color-base-content'], t['--kk-card']],
      ['today label (accent) on the page', t['--kk-accent-text'], t['--color-base-100']],
      ['other day labels and the hint (muted) on the page', t['--kk-muted'], t['--color-base-100']],
      ['+ Add a dinner (accent) on the page', t['--kk-accent-text'], t['--color-base-100']],
      ['red Remove / Release to remove text on primary', t['--color-primary-content'], t['--color-primary']],
      ['sheet day and recipe names on the sheet', t['--color-base-content'], t['--color-base-100']],
      ['sheet status lines (muted) on the sheet', t['--kk-muted'], t['--color-base-100']],
    ];
    for (const [label, fg, bg] of text) {
      const r = contrast(fg, bg);
      report(`${name}: ${label} ${fg} on ${bg}`, r);
      assert.ok(r >= 4.5, `${label} = ${r.toFixed(2)}`);
    }
    const outlines = [
      ['Remove icon and Plan outline (accent) against the card', t['--kk-accent-text'], t['--kk-card']],
      ['dashed Add a dinner border (muted) against the page', t['--kk-muted'], t['--color-base-100']],
      ['red Remove area against the card it slides out from', t['--color-primary'], t['--kk-card']],
    ];
    for (const [label, fg, bg] of outlines) {
      const r = contrast(fg, bg);
      report(`${name}: ${label} ${fg} on ${bg}`, r);
      assert.ok(r >= 3, `${label} = ${r.toFixed(2)}`);
    }
  });
}

test('the week and plan rules take their colours from those tokens (no hard-coded colours)', () => {
  const rules = [...css.matchAll(/\.kk-(?:week|plan|sheet)[\w-]*[^{]*\{[^}]*\}/g)].map((m) => m[0]);
  assert.ok(rules.length >= 15, `found ${rules.length} week/plan rules`);
  for (const rule of rules) assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(rule), `hard-coded colour in: ${rule.slice(0, 60)}`);
  const remove = css.match(/^\.kk-week-remove\s*\{[^}]*\}/m)[0];
  assert.match(remove, /border:[^;]*var\(--kk-accent-text\)/);
  assert.match(remove, /color:\s*var\(--kk-accent-text\)/);
  const reveal = css.match(/^\.kk-week-reveal\s*\{[^}]*\}/m)[0];
  assert.match(reveal, /background:\s*var\(--color-primary\)/);
  assert.match(reveal, /color:\s*var\(--color-primary-content\)/);
});
