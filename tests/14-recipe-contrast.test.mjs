import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme, contrast, read } from './helpers.mjs';

const css = read('src/styles/global.css');
const report = (label, ratio) => console.log(`  contrast ${ratio.toFixed(2)}:1  ${label}`);

// Recipe page (branch 4a): text pairs need 4.5:1, controls and focus rings need 3:1. Existing tokens only.
for (const name of ['kk-light', 'kk-dark']) {
  test(`${name}: recipe page text >= 4.5:1, controls >= 3:1`, () => {
    const t = theme(name);
    const text = [
      ['Back link and original recipe link (accent) on the page', t['--kk-accent-text'], t['--color-base-100']],
      ['Reset checks text (accent) on the page', t['--kk-accent-text'], t['--color-base-100']],
      ['tag text on the tag pill (card colour)', t['--color-base-content'], t['--kk-card']],
      ['ingredient and step text on the page', t['--color-base-content'], t['--color-base-100']],
      ['ticked ingredient (muted, struck through) on the page', t['--kk-muted'], t['--color-base-100']],
      ['step number on its primary circle', t['--color-primary-content'], t['--color-primary']],
    ];
    for (const [label, fg, bg] of text) {
      const r = contrast(fg, bg);
      report(`${name}: ${label} ${fg} on ${bg}`, r);
      assert.ok(r >= 4.5, `${label} = ${r.toFixed(2)}`);
    }
    const controls = [
      ['tick box and focus ring (primary) against the page', t['--color-primary'], t['--color-base-100']],
      ['Reset checks outline (accent) against the page', t['--kk-accent-text'], t['--color-base-100']],
    ];
    for (const [label, fg, bg] of controls) {
      const r = contrast(fg, bg);
      report(`${name}: ${label} ${fg} on ${bg}`, r);
      assert.ok(r >= 3, `${label} = ${r.toFixed(2)}`);
    }
  });
}

test('the recipe page rules take their colours from tokens (no hard-coded colours)', () => {
  const rules = [...css.matchAll(/^\.kk-(?:back|hero|tag|source|reset|ticks?|tick-box|steps)[^{]*\{[^}]*\}/gm)].map((m) => m[0]);
  assert.ok(rules.length >= 12, `found ${rules.length} recipe page rules`);
  for (const rule of rules) assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(rule), `hard-coded colour in: ${rule.slice(0, 60)}`);
  assert.match(css.match(/^\.kk-tick-box\s*\{[^}]*\}/m)[0], /accent-color:\s*var\(--color-primary\)/);
  assert.match(css.match(/^\.kk-steps > li::before\s*\{[^}]*\}/m)[0], /background:\s*var\(--color-primary\)[^}]*color:\s*var\(--color-primary-content\)/);
});
