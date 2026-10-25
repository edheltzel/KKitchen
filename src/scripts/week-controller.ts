// The week plan behaviour without any DOM: what the store says, the replace/move notes, the Undo offer
// after a removal, and the "Week plan unavailable" / Retry path. The pages only draw what view() says, so
// node:test can check all of it. The failed-operations list and Retry are the shared op-queue.

import { createOpQueue, type Op } from './op-queue.ts';
import { dinnerOn, planChange, type Plan, type PlanNote } from './week-plan.ts';
import type { WeekPlanStore } from './week-store.ts';

export interface WeekUndo {
  day: string;
  recipeId: string;
}

export interface WeekView {
  /** null while unavailable (never loaded, or a load/save failed): the pages then show nothing they cannot trust. */
  plan: Plan | null;
  unavailable: boolean;
  /** What the last change did (planned, replaced, moved from another day), for a visible message. */
  note: PlanNote | null;
  undo: WeekUndo | null;
}

export function createWeekController({ store, days }: { store: WeekPlanStore; days: readonly string[] }) {
  let data: Plan | null = null;
  let note: PlanNote | null = null;
  let undo: WeekUndo | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  // A failure clears any Undo offer: next to "Week plan unavailable" it would be stale, and Retry is what matters then.
  const queue = createOpQueue({ emit, onFail: () => (undo = null) });

  const loadOp: Op = {
    kind: 'load',
    run: async () => {
      data = await store.load();
    },
  };

  return {
    view: (): WeekView => ({ plan: queue.unavailable ? null : data, unavailable: queue.unavailable, note, undo }),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    init: () => queue.enqueue(loadOp),
    /** Reload from the store (page shown again). Does not paper over a failure. */
    refresh: () => (queue.unavailable ? Promise.resolve() : queue.enqueue(loadOp)),
    retry: () => queue.retry(loadOp),
    /** Plan a dinner: a replace if the day has one, a move if the recipe is on another day. While the store is failing it waits for Retry. */
    plan(day: string, recipeId: string): Promise<void> {
      const run = async () => {
        const before = await store.load();
        const change = planChange(before, days, day, recipeId);
        if (change.writes.length === 0) {
          data = before;
          return;
        }
        let after = before;
        for (const write of change.writes) after = await store.set(write.day, write.recipeId);
        data = after;
        note = change.note;
        undo = null;
      };
      return queue.enqueue({ kind: 'write', run });
    },
    /** Remove the day's dinner. Only the first of several quick taps does anything; the rest find an empty day. */
    remove(day: string): Promise<void> {
      const run = async () => {
        const before = await store.load();
        const recipeId = dinnerOn(before, day);
        if (recipeId === null) {
          data = before;
          return;
        }
        data = await store.set(day, null);
        note = null;
        undo = { day, recipeId };
      };
      return queue.enqueue({ kind: 'write', run });
    },
    undo(): Promise<void> {
      const offer = undo;
      if (!offer) return Promise.resolve();
      const run = async () => {
        if (undo !== offer) return; // already used, or another change ended the offer
        data = await store.set(offer.day, offer.recipeId);
        note = null;
        undo = null;
      };
      return queue.enqueue({ kind: 'write', run });
    },
    dismissUndo(): void {
      undo = null;
      emit();
    },
  };
}
