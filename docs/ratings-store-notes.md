# Ratings store notes

Short notes for when the real shared store replaces the local stand-in (`kk:ratings` in localStorage).

- **Recipe ids.** Ratings are keyed by a fixed `id` field on each recipe (today `example-1`, `example-2`, and so on), not the title. Renaming a recipe must keep its id, so its ratings and Family favorite stay attached. `tests/11-recipe-ids.test.mjs` guards this.
- **Time.** The real store stamps the time on the server and ignores the phone clock. The stand-in stamps `at` from the phone, which is fine for one phone only. A phone with a wrong clock must not be able to win an edit.
- **Loading.** Add a loading state before the real store lands: a network read is not instant, so the cards say "loading" (not "not rated yet") until the first read answers, and a failed read goes to the existing "Ratings unavailable" banner with Retry.
- **Favorites tab.** Open question: does the Favorites tab mean the derived Family favorites (both Ed and Kristina loved it)? It is a placeholder today. Decide in branch 5/6, and keep the "Who liked it" filter and the tab using the same derived rule so they never disagree.
