// Where you are in cooking mode: Gather (tick what is ready), Step 1..N, then Done. No DOM, so node:test can check it.
// The position lives in the address as a #hash (see docs/cooking-mode-notes.md): "", "#step-2" or "#done".
export type CookState = { phase: 'gather' } | { phase: 'step'; index: number } | { phase: 'done' };

export const GATHER: CookState = { phase: 'gather' };
const DONE: CookState = { phase: 'done' };

/** A step index is always one of the recipe's steps: anything outside is pulled back in. */
const clamp = (index: number, total: number): number => Math.min(Math.max(index, 0), Math.max(total - 1, 0));

export function next(state: CookState, total: number): CookState {
  if (state.phase === 'done') return DONE;
  if (state.phase === 'gather') return total > 0 ? { phase: 'step', index: 0 } : DONE;
  const index = clamp(state.index, total);
  return index + 1 < total ? { phase: 'step', index: index + 1 } : DONE;
}

export function back(state: CookState, total: number): CookState {
  if (state.phase === 'gather') return GATHER;
  if (state.phase === 'done') return total > 0 ? { phase: 'step', index: total - 1 } : GATHER;
  const index = clamp(state.index, total);
  return index > 0 ? { phase: 'step', index: index - 1 } : GATHER;
}

/** What goes after the address: nothing for Gather, steps counted from 1 like people do. */
export function encode(state: CookState): string {
  if (state.phase === 'gather') return '';
  if (state.phase === 'done') return '#done';
  return `#step-${state.index + 1}`;
}

/** The position from an address hash. Anything unexpected starts at Gather; a step past the end lands on the last step. */
export function parse(hash: unknown, total: number): CookState {
  if (typeof hash !== 'string') return GATHER;
  if (hash === '#done') return DONE;
  const match = /^#step-([1-9][0-9]{0,3})$/.exec(hash);
  if (!match || total === 0) return GATHER;
  return { phase: 'step', index: clamp(Number(match[1]) - 1, total) };
}

export type SegmentState = 'done' | 'current' | 'todo';

/** One progress segment per step. */
export function segments(state: CookState, total: number): SegmentState[] {
  return Array.from({ length: total }, (_, i): SegmentState => {
    if (state.phase === 'done') return 'done';
    if (state.phase === 'gather') return 'todo';
    const current = clamp(state.index, total);
    return i < current ? 'done' : i === current ? 'current' : 'todo';
  });
}

/** "Step 2 of 5" on a step screen, otherwise null. */
export function stepCount(state: CookState, total: number): string | null {
  return state.phase === 'step' ? `Step ${clamp(state.index, total) + 1} of ${total}` : null;
}
