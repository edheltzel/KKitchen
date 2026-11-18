# Kris's Kitchen

Recipes site for the family. Local-only for now.

Stack: Astro + Tailwind CSS 4 + daisyUI 5 (versions pinned exactly in `package.json`), with two themes: `kk-light` and `kk-dark` (automatic via `prefers-color-scheme`).

```
npm install
npm run build
```

## Recipe data

- `src/data/recipes.ts` holds the real recipes (three so far), written by hand from the captain's notes. `npm run build` ships only these.
- `src/data/examples.ts` holds the old example recipes as a **test fixture**. Only a build or test run with `KK_DATA=fixture` uses them, and `npm test` sets that for you. Run `node --test` on its own and you must set `KK_DATA=fixture` yourself. `npm run e2e` builds the fixture into `dist` itself, then runs every e2e script. To run one e2e file on its own, run `npm test` first (it leaves the same fixture build in `dist`). Like `npm test`, `npm run e2e` leaves the fixture in `dist`.
- `tests/17-real-build.test.mjs` builds the site with no `KK_DATA` into a temp folder and scans it: no example recipe, no vault path, no Example badge.
- These three notes had no `approved: true` marker. The captain asked for them by name, so they are treated as approved.
- The gluten-free tag is held until the captain confirms it (the fried chicken is still open). No recipe has any tag, so there is no badge and no diet filter value.
  The titles drop the gluten-free wording until Ed or Kristina confirm each recipe (Fried Chicken, High Protein Brownies), and sources and ingredient lines stay as written.
  Instead, `glutenFreePerSource: true` on the fried chicken and the brownies (the two whose sources say so) shows one small label on the recipe page, "Gluten-free per the original recipe", not in the title.
  It adds no tag, card badge or search text, and it is not on the roast.
  The same flag also drives one "Gluten-free per source" filter chip in the Filters sheet (under "From the source"): it reads only `glutenFreePerSource`, so it shows the fried chicken and the brownies and never the roast, and nothing is inferred from ingredients or titles.
  It combines with the other filters and search like any chip, and a zero result uses the usual generic empty line. The chip is drawn only when some recipe has the flag.
  It is checked in `e2e/gf-filter.e2e.mjs` (fixture build, where Overnight Oats and Lemon Rice Bowl carry the flag as example data only) and `e2e/gf-filter-real.e2e.mjs` (builds the real recipes into a temp folder).
- `source` shows as the "Original recipe" link. `author` is stored only: no page shows credit yet.
- Time: the card and the meta line show prep + cook. A wait (the fried chicken marinate) is a note, not part of that total. A note with no prep time (the brownies) has `prep: 0`, and the meta line then leaves prep out.
- The week plan offers every recipe on every dinner day. `meal` is not used there, so the brownies (a snack) can be planned like a dinner.

## Publishing

- `npm test` leaves the example fixture in `dist`, so a deploy must never go straight after it. Run `npm test && rm -rf dist && npm run build`, then deploy.
- Check with `ls dist/recipe`: only the three real folders (`fried-chicken`, `high-protein-brownies`, `slow-cooker-roast`).
- A rollback does the same in its temp folder: `npm ci && npm test && rm -rf dist && npm run build`, then deploy.
