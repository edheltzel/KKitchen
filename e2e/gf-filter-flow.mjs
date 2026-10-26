// The checks for the "Gluten-free per source" filter chip, shared by the fixture e2e and the real-build e2e.
// `d` describes the build being tested; every expectation below is the same behaviour on both.
//   d.total, d.flagged (names with the glutenFreePerSource flag), d.left (one name without it),
//   d.time + d.timeNames, d.meal + d.mealNames, d.search + d.searchNames (each combined with the chip),
//   d.zero ([group, value] of a chip that leaves nothing with the flag), d.zeroSearch (a word only an unflagged recipe has).
const CHIP = '#filter-tray [data-group="source"][data-value="stated"]'; // the sheet's chip (the chip row above the grid carries the same data attributes)
const LABEL = 'Gluten-free per source';
const plural = (n) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`;

export async function gfFlow(h, d) {
  const { ev, check, goto, text, visible, click, sleep, send } = h;
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const names = () => ev("[...document.querySelectorAll('#recipe-grid article')].filter((a) => !a.hidden).map((a) => a.dataset.name)");
  const loc = () => ev('location.pathname + location.search');
  const pressed = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).getAttribute('aria-pressed')`);
  const chipsRow = () => ev("[...document.querySelectorAll('#chips button')].map((b) => b.textContent.trim())");
  const typeInto = async (s) => { await ev("document.querySelector('#search-input').focus()"); await send('Input.insertText', { text: s }); await sleep(150); };
  const clearInput = async () => { await ev("(() => { const i = document.querySelector('#search-input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()"); await sleep(100); };

  await goto('/');
  check(`starts at ${plural(d.total)}, no chip row`, (await text('#recipe-count')) === plural(d.total) && !(await visible('#chips')), await text('#recipe-count'));

  // the chip is there, visible and tappable
  await click('#filters-button');
  await sleep(500);
  const box = await ev(`(() => { const c = document.querySelector(${JSON.stringify(CHIP)}); if (!c) return null; const r = c.getBoundingClientRect(), o = document.querySelector('#filter-tray [data-group="meal"]'); return { text: c.textContent.trim(), cls: c.className, h: r.height, w: r.width, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, pressed: c.getAttribute('aria-pressed'), sameClassAsOthers: c.className === o.className, fieldsets: [...c.closest('fieldset').querySelectorAll('legend')].map((l) => l.textContent.trim()) }; })()`);
  check('the chip is in the Filters sheet, visible on screen, worded "Gluten-free per source"', box && box.text === LABEL && box.inView, JSON.stringify(box));
  check('the chip is >= 44px tall and wide, uses the same classes as the other chips, starts unpressed', box && box.h >= 43.5 && box.w >= 43.5 && box.cls === 'kk-chip' && box.sameClassAsOthers && box.pressed === 'false', JSON.stringify(box));
  check('the chip sits under its own "From the source" heading', box && box.fieldsets[0] === 'From the source', JSON.stringify(box?.fieldsets));
  const sheetText = await ev("document.querySelector('#filter-tray').textContent.replace(/\\s+/g, ' ')");
  check('no bare "Gluten-free" anywhere in the sheet (only the careful wording)', !/gluten-free(?! per source)/i.test(sheetText), sheetText.slice(0, 120));

  // pressed and unpressed look exactly like the other chips (same rules, so the same contrast)
  const look = (sel) => ev(`(() => { const cs = getComputedStyle(document.querySelector(${JSON.stringify(sel)})); return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.fontWeight, cs.fontSize, cs.borderRadius].join('|'); })()`);
  const other = '#filter-tray [data-group="meal"][data-value="dinner"]';
  check('unpressed: the chip looks like the Meal chips (colour, background, border, font)', (await look(CHIP)) === (await look(other)), `${await look(CHIP)} vs ${await look(other)}`);
  await click(CHIP);
  await click(other);
  await sleep(150);
  check('pressed: the chip looks like a pressed Meal chip', (await look(CHIP)) === (await look(other)) && (await pressed(CHIP)) === 'true', `${await look(CHIP)} vs ${await look(other)}`);
  await click(other);
  await click(CHIP);

  // tap: only the flagged recipes
  await click(CHIP);
  check(`tap shows only the flagged recipes (${d.flagged.join(', ')})`, same(await names(), d.flagged) && (await text('#recipe-count')) === plural(d.flagged.length), JSON.stringify(await names()));
  check(`${d.left} is left out`, !(await names()).includes(d.left));
  check('the chip is pressed, the address says source=stated, the Filters badge says 1', (await pressed(CHIP)) === 'true' && (await loc()) === '/?source=stated' && (await text('#filters-count')) === '1', await loc());
  check('a removable chip shows above the grid with the careful wording and a 44px target', JSON.stringify(await chipsRow()) === JSON.stringify([LABEL]) && (await ev("(() => { const b = document.querySelector('#chips button'); const r = b.getBoundingClientRect(); return b.getAttribute('aria-label') === 'Remove filter: Gluten-free per source' && r.height >= 43.5 && r.width >= 43.5; })()")));
  const looks = await ev("(() => { const t = document.querySelector('#recipe-grid').textContent; return /gluten/i.test(t); })()");
  check('no gluten wording is added to any card (the filter changes no card layout)', looks === false);
  check('the page does not scroll sideways at 390px with the chip row showing', await ev('document.documentElement.scrollWidth <= innerWidth'));

  // combine with another filter and with search
  await click(`#filter-tray [data-group="time"][data-value="${d.time}"]`);
  check(`combines with the ${d.time}-minute chip (AND)`, same(await names(), d.timeNames), JSON.stringify(await names()));
  check('the address carries both', (await loc()) === `/?time=${d.time}&source=stated`, await loc());
  await click(`#filter-tray [data-group="time"][data-value="${d.time}"]`);
  await click(`#filter-tray [data-group="meal"][data-value="${d.meal}"]`);
  check(`combines with the ${d.meal} chip (AND)`, same(await names(), d.mealNames), JSON.stringify(await names()));
  await click(`#filter-tray [data-group="meal"][data-value="${d.meal}"]`);
  await click('#filter-tray form:not(.modal-backdrop) button');
  await typeInto(d.search);
  check(`combines with search "${d.search}"`, same(await names(), d.searchNames), JSON.stringify(await names()));
  await clearInput();

  // combining to zero shows the existing generic empty state, with no gluten claim
  await typeInto(d.zeroSearch);
  const emptyText = await text('#empty-message');
  check(`zero by search: the existing empty line "No recipe lists '${d.zeroSearch}' with these filters", shown, with no gluten wording`, (await visible('#empty')) && emptyText === `No recipe lists '${d.zeroSearch}' with these filters` && !/gluten/i.test(emptyText) && (await text('#recipe-count')) === '0 recipes', emptyText);
  check('the chip stays pressed and removable while empty', (await pressed(CHIP)) === 'true' && JSON.stringify(await chipsRow()) === JSON.stringify([LABEL]));
  await clearInput();
  check('clearing the search brings the flagged recipes back and hides the empty state', same(await names(), d.flagged) && !(await visible('#empty')));
  await click(`#filter-tray [data-group="${d.zero[0]}"][data-value="${d.zero[1]}"]`);
  const emptyText2 = await text('#empty-message');
  check('zero by filters: "No recipes match these filters", shown, with no gluten wording', (await visible('#empty')) && emptyText2 === 'No recipes match these filters' && !/gluten/i.test(emptyText2) && (await text('#recipe-count')) === '0 recipes', emptyText2);
  const emptyBox = await ev("(() => { const b = document.querySelector('#clear-all'); const r = b.getBoundingClientRect(); return r.height >= 43.5; })()");
  check('the empty state offers Clear (>= 44px)', (await visible('#clear-all')) && emptyBox);
  await click('#clear-all');
  check('Clear from the empty state resets everything: chip unpressed, all recipes, address "/", no badge', (await pressed(CHIP)) === 'false' && (await text('#recipe-count')) === plural(d.total) && (await loc()) === '/' && !(await visible('#filters-count')) && !(await visible('#empty')), `${await loc()} ${await text('#recipe-count')}`);

  // tapping again clears
  await click(CHIP);
  check('tap on, then tap again turns it off: all recipes, chip unpressed, no chip row, address "/"', (await names()).length === d.flagged.length);
  await click(CHIP);
  check('second tap clears the filter', (await pressed(CHIP)) === 'false' && (await text('#recipe-count')) === plural(d.total) && (await loc()) === '/' && !(await visible('#chips')) && (await names()).length === d.total, `${await loc()} ${await text('#recipe-count')}`);

  // the little chip above the grid removes it too
  await click(CHIP);
  await click('#chips button');
  check('removing the chip above the grid clears the filter', (await pressed(CHIP)) === 'false' && (await text('#recipe-count')) === plural(d.total) && (await loc()) === '/');

  // reset from the sheet, with search kept
  await click(CHIP);
  await click(`#filter-tray [data-group="time"][data-value="${d.time}"]`);
  await click('#clear-filters');
  check('Clear filters in the sheet resets the chip and the other filters', (await pressed(CHIP)) === 'false' && (await text('#recipe-count')) === plural(d.total) && (await loc()) === '/' && !(await visible('#filters-count')), await loc());

  // shared link and refresh
  await click('#filter-tray form:not(.modal-backdrop) button');
  await goto('/?source=stated');
  check('a shared link /?source=stated restores the filter, the badge and the pressed chip', same(await names(), d.flagged) && (await text('#filters-count')) === '1' && (await pressed(CHIP)) === 'true' && JSON.stringify(await chipsRow()) === JSON.stringify([LABEL]), JSON.stringify(await names()));
  await ev('location.reload()');
  await sleep(600);
  await h.waitFor("document.readyState === 'complete'");
  check('refresh keeps it', same(await names(), d.flagged) && (await loc()) === '/?source=stated', await loc());
  await goto('/?source=nonsense');
  check('an unknown source value in the address is ignored', (await text('#recipe-count')) === plural(d.total) && !(await visible('#chips')) && (await loc()) === '/', await loc());
}
