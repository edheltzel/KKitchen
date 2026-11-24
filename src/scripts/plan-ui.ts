// Day picker sheet on each recipe card and the recipe page: the third way to plan a dinner, after the Week page's Add and Remove.
// Same store key and controller as the Week page. Text via textContent only.
import { createWeekController } from './week-controller';
import { createLocalWeekStore } from './week-store';
import { phoneStorage } from './phone-storage';
import { noteText, weekDays } from './week-plan';
import { createWeekClient } from './week-shared-client';
import type { createUndoSlot } from './undo-slot';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

/**
 * `cards` are the elements (with data-id and a [data-role="plan"] button) that can be planned; `names` is EVERY
 * approved recipe id and name, because the sheet says "Replaces <name>" for dinners that are not on this page and
 * the store must know every id (an id it does not know is refused).
 */
export function mountPlanSheet({
  cards: elements,
  names,
  slot,
}: {
  cards: HTMLElement[];
  names: ReadonlyMap<string, string>;
  slot: ReturnType<typeof createUndoSlot>;
}): void {
  const sheet = $<HTMLDialogElement>('#plan-sheet');
  const title = $('#plan-title');
  const live = $('#plan-live');
  const unavailableBar = $('#week-unavailable');
  const cards = elements.map((el) => ({
    el,
    id: el.dataset.id!,
    button: el.querySelector<HTMLButtonElement>('[data-role="plan"]')!,
    status: el.querySelector<HTMLElement>('[data-role="plan-status"]')!,
  }));
  const nameOf = (id: string) => names.get(id) ?? 'a recipe';

  const days = weekDays(new Date());
  const keys = days.map((d) => d.key);
  const todayKey = days[(new Date().getDay() + 6) % 7].key;
  const longOf = (key: string) => days.find((d) => d.key === key)!.long;
  const shortOf = (key: string) => days.find((d) => d.key === key)!.short;

  const store = createLocalWeekStore({ storage: phoneStorage(), knownRecipeIds: new Set(names.keys()) });
  // A plan made from a card is shared too. The local store stays for the sheet's own Undo.
  const shared = createWeekClient();
  const controller = createWeekController({ store, days: keys });

  const slots = [...sheet.querySelectorAll<HTMLButtonElement>('button[data-slot]')];
  slots.forEach((button) => {
    const day = days[Number(button.dataset.slot)];
    button.dataset.day = day.key;
    button.querySelector('[data-role="day-label"]')!.textContent = `${day.long}, ${day.month} ${day.date}`;
  });

  let lastPlan = null as ReturnType<typeof controller.view>['plan'];
  const dinnerOf = (key: string) => lastPlan?.[key]?.recipeId ?? null;
  const daysOf = (recipeId: string) => keys.filter((k) => dinnerOf(k) === recipeId);

  function render(): void {
    const view = controller.view();
    if (view.plan) lastPlan = view.plan;
    unavailableBar.hidden = !view.unavailable;
    const note = noteText(view.note, longOf, nameOf);
    for (const card of cards) {
      const where = daysOf(card.id);
      const parts = where.length ? [`On ${where.map(shortOf).join(', ')}`] : [];
      const noted = view.note && dinnerOf(view.note.day) === card.id ? note : null;
      if (noted) parts.push(noted);
      card.status.textContent = parts.join('. ');
      card.status.hidden = parts.length === 0;
      card.button.disabled = view.unavailable;
    }
  }

  let picking: (typeof cards)[number] | null = null;
  function openFor(card: (typeof cards)[number]): void {
    picking = card;
    title.textContent = `Plan ${card.el.querySelector('h1, h2')!.textContent}`;
    for (const button of slots) {
      const key = button.dataset.day!;
      const here = dinnerOf(key);
      const elsewhere = daysOf(card.id).find((k) => k !== key);
      let status: string;
      if (here === card.id) status = 'Planned here';
      else {
        const parts: string[] = [];
        if (here) parts.push(`Replaces ${nameOf(here)}`);
        if (elsewhere) parts.push(`Moves it from ${longOf(elsewhere)}`);
        status = parts.length ? parts.join('. ') : 'Free';
      }
      button.querySelector('[data-role="day-status"]')!.textContent = key === todayKey ? `${status} (today)` : status;
    }
    sheet.showModal();
  }

  for (const card of cards) {
    card.button.addEventListener('click', () => !card.button.disabled && openFor(card));
  }
  function share(day: string, recipeId: string): Promise<(() => void) | null> {
    return shared
      .get(day, 'dinner')
      .then(async (meal) => {
        const result = await shared.set(day, 'dinner', [...meal.recipes, recipeId], meal.recipes);
        if ('conflict' in result) {
          live.textContent = `${nameOf(recipeId)} was not added to the shared week. That dinner changed. Open the week to choose.`;
          return null;
        }
        return () => void shared.set(day, 'dinner', meal.recipes, result.recipes).catch(() => undefined);
      })
      .catch(() => {
        live.textContent = 'Saved on this phone. The shared week could not be reached.';
        return null;
      });
  }

  function flash(card: (typeof cards)[number]): void {
    card.status.dataset.flash = 'on';
    card.status.addEventListener('animationend', () => delete card.status.dataset.flash, { once: true });
  }

  sheet.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-day]');
    if (!button || !picking || sheet.dataset.picked) return;
    const card = picking;
    picking = null;
    const day = button.dataset.day!;
    sheet.dataset.picked = 'on';
    button.dataset.picked = 'on';
    button.querySelector('[data-role="day-status"]')!.textContent = 'Planned';
    navigator.vibrate?.(10);
    setTimeout(() => {
      sheet.close();
      delete sheet.dataset.picked;
      delete button.dataset.picked;
    }, 450);
    if (dinnerOf(day) === card.id) return;
    const restores = [...new Set([day, ...daysOf(card.id)])].map((key) => ({ day: key, recipeId: dinnerOf(key) }));
    const sharedUndo = share(day, card.id);
    void controller.plan(day, card.id).then(() => {
      const view = controller.view();
      if (view.unavailable) return;
      flash(card);
      const note = noteText(view.note, longOf, nameOf);
      slot.offer({
        text: [`${nameOf(card.id)} planned for ${longOf(day)}`, note].filter(Boolean).join('. '),
        run: () => {
          void controller.restore(restores);
          void sharedUndo.then((undo) => undo?.());
        },
        drop: () => undefined,
      });
    });
  });

  controller.subscribe(render);
  $('#week-retry').addEventListener('click', () => void controller.retry());
  render();

  addEventListener('storage', (event) => event.key === 'kk:week' && void controller.refresh());
  addEventListener('pageshow', (event) => event.persisted && void controller.refresh());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void controller.refresh());
  void controller.init();
}
