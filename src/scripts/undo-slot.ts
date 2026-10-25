// One Undo offer at a time for the shared Undo bar. Ratings ("Family favorite removed") and the ticks
// ("Checks cleared") both use the bar on the recipe page; the newest offer wins and the older source is told
// it was dropped. No DOM here: `render` draws the bar (text and show/hide), so node:test can check it.
export interface UndoOffer {
  text: string;
  /** The Undo button was pressed. */
  run(): void;
  /** The offer went away without being used: replaced by a newer one, or the bar timed out. */
  drop(): void;
}

export function createUndoSlot({ render }: { render: (offer: UndoOffer | null) => void }) {
  let current: UndoOffer | null = null;
  return {
    offer(next: UndoOffer): void {
      const old = current;
      current = next; // set first: the old source may call retract() from inside drop()
      render(next);
      if (old && old !== next) old.drop();
    },
    /** A source took its own offer back (it no longer applies). Ignored when that offer is not the one on show. */
    retract(offer: UndoOffer): void {
      if (current !== offer) return;
      current = null;
      render(null);
    },
    press(): void {
      const offer = current;
      if (!offer) return;
      current = null;
      render(null);
      offer.run();
    },
    expire(): void {
      const offer = current;
      if (!offer) return;
      current = null;
      render(null);
      offer.drop();
    },
  };
}
