import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme, contrast, read } from './helpers.mjs';

const css = read('src/styles/global.css');
const report = (label, ratio) => console.log(`  contrast ${ratio.toFixed(2)}:1  ${label}`);

// Every new text/background pair from branch 2, in both themes, using existing kk tokens only.
for (const name of ['kk-light', 'kk-dark']) {
  test(`${name}: chips, tray, empty state and count badge text >= 4.5:1`, () => {
    const t = theme(name);
    const pairs = [
      ['tray chip text on card', t['--color-base-content'], t['--kk-card']],
      ['selected chip / badge / Clear / Done text on primary', t['--color-primary-content'], t['--color-primary']],
      ['tray title and empty message on page', t['--color-base-content'], t['--color-base-100']],
      ['empty message on empty-state card', t['--color-base-content'], t['--kk-card']],
      ['tray group legend and hint (muted) on page', t['--kk-muted'], t['--color-base-100']],
      ['Clear filters link (accent) on page', t['--kk-accent-text'], t['--color-base-100']],
    ];
    for (const [label, fg, bg] of pairs) {
      const r = contrast(fg, bg);
      report(`${name}: ${label} ${fg} on ${bg}`, r);
      assert.ok(r >= 4.5, `${label} = ${r.toFixed(2)}`);
    }
  });
}

test('chip styles use those same tokens (no new colours)', () => {
  const chip = css.match(/\.kk-chip\s*\{[^}]*\}/)?.[0] ?? '';
  const on = css.match(/\.kk-chip\[aria-pressed='true'\][^{]*\{[^}]*\}/)?.[0] ?? '';
  assert.match(chip, /background:\s*var\(--kk-card\)/);
  assert.match(chip, /color:\s*var\(--color-base-content\)/);
  assert.match(on, /background:\s*var\(--color-primary\)/);
  assert.match(on, /color:\s*var\(--color-primary-content\)/);
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(chip + on), 'no hard-coded colours');
});
