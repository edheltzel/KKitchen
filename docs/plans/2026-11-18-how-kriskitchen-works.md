# How Kris's Kitchen works today

Written 2026-11-18, for Ed and Kristina using the app, not for the code.

## The short version

There is no database. A recipe exists only as a file Ed edits by hand. The site is built once and served as plain files, so nothing on the server remembers anyone.

Everything a person does in the app (ratings, the week plan, ticked ingredients) is saved in that phone's own browser storage. Ed's phone and Kristina's phone each keep their own copy and never see each other's.

## Where a recipe comes from

1. Ed writes the recipe into `src/data/recipes.ts`: name, minutes, meal, ingredients, steps, and an optional note that the original source calls it gluten-free.
2. `npm run build` turns that file, plus the pages, into a folder of plain HTML, CSS and JavaScript.
3. That folder is what gets deployed. After a deploy, both phones see the new recipe the next time they open the site.

Until Ed does steps 1 to 3, the recipe does not exist for anyone. There is no screen for adding or editing a recipe.

## What each person does in the app

First visit, the app asks "I'm Ed" or "I'm Kristina" and remembers the answer on that phone.

- **Recipes.** Search and filter the recipes Ed shipped. Tap a card for the full recipe.
- **Loved it / Not for us.** Each person rates a recipe. A recipe both rated "Loved it" becomes a Family favorite and shows on the Favorites tab. A rating made on Ed's phone is not on Kristina's phone.
- **Plan.** Pick a day this week for a dinner. The week runs Monday to Sunday from the phone's own calendar. Same limit: the plan stays on the phone that made it.
- **Cook.** Open a recipe's steps, tick off ingredients as you go, and the screen stays awake. Ticks stay on that phone too.
- **Favorites.** The recipes both of you loved. Because ratings are per phone, this list only fills up on a phone where both ratings were actually tapped.

Every change can be undone for about ten seconds. If the phone blocks storage (private mode, or storage full), the app says so and offers Retry instead of crashing.

## What this cannot do yet

- Kristina cannot add or change a recipe. Only Ed can, by editing the file and deploying.
- Nothing is shared. A rating, a planned dinner or a ticked ingredient on one phone is invisible on the other, and invisible on a second browser on the same phone.
- Clearing the browser's site data, or reinstalling the home-screen app, wipes that phone's ratings, plan and ticks. There is no backup and no account.
- The week plan has no history. It is only the current Monday-to-Sunday.

## What a shared store would change

The app is already shaped for one. Ratings, the week plan and ticks each talk to their storage through a small interface, and the phone storage is a stand-in behind it. Replacing that stand-in with a shared store (SQLite on a server is one option) is what would make Ed's phone and Kristina's phone agree.

That is a decision, not a gap in the current build. Nothing so far has chosen a database, a sync service, or who hosts it.
