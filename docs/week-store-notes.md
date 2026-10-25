# Week plan store notes

The Week plan sits behind `WeekPlanStore` (`load()` and `set(day, recipeId | null)`), the same shape the real shared store will have. Today a local stand-in keeps it in one localStorage key, `kk:week`, on this phone.

- One entry per day: `{ recipeId | null, at }`. Removing a dinner writes a timestamped empty entry, so a removal beats older plans when two phones sync.
- Merge per day: the newer `at` wins, a removal wins a tie, otherwise the larger id. Removed dinners do not come back.
- A move is two writes (the new day first, then clear the old day), so an interrupted move leaves a duplicate, never a lost dinner. If the second write fails, Retry finishes the move: it replays the same two writes but skips any that already landed, so it only clears the old day and the dinner is never left on both days. (A real server should offer one atomic move call instead, so the half-done state cannot happen at all.)
- The server will check one dinner per day and valid recipe ids only, and will stamp the time itself, like ratings.
- A garbled stored value reads as an empty plan. A failed save lands in the failed-operations list and waits for Retry.
