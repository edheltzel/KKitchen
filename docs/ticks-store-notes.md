# Ticks store notes

Ingredient ticks on the recipe page are kept per phone by design and never shared: whoever is shopping or cooking ticks on their own phone.

- Stored in one localStorage key, `kk:ticks`: `{ v: 1, ticks: { <recipeId>: [<itemId>, ...] } }`. A recipe with nothing ticked has no entry.
- A tap reads the saved value, changes only that item and writes it back, so a stale tab cannot wipe another recipe's ticks. There are no timestamps and no merge rules: a tick has no "newer" side to win.
- Garbled stored data reads as no ticks, and odd ids are dropped. If storage is blocked, the page keeps ticks in memory, shows "Can't save your checks on this phone", and Retry saves what is on screen. Retry clears the saved list and re-adds what is on screen, so a tick made in another tab while this one was blocked is lost.
- Reset checks and (in cooking mode) reaching Done clear one recipe's ticks and offer Undo on the shared Undo bar. Undo adds back what was cleared and keeps any newer ticks.
- Do not move them to the shared store: it would need server time, merge rules and a loading state for something only one phone cares about. Ticks reset when the cooking is done, so nothing is lost if they stay on the phone.
- Changed: ticks are shared per person now. `src/lib/ticks-shared.ts` keeps Ed's ticks the same on his phone and his computer, and Kristina's separate. `kk:ticks` remains the phone copy that the one-time import reads.
