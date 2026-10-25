# Week plan store notes

The Week plan sits behind `WeekPlanStore` (`load()` and `set(day, recipeId | null)`), the same shape the real shared store will have. Today a local stand-in keeps it in one localStorage key, `kk:week`, on this phone.

- One entry per day: `{ recipeId | null, at }`. Removing a dinner writes a timestamped empty entry, so a removal beats older plans when two phones sync.
- Merge per day: the newer `at` wins, a removal wins a tie, otherwise the larger id. Removed dinners do not come back.
- A move is two writes (the new day first, then clear the old day), so an interrupted move leaves a duplicate, never a lost dinner. If the second write fails, Retry finishes the move: it replays the same two writes but skips any that already landed, so it only clears the old day and the dinner is never left on both days. (A real server should offer one atomic move call instead, so the half-done state cannot happen at all.)
- The server will check one dinner per day and valid recipe ids only, and will stamp the time itself, like ratings.
- A garbled stored value reads as an empty plan. A failed save lands in the failed-operations list and waits for Retry.
- **Branch 7, error kinds (week plan).** The store needs two kinds of store error: "retry" (the network or server is down, try again, keep the op in the failed list) and "rejected" (the server says the op is invalid): a "rejected" op is dropped with a visible message and is never left at the front of the failed list, where it would block every later tap forever.

For the real store phase:

- The Plan sheet shows "Free" for every day until the first read answers, so it needs a loading state like ratings.
- Replacing a dinner has no Undo, only a "Replaced X" note (Undo is only offered after Remove).
- The cards page does not reload when the week rolls over, so a stale page left open past Sunday night could plan into last week's days.
- A saved dinner whose recipe is gone shows "a recipe" with an "A" tile: fine for the examples, worth a real answer once recipes can be deleted.
- With storage blocked, both banners show together above the search bar (Ratings and Week). The stack is checked in `e2e/plan.e2e.mjs`: the last card still clears it, so this is only a look-and-feel note.
