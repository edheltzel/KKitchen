# Test deploy (static preview, test only)

Nothing is published by committing this. A person runs the deploy by hand, with a scoped token, after Red-Team has read it.

## What gets deployed

- Static files only: the built `dist` folder, served by a Cloudflare Worker with static assets. No Worker code, no D1, KV, R2, durable objects, services, routes or custom domain. See `wrangler.jsonc`.
- The three real recipes (fried chicken, slow cooker roast, brownies) from a plain build. No example or fixture recipes, no stories, no photos of people.
- Ratings, the week plan and ticks stay on each phone (browser storage). They are not shared: nothing is sent to the Worker, and two phones will not see each other's.
- Worker name: `k9b86a4baf5538442773d` (random, no site name in it). The address is `https://k9b86a4baf5538442773d.<your-subdomain>.workers.dev`, which `wrangler deploy` prints.
- Every response carries `X-Robots-Tag: noindex, nofollow` (from `public/_headers`) and every page has `<meta name="robots" content="noindex">`.

## Before the first deploy

Confirm the random name is free, so the deploy cannot overwrite an existing Worker. This is a read-only check: list the account's Workers with the Cloudflare connector (`workers_list`) or in the dashboard, and confirm that `k9b86a4baf5538442773d` does not already exist. If it does, stop and tell Atlas; do not deploy over it.

## Deploy (repeatable, manual only, no automatic republish)

Wrangler reads the Cloudflare token from the captain's `.env` file in the folder it is started in, so every wrangler command is run from `/Users/ed` and pointed at the project with `-c`. Build and test in the project first, then deploy from `/Users/ed`:

```
cd /Users/ed/Developer/KKitchen && npm test && rm -rf dist && npm run build
cd /Users/ed && wrangler deploy -c /Users/ed/Developer/KKitchen/wrangler.jsonc
```

- Run it by hand each time. No CI, no watcher, no hook and no schedule publishes this: manual only, and there is no automatic republish.
- `npm test` builds the example fixture into `dist` and runs every check, including the leak scan and the headers and config tests, so a failing test stops the deploy. Its `dist` holds the example recipes, so the deploy always rebuilds afterwards with a plain `npm run build`, which holds only the real recipes. Check `ls dist/recipe` before deploying.
- Offline rehearsal that needs no login: `cd /Users/ed && wrangler deploy --dry-run -c /Users/ed/Developer/KKitchen/wrangler.jsonc`. It should say the assets directory is the project's `dist`. Last saved output: `~/.agents/Grokbot/kk-proof/kk-05-dry-run.txt`.
- Wrangler 4.151.0 is what was used on BigMac. It is not a project dependency. Never run `wrangler login`. The token comes from `/Users/ed/.env`: never print or open /Users/ed/.env, and never copy the token into the repo, a log or any output.

## Verify (after the first deploy and after each redeploy)

Set `URL` to the printed address.

1. Random address: the host starts with `k` plus 20 hex characters and has no site name in it.
2. Noindex header on every path: `curl -sI "$URL/" | grep -i x-robots-tag` shows `noindex, nofollow`. Repeat for `$URL/week/` and `$URL/recipe/fried-chicken/`.
3. Noindex tag: `curl -s "$URL/" | grep -o '<meta name="robots" content="noindex">'` prints the tag (also on `/week/`, `/favorites/`, `/recipe/fried-chicken/` and `/cook/fried-chicken/`).
4. Check dist before deploy: `ls dist/recipe` shows exactly the three real folders (`fried-chicken`, `high-protein-brownies`, `slow-cooker-roast`), and `grep -ril "example recipe" dist` prints nothing.
5. Check the live pages: `for p in / /week/ /favorites/ /recipe/fried-chicken/ /cook/fried-chicken/; do curl -s "$URL$p"; done | grep -i "example recipe"` prints nothing.
6. Noindex on a built asset and on a 404 path (the one `/*` rule should cover both):
   `curl -sI "$URL/_astro/<file>.css" | grep -i x-robots-tag` (pick any file name from `ls dist/_astro`), and
   `curl -sI "$URL/not-a-page-x1/" | grep -i x-robots-tag` (the status line should be 404, and the header should still be there).
7. File count: compare what wrangler reports with `dist`. Work the numbers out fresh each time; do not rely on a number written down earlier.
   - Before deploying, `wrangler deploy --dry-run` prints "Read N files". Wrangler counts folders as well as files there, so N should equal `find dist -mindepth 1 | wc -l`.
   - On the real deploy, the uploaded count is of files, so compare it with `find dist -type f | wc -l`. Wrangler may treat `_headers` as configuration and not upload it, so one fewer is plausible; the site still has to show the header (steps 2 and 6).
   - Any other number means something extra or missing in `dist`: do not carry on, tell Atlas.
8. Open it on a phone, add a rating, close the page, and reopen: the rating is still there on that phone only.

## Delete

```
cd /Users/ed && wrangler delete k9b86a4baf5538442773d -c /Users/ed/Developer/KKitchen/wrangler.jsonc
```

Then `curl -sI "$URL/"` should no longer serve the site.

## Rollback

There is no history on the server to restore, so rolling back means rebuilding and redeploying an older commit. This never touches the working tree or the branch: the old commit is unpacked with `git archive` into a temp dir outside `~/Developer`.

1. `git log --oneline` and pick the last good commit that was deployed from this branch. It must contain `wrangler.jsonc` and `public/_headers`, so it cannot be older than the commit that added them.
2. Unpack, rebuild and redeploy from the temp dir:

```
SRC=$(mktemp -d /private/tmp/kk-rollback.XXXXXX)
git -C /Users/ed/Developer/KKitchen archive <good-commit> | tar -x -C "$SRC"
cd "$SRC" && npm ci && npm test && rm -rf dist && npm run build
cd /Users/ed && wrangler deploy -c "$SRC/wrangler.jsonc"
```

3. Run the verify steps again, then clean up: `cd /Users/ed/Developer/KKitchen && rm -rf "$SRC"`.

- Fallback: if a redeploy will not go through or the site must come down now, delete it with `cd /Users/ed && wrangler delete k9b86a4baf5538442773d -c /Users/ed/Developer/KKitchen/wrangler.jsonc`.
- `wrangler rollback` is unchecked for asset Workers (not tried, not relied on here). Do not count on it.

## Token

- The deploy needs Workers edit. The token in use is an existing account token, and its scope is unknown. The captain okayed using it on Oct 25, 2026.
- If wrangler needs the account id, set `CLOUDFLARE_ACCOUNT_ID=<id>` inline for that one command only (the first deploy did not need it). Without it wrangler may try to look the account up, which needs an account read permission that a Workers-edit-only token may lack. Never put the id in the repo.
- If wrangler asks for more access than a Workers deploy, stop and tell Atlas. Do not widen the token quietly.
- A Workers-edit token covers all 8 existing Workers on the account and cannot be limited to one. It can change or delete any of them, so use it only for this site and keep it short-lived if it is ever made new.
- The token is an existing account token. Do not delete the token after a session; never print or open the token, and keep it out of files, logs and command output.
- Nothing in this repo contains a token, an account id or a zone id.

## Is this test site still needed?

Is this test site still needed? Review after each test session; it stays up only on the captain's say-so. A random address only hides the site; real recipes or shared ratings need a proper gate (passcode) and a fresh Red-Team review.
