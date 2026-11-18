# Shared kitchen

## Goal

Ed and Kristina share one week of meals, one set of ratings and one set of recipes, from either phone or a computer, instead of each phone keeping its own copy that the other never sees.

## In scope

- Both sign in. Ed and Kristina are the only two people.
- A recipe is a markdown file with front matter. A simple form on the site fills in the front matter and the recipe text, and saves it. Either person can add a recipe and edit one.
- The week is shared. A day holds four meals (breakfast, lunch, dinner, snack) and a meal holds more than one recipe. Weeks are kept forever and can be browsed back through.
- When one person sets a meal the other has already set, the second person sees what is there and chooses to keep it or replace it. Nothing is replaced silently.
- Three ratings: Loved it, It was fine, Not for us. Only Loved it counts. The app shows three lists: Ed's loved, Kristina's loved, and Family favorites (both loved it).
- The ratings, the week and the ticked ingredients already saved on each phone are copied into the shared store once, when that phone first signs in. The person confirms before the copy.
- Phones (added to the home screen) and a computer both work, each laid out for its screen.

## Out of scope

- Anyone other than Ed and Kristina.
- A way to delete a recipe, or a public page for people who are not signed in.
- Photos, comments, or a shopping list.
- Sharing ratings or a week with anyone outside the two of them.

## Success

- Ed adds a recipe from his phone. Kristina sees it on her phone and on a computer without anyone deploying.
- Both plan the same week from different devices. A meal one of them already filled is shown to the other before it changes, and the week still holds every meal from a month ago.
- Ed rates a recipe Loved it on his phone. Kristina rates the same recipe Loved it on hers. It appears under Family favorites for both, and under each of their own lists. A recipe only one of them loved does not appear under Family favorites.
- A phone that already has ratings and a week offers to copy them in once, and after that the shared copy is what both see.

## Constraints

- Stays on Cloudflare's free tier. Named by Ed: Cloudflare Access for sign-in, Cloudflare D1 for the shared data.
- Recipes stay markdown with front matter. The form is plain text inputs, not a rich editor.
- The three real recipes that exist today are TypeScript objects in `src/data/recipes.ts`, not markdown. Moving them is part of the work, not a separate decision.

## Decisions

- A meal holds several recipes, not one. Decided over one dinner per day, and over one recipe per meal.
- Weeks are kept forever. Decided over a year, and over this week plus last week.
- Favorites are three lists. Decided over a single family list, and over each person seeing only their own.
- A middle rating, "It was fine", sits between Loved it and Not for us, and never counts as a favorite.
- Both people can add and edit recipes, plan the week and rate. Neither owns any of it.
- Phones and a computer are both first-class. A single stretched layout is not enough.
- Existing phone data is imported once, with a confirmation. It is not left behind and not kept in parallel.
- A conflict on a meal asks before replacing. Last write does not win silently.

## Open questions

- None that block planning. How the markdown is stored and how a conflict is detected are for the plan.

## todo.txt

- Turn the shared kitchen requirements into an implementation plan
