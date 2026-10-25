// Tap zones on a cooking step: the left 35% of the screen goes back, the rest goes forward (except on the last step, where only the
// Finish button opens Done, because Done clears the ingredient ticks). Pure, so node:test can check it.
export type TapAction = 'back' | 'next' | 'none';

export const BACK_FRACTION = 0.35;

/** Anything a finger might be aiming at on purpose: it keeps its own tap and never turns the page. */
export const INTERACTIVE = 'button, a, input, label, summary, select, textarea, [role="button"], [data-no-zone]';

export function tapDecision({ x, width, onInteractive, selectionText, canForward }: { x: number; width: number; onInteractive: boolean; selectionText: string; canForward: boolean }): TapAction {
  if (onInteractive || selectionText.length > 0) return 'none';
  if (!(width > 0) || !(x >= 0) || x > width) return 'none';
  if (x / width < BACK_FRACTION) return 'back';
  return canForward ? 'next' : 'none';
}
