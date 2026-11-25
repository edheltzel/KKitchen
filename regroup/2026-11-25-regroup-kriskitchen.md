# Regroup: KrisKitchen

Date: 2026-11-25
Sources: `todo.txt` and `done.txt` (tuxedo lsa), `git log` on master. No handoff exists in `docs/plans/handoffs/`.

## Last completed

- 2026-11-18: U2 sign-in, U3 recipes as markdown in R2, U4 recipe form, Build the shared kitchen from the plan (todo.txt).
- 2026-11-24: PR #3 merged (git, not a todo.txt line): Plan sheet confirms the picked day with Undo, and the real Access emails are let in.

## Up next

Up next not specified. No open task has a priority or due date.

## Remaining

- Deploy the shared kitchen to the kriskitchen Worker - not started.
  `2026-11-24 Deploy the shared kitchen to the kriskitchen Worker: create the D1 database and the R2 bucket, put the real database_id in wrangler.jsonc, then sign in as Ed and Kristina to check Access +kriskitchen`
- Planning from a card redirects the next Recipes visit to /import - not started.
  `2026-11-24 Planning from a card still writes the phone's kk:week, so the next Recipes visit redirects to /import (src/scripts/browse.ts:24, import-local.ts localCopy); also breaks e2e/plan reopen check +kriskitchen`
- Add D1 migrations so local and remote match - not started.
  `2026-11-24 Local D1 was made before meal_slots.seen existed and db/schema.sql has no migration; add a migrations folder so local and remote D1 match +kriskitchen`
