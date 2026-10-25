# Test deploy (static preview, test only)

Nothing is published by committing this. A person runs the deploy by hand, with a scoped token, after Red-Team has read it.

## What gets deployed

- Static files only: the built `dist` folder, served by a Cloudflare Worker with static assets. No Worker code, no D1, KV, R2, durable objects, services, routes or custom domain. See `wrangler.jsonc`.
- Example recipes only. No real recipe text, no stories, no photos of people.
- Ratings, the week plan and ticks stay on each phone (browser storage). They are not shared: nothing is sent to the Worker, and two phones will not see each other's.
- Worker name: `k9b86a4baf5538442773d` (random, no site name in it). The address is `https://k9b86a4baf5538442773d.<your-subdomain>.workers.dev`, which `wrangler deploy` prints.
- Every response carries `X-Robots-Tag: noindex, nofollow` (from `public/_headers`) and every page has `<meta name="robots" content="noindex">`.

## Deploy (repeatable, manual only, no automatic republish)

Export the scoped token in the shell for this session only (never write it into a file in the repo), then:

```
cd /Users/ed/Developer/KKitchen
rm -rf dist && npm test && wrangler deploy
```

- Run it by hand each time. No CI, no watcher, no hook and no schedule publishes this: manual only, and there is no automatic republish.
- `npm test` builds `dist` and runs every check, including the leak scan and the headers and config tests, so a failing test stops the deploy.
- Offline rehearsal that needs no login: `wrangler deploy --dry-run`. Last saved output: `~/.agents/Grokbot/kk-proof/kk-05-dry-run.txt`.
- Wrangler 4.151.0 is what was used on BigMac. It is not a project dependency. Never run `wrangler login`; the token is passed in the environment.

## Verify (after the first deploy and after each redeploy)

Set `URL` to the printed address.

1. Random address: the host starts with `k` plus 20 hex characters and has no site name in it.
2. Noindex header on every path: `curl -sI "$URL/" | grep -i x-robots-tag` shows `noindex, nofollow`. Repeat for `$URL/week/` and `$URL/recipe/example-1/`.
3. Noindex tag: `curl -s "$URL/" | grep -o '<meta name="robots" content="noindex">'` prints the tag (also on `/week/`, `/favorites/`, `/recipe/example-1/` and `/cook/example-1/`).
4. Leak scan on dist (before deploy): `grep -rlE "Draft-only|saffron|Hidden Draft Note|Nut-free" dist` prints nothing.
5. Leak scan on the live pages: `for p in / /week/ /favorites/ /recipe/example-1/ /cook/example-1/; do curl -s "$URL$p"; done | grep -E "Draft-only|saffron|Hidden Draft Note|Nut-free"` prints nothing.
6. Open it on a phone, add a rating, close the page, and reopen: the rating is still there on that phone only.

## Delete

```
wrangler delete k9b86a4baf5538442773d
```

Then `curl -sI "$URL/"` should no longer serve the site. Delete the setup token as well (see below).

## Rollback

There is no history on the server to restore, so rolling back means redeploying an older build:

1. `git log --oneline` and pick the last good commit that was deployed from this branch. It must contain `wrangler.jsonc` and `public/_headers`, so it cannot be older than the commit that added them.
2. `git checkout <good-commit>` (a detached checkout is fine; make no changes there).
3. `rm -rf dist && npm test && wrangler deploy`
4. Run the verify steps again, then `git checkout kk-05-deploy-test` to come back.

## Token

- Use a scoped API token with Workers edit only (Workers Scripts: Edit, and nothing else on the one account).
- Set `CLOUDFLARE_ACCOUNT_ID` in the same shell as the token (the id is not secret, but keep it out of the repo). Without it wrangler may try to look the account up, which needs an account read permission that a Workers-edit-only token does not have.
- If wrangler still asks for more than Workers edit, stop and tell Atlas. Do not widen the token quietly.
- Before first use, confirm in the token's permission list that there is no D1, KV or DNS permission, no zone access and no account-wide admin. If any is there, do not use the token.
- Delete the setup token after the first session. Make a new scoped token for any later session.
- Nothing in this repo contains a token, an account id or a zone id.

## Is this test site still needed?

Is this test site still needed? Review after each test session; it stays up only on the captain's say-so. A random address only hides the site; real recipes or shared ratings need a proper gate (passcode) and a fresh Red-Team review.
