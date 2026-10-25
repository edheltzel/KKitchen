import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { allExampleNotes, exampleRecipes, exampleTitle, flatItems } from '../src/data/examples.ts';
import { root, read, decode, distFiles } from './helpers.mjs';

const raw = (r) => read(`dist/cook/${r.id}/index.html`);
const page = (r) => decode(raw(r));
const data = (r) => JSON.parse(raw(r).match(/<script id="cook-data" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));

test('one cooking page per approved recipe, and none for a note that is not approved', () => {
  assert.deepEqual(readdirSync(join(root, 'dist/cook')).sort(), exampleRecipes.map((r) => r.id).sort());
  for (const r of allExampleNotes.filter((n) => !n.approved)) assert.ok(!existsSync(join(root, 'dist/cook', r.id)));
});

test('noindex, titled with the recipe, and no tab bar (cooking mode hides it)', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.ok(html.includes(`<title>Cooking ${exampleTitle(r)}`), `${r.id}: title`);
    assert.ok(!/kk-dock/.test(html), `${r.id}: no tab bar`);
    assert.ok(!/aria-label="Main"|data-tab=/.test(html));
  }
});

test('Exit is a link to the recipe page, at the top, before the progress segments', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    const exit = html.match(/<a [^>]*id="exit"[^>]*>/);
    assert.ok(exit, `${r.id}: exit link`);
    assert.match(exit[0], new RegExp(`href="/recipe/${r.id}/"`));
    assert.ok(html.indexOf('id="exit"') < html.indexOf('id="cook-progress"'));
  }
});

test('progress: one named segment per step, none highlighted until the script runs', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    const list = html.match(/<ol[^>]*id="cook-progress"[^>]*>([\s\S]*?)<\/ol>/);
    assert.ok(list, `${r.id}: progress list`);
    const segs = [...list[1].matchAll(/<li[^>]*>/g)].map((m) => m[0]);
    assert.equal(segs.length, r.steps.length);
    segs.forEach((seg, i) => assert.match(seg, new RegExp(`aria-label="Step ${i + 1} of ${r.steps.length}: to do"`)));
  }
});

test('Gather: every ingredient as a tick row saved under the same item id as the recipe page, a count, and the Start button', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    const boxes = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*data-item="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    assert.deepEqual(boxes, flatItems(r).map((i) => i.id), `${r.id}: item ids in order`);
    for (const item of flatItems(r)) assert.ok(html.includes(item.text), `${r.id}: ${item.text}`);
    assert.match(html, /<h2[^>]*id="gather-title"[^>]*>Gather<\/h2>/);
    assert.match(html, new RegExp(`id="ready-count"[^>]*>0 of ${flatItems(r).length} ready`));
    assert.match(html, /<button[^>]*id="start"[^>]*>[\s\S]*?Start step 1/);
  }
});

test('the steps and the ingredients each step marks travel as one escaped JSON block', () => {
  for (const r of exampleRecipes) {
    const d = data(r);
    assert.deepEqual(d.steps.map((s) => s.text), r.steps.map((s) => s.text));
    assert.deepEqual(d.steps.map((s) => s.uses ?? []), r.steps.map((s) => s.uses ?? []));
    for (const item of flatItems(r)) assert.equal(d.items[item.id], item.text);
    assert.ok(!/<\/script/i.test(raw(r).match(/<script id="cook-data"[\s\S]*?<\/script>/)[0].slice(0, -9)), 'no early </script>');
  }
});

test('step screen: a focus-target heading, live step text, Use now list, Next as the main control and Back secondary', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    assert.match(html, /<h2[^>]*id="step-heading"[^>]*tabindex="-1"/);
    assert.match(html, /<p[^>]*id="step-text"[^>]*aria-live="polite"/);
    assert.match(html, /id="use-now"/);
    assert.match(html, /<button[^>]*id="next"[^>]*class="[^"]*btn-primary/);
    const back = html.match(/<button[^>]*id="back-step"[^>]*>/);
    assert.ok(back && !/btn-primary/.test(back[0]), 'Back is not the primary button');
    assert.ok(html.indexOf('id="back-step"') < html.indexOf('id="next"'));
    assert.match(html, /Tap the right side of the screen to go forward/);
  }
});

test('Done: "Dinner\'s ready", the cleared-checks note, the Loved it / Not for us buttons, the person picker and Back to recipes', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    assert.match(html, /<h2[^>]*id="done-title"[^>]*>Dinner's ready<\/h2>/);
    assert.ok(html.includes('Ingredient checks are cleared for next time'));
    assert.match(html, /data-rating="loved"[^>]*>[\s\S]*?Loved it/);
    assert.match(html, /data-rating="not-for-us"[^>]*>[\s\S]*?Not for us/);
    assert.match(html, /data-person="ed"[^>]*>Ed: not rated yet/);
    assert.match(html, /data-person="kristina"[^>]*>Kristina: not rated yet/);
    assert.match(html, /id="me-picker"/);
    assert.match(html, /<a [^>]*id="back-to-recipes"[^>]*>Back to recipes<\/a>/);
  }
});

test('keep-awake: the pill, the "may sleep" chip and the banner text (hidden until needed) with Got it', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    assert.match(html, /id="wake-status"/);
    assert.match(html, /<div[^>]*id="wake-banner"[^>]*hidden/);
    assert.ok(html.includes("Couldn't keep the screen on. Set Auto-Lock to Never in Settings."));
    assert.match(html, /<button[^>]*id="wake-dismiss"[^>]*>Got it<\/button>/);
  }
});

test('the shared bars are there: Undo, ratings and checks notices; and nothing from the recipe-page-only Plan', () => {
  for (const r of exampleRecipes) {
    const html = page(r);
    for (const id of ['undo-bar', 'undo-text', 'undo-button', 'ratings-unavailable', 'ratings-retry', 'ticks-unavailable', 'ticks-retry']) assert.match(html, new RegExp(`id="${id}"`), `${r.id}: #${id}`);
    assert.ok(!/id="plan-sheet"/.test(html));
  }
});

test('nothing hidden leaks into the cooking pages', () => {
  for (const file of distFiles(join(root, 'dist/cook'))) {
    const text = read(file.slice(root.length + 1));
    for (const secret of ['Hidden Draft Note', 'Draft-only', 'saffron', 'Nut-free', 'example-7']) assert.ok(!text.includes(secret), `${file}: ${secret}`);
  }
});
