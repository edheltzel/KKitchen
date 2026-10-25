# Ratings store notes

Short notes for when the real shared store replaces the local stand-in (`kk:ratings` in localStorage).

- **Recipe ids.** Ratings are keyed by a fixed `id` field on each recipe (today `example-1`, `example-2`, and so on), not the title. Renaming a recipe must keep its id, so its ratings and Family favorite stay attached. `tests/11-recipe-ids.test.mjs` guards this.
- **Time.** The real store stamps the time on the server and ignores the phone clock. The stand-in stamps `at` from the phone, which is fine for one phone only. A phone with a wrong clock must not be able to win an edit.
- **Loading.** Add a loading state before the real store lands: a network read is not instant, so the cards say "loading" (not "not rated yet") until the first read answers, and a failed read goes to the existing "Ratings unavailable" banner with Retry.
- **Favorites tab.** Open question: does the Favorites tab mean the derived Family favorites (both Ed and Kristina loved it)? It is a placeholder today. Decide in branch 5/6, and keep the "Who liked it" filter and the tab using the same derived rule so they never disagree.
- **Branch 7 (not built yet).** Keep the failed-operations list in localStorage and retry on the `online` event. A tap made on flaky Wi-Fi is lost today if the app closes before Retry. The week plan will use the same list. Do not build it now.
- **Branch 7, error kinds (ratings).** The store needs two kinds of store error: "retry" (the network or server is down, try again, keep the op in the failed list) and "rejected" (the server says the op is invalid): a "rejected" op is dropped with a visible message and is never left at the front of the failed list, where it would block every later tap forever.
