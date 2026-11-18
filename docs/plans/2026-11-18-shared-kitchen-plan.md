# Shared kitchen

## Outcome

Ed and Kristina share one week of meals, one set of ratings and one set of recipes from either phone or a computer. This replaces each phone keeping its own copy in `localStorage`. Requirements: `docs/plans/2026-11-18-shared-kitchen-requirements.md`.

The project is a static Astro 7 site (`astro.config.mjs`, output not set) with no server routes. `wrangler.jsonc` only serves `./dist` as assets. The stores in `src/scripts/week-store.ts`, `ratings-store.ts` and `ticks-store.ts` were written as local stand-ins and say so at the top of each file. The week stand-in still enforces one dinner per day.

Recipe markdown is written to a Cloudflare R2 bucket, not to the Worker's files, which a request cannot change. The three real recipes are `fried-chicken`, `slow-cooker-roast` and `high-protein-brownies` (`src/data/recipes.ts:12`, `:58`, `:112`). R2's free tier is 10 GB and well beyond two people. Ed named Access and D1. R2 is added here because those two cannot store a file a request creates. It stays on the free tier.

## Implementation Units

### U1. Server rendering and the database

- Depends on: none
- Files: `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `db/schema.sql`, `src/env.d.ts`
- Change: Add `@astrojs/cloudflare` and switch the site to server rendering so a page can read D1. Add a D1 binding and an R2 bucket binding to `wrangler.jsonc`, and a schema for people, recipes, weeks, meal slots, slot items, ratings and ticks. Run `wrangler types` so the bindings are typed. Create the database and apply the schema with `wrangler d1` against the local database only. Do not deploy.
- Done when: `astro dev` serves a page that reads one row from the local D1 database.
- Verify: `npx astro build` succeeds, and `npx wrangler d1 execute <db> --local --command "SELECT name FROM sqlite_master"` lists the new tables.
- Done: the build prerenders inside workerd, which cannot see the shell, so `KK_DATA` travels through `wrangler.jsonc`'s `vars` and `scripts/with-fixture.mjs` sets it for the test and e2e builds. The existing pages are prerendered, because server rendering writes nothing for the tests to read. `src/pages/db.astro` is the page that reads the row, and goes away once a real page does.

### U2. Sign-in for two people

- Depends on: U1
- Files: `src/middleware.ts`, `src/pages/who.astro`, `src/scripts/who.ts`
- Change: Read the signed-in email from Cloudflare Access (`ctx.access.getIdentity()`) and map it to Ed or Kristina. Reject every other request. Locally, simulate the two identities from `wrangler.jsonc`'s `access.dev` block so the app runs without Access configured. Replace the "I'm Ed / I'm Kristina" picker (`src/scripts/ratings-store.ts` `IDENTITY_KEY`) with the signed-in person. The real Access application, the email allowlist and the One-time PIN are configured in the Cloudflare dashboard, not in this repo, and are named here so they are not forgotten at deploy time.
- Done when: A request with Ed's simulated identity is Ed, Kristina's is Kristina, and any other identity gets no page.
- Verify: `node --test tests/who.test.mjs` covers the three identities against the middleware.
- Done: `access.dev` returns one mock identity, so local dev runs as Ed and Kristina is covered by the test rather than a second running server. The middleware lets a request through only when Access is absent, which is the prerender build. A real request always has it. The "I'm Ed / I'm Kristina" picker still sets `kk:me`; replacing it belongs with the shared ratings in U6, where that key is read.

### U3. Recipes become markdown

- Depends on: U1
- Files: `src/content/recipes/fried-chicken.md`, `src/content/recipes/slow-cooker-roast.md`, `src/content/recipes/high-protein-brownies.md`, `src/lib/recipes.ts`, `src/lib/recipe-file.ts`, `src/data/recipes.ts`, `src/data/examples.ts`
- Change: Write the three real recipes from `src/data/recipes.ts` as markdown with front matter (name, minutes, meal, prep, cook, wait, serves, source, groups, tags, approved). Seed them into the R2 bucket. Read recipes from that bucket at request time, not from a content collection, because a collection is fixed at build. Keep `src/data/examples.ts` as the test fixture behind `KK_DATA=fixture`. A recipe renders the same page it does now, from the markdown instead of the TypeScript object.
- Done when: The three recipe pages render from markdown and match the current pages in name, ingredients and steps.
- Verify: `KK_DATA=fixture npm test` stays green, and `node --test tests/17-real-build.test.mjs` passes against a build whose recipe pages read the seeded markdown.
- Done: the files are bundled as text (`src/lib/recipe-files.ts`) because the prerender's filesystem cannot see the project. The tests run in plain Node and read the files from disk instead. Seeding R2 waits for U4, which is the first thing that writes a recipe. Until then the three files are the source.

### U4. The recipe form

- Depends on: U2, U3
- Files: `src/pages/recipe/new.astro`, `src/pages/recipe/edit/[id].astro`, `src/pages/api/recipes.ts`
- Change: A form of plain text inputs for the front matter and a textarea for the method. Either signed-in person can add a recipe and edit one. Saving writes the markdown to the R2 bucket from U3, so the other person sees it on the next request without a deploy. No delete. The form validates the same rules the recipe page relies on: an id, a name, a meal, and at least one ingredient.
- Done when: Ed adds a recipe on one device and Kristina sees it on another without anyone deploying.
- Verify: `node --test tests/recipe-form.test.mjs` posts a recipe through the endpoint, reads it back from the bucket, and rejects a recipe with no name.

### U5. The shared week

- Depends on: U2, U3
- Files: `src/pages/api/week.ts`, `src/scripts/week-store.ts`, `src/scripts/week-plan.ts`, `src/scripts/week-page.ts`, `src/pages/week.astro`
- Change: A week is a Monday-to-Sunday, kept forever and addressable by its Monday date. A day has four meals and a meal holds an ordered list of recipes. `WeekPlanStore.set` grows from `(day, recipeId | null)` to add, remove and reorder within a meal. Saving sends the list the device last saw. When the stored list differs, the response says so and changes nothing, and the page shows both lists and asks to keep or replace. Weeks older than the current one stay readable.
- Done when: Both plan the same week from two devices, a meal already filled is shown before it changes, and a week from a month ago still holds its meals.
- Verify: `node --test tests/week-shared.test.mjs` covers an add, a stale write that is refused, a confirmed replace, and a read of an older week.

### U6. Shared ratings and the three lists

- Depends on: U2, U3
- Files: `src/pages/api/ratings.ts`, `src/scripts/ratings.ts`, `src/scripts/ratings-store.ts`, `src/scripts/favorites.ts`, `src/pages/favorites.astro`
- Change: Add `fine` between `loved` and `nope` in `RATINGS`. Only `loved` counts toward a list. Favorites shows three lists: Ed's loved, Kristina's loved, and Family favorites where both loved it. A rating is shared, so Ed's rating made on his phone shows on Kristina's.
- Done when: Ed rates a recipe Loved it and Kristina rates the same one Loved it, and it appears in Family favorites and in both of their lists. A recipe only one of them loved is absent from Family favorites. An "It was fine" appears in none of the three.
- Verify: `node --test tests/ratings.test.mjs` and `node --test tests/favorites-page.test.mjs` cover the three lists and the middle rating.

### U7. Shared ticks

- Depends on: U2, U3
- Files: `src/pages/api/ticks.ts`, `src/scripts/ticks-store.ts`, `src/scripts/ticks-controller.ts`, `docs/ticks-store-notes.md`
- Change: The requirements say the ticked ingredients already saved on each phone are copied into the shared store, so ticks move to D1, keyed by recipe and person. Each person keeps their own ticks and both devices of one person agree. Update `docs/ticks-store-notes.md`, which currently says ticks are never shared.
- Done when: Ed ticks an ingredient on his phone and sees it ticked on his computer. Kristina's ticks for the same recipe stay her own.
- Verify: `node --test tests/ticks-shared.test.mjs` covers one person across two devices and two people on one recipe.

### U8. Import what the phones already saved

- Depends on: U5, U6, U7
- Files: `src/pages/import.astro`, `src/pages/api/import.ts`, `src/scripts/import-local.ts`
- Change: On the first sign-in, if the phone holds `kk:ratings`, `kk:week` or `kk:ticks`, offer to copy them into the shared store. Nothing is copied until the person confirms. The week import maps today's one-recipe-per-day plan onto dinner. Record that the import happened so the offer does not return. After it, the shared copy is what the app shows.
- Done when: A phone with saved ratings and a week is asked once, copies them after confirmation, and is not asked again.
- Verify: `node --test tests/import-local.test.mjs` covers confirm, decline, and a second visit that offers nothing.

### U9. Both screens

- Depends on: U4, U5, U6
- Files: `src/styles/global.css`, `src/layouts/Base.astro`, `src/pages/week.astro`, `src/pages/favorites.astro`, `src/pages/recipe/new.astro`
- Change: The week, the favorites lists and the recipe form each get a layout for a phone and a layout for a computer. The phone layout is usable with a thumb, one column. The computer layout uses the width for the week grid and for the form beside a preview. This is not one layout stretched.
- Done when: The week, favorites and the form are readable and usable at 390px wide and at 1280px wide.
- Verify: `node e2e/layout.e2e.mjs` screenshots both widths and checks no element overflows the viewport.
- Done: the check covers the week and the favorites, which the static harness can serve. The recipe form is served by the Worker, so the harness cannot open it; its two-column layout is the `kk-form-layout` rule. The shared stores are proven against an in-memory stand-in of D1 (`tests/week-shared.test.mjs`, `tests/ratings-shared.test.mjs`, `tests/ticks-shared.test.mjs`), not a running database. The pages still read the phone stores; pointing them at the shared ones is the wiring that follows these units.

## Out of scope

- Anyone other than Ed and Kristina.
- Deleting a recipe, and any page for someone who is not signed in.
- Photos, comments, and a shopping list.
- Sharing ratings or a week with anyone else.
- Deploying, and configuring the Cloudflare Access application. Both are done by Ed in the dashboard when he asks.
- Cloudflare KV and Durable Objects. Sessions, if needed, use the adapter's default KV. Nothing here needs a Durable Object.

## Blockers

- None.

## todo.txt

- Build the shared kitchen from the plan

Review complete
