// Wires the shared Undo bar (#undo-bar in the replaces-tabs slot) to an Undo slot: the text, the button,
// the 10 second timer and the tab bar swap. Pages hand the slot to whatever can offer an Undo.
import { createUndoBar } from './undo-bar';
import { createUndoSlot } from './undo-slot';

export function mountUndoSlot({
  bar,
  stack,
  text,
  button,
  seconds,
}: {
  bar: HTMLElement;
  stack: HTMLElement;
  text: HTMLElement;
  button: HTMLElement;
  seconds?: number;
}) {
  const shown = createUndoBar({ bar, stack, expire: () => slot.expire(), seconds });
  const slot = createUndoSlot({
    render: (offer) => {
      if (offer) text.textContent = offer.text;
      shown.show(offer);
    },
  });
  button.addEventListener('click', () => slot.press());
  return slot;
}
