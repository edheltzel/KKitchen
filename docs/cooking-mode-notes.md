# Cooking mode notes

Route: `/cook/<recipe id>/`. Three screens in one page: Gather, Step n of N, Done. Examples only.

- **Position is the address hash**: empty is Gather, `#step-N` is a step, `#done` is Done. Reload and swipe-away keep the place.
- **On `hashchange`**, browser Back or forward that changes the hash re-renders that screen, without clearing ticks.
- **Steps use replaceState, not pushState**, so Back leaves cooking mode in one tap instead of walking back through every step. Exit is the same: it goes back to the recipe page when you came from it, otherwise it follows the link. Neither asks to confirm.
- **Ticks are the recipe page's ticks** (`kk:ticks`, see ticks-store-notes.md). "Use now" only shows the ingredients a step marks in `uses`; no `uses` means the block is hidden.
- **Done clears that recipe's ticks**, which is what "Ingredient checks are cleared for next time" says, and offers Undo in the shared bar. Loading the page straight at `#done` (a reload) does not clear again.
- **Tap zones** on a step: the left 35% of the reading column goes back, the rest goes forward. Buttons, links, inputs, labels and any tap while text is selected keep their own behavior. Space beside the column on a desktop does nothing.
- **Wake lock** (Screen Wake Lock API): granted shows the dark "Screen stays on" pill. Denied, lost while the page is visible, or no API shows the dashed "Screen may sleep" chip plus the banner "Couldn't keep the screen on. Set Auto-Lock to Never in Settings." Got it hides the banner for the session. It is requested on load and on each step, asked for again when the page becomes visible, and released on Done, Exit and page hide. Lost while the page is hidden is quiet.
- **Mock differences**: the last step's button says Finish. Done shows the full Ed / Kristina picker (the mock has none) because the "pick who you are" nudge scrolls to it and the screen is short.
- Not built here: calendar button, shared store, passcode.
