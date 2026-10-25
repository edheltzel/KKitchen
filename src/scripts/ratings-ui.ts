// The ratings buttons, "I'm Ed / I'm Kristina" picker, status lines, Family favorite badge, the
// "Ratings unavailable" banner and the Undo offer, for any page whose cards look like RatingBlock.astro.
// Shared by the Recipes grid and the recipe page. Everything drawn is a fixed label or a value from a fixed
// list, set through textContent. The behaviour itself lives in ratings-controller.ts (no DOM, tested there).
import { PERSON_LABEL, PEOPLE, RATING_LABEL, isFamilyFavorite, ratingOf, type Person, type Rating } from './ratings';
import { RATINGS_KEY, createIdentity, createLocalRatingsStore } from './ratings-store';
import { createRatingsController, type RatingsView } from './ratings-controller';
import { phoneStorage } from './phone-storage';
import type { UndoOffer, createUndoSlot } from './undo-slot';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

/** `cards` are the elements with a data-id that hold a RatingBlock; clicks are handled once, on `root`. */
export function mountRatings({ root, cards: elements, slot }: { root: HTMLElement; cards: HTMLElement[]; slot: ReturnType<typeof createUndoSlot> }) {
  const meButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-me]')];
  const meHint = $('#me-hint');
  const unavailableBar = $('#ratings-unavailable');
  const cards = elements.map((el) => ({
    el,
    id: el.dataset.id!,
    badge: el.querySelector<HTMLElement>('[data-role="family-badge"]')!,
    buttons: [...el.querySelectorAll<HTMLButtonElement>('button[data-rating]')],
    lines: PEOPLE.map((person) => ({ person, el: el.querySelector<HTMLElement>(`[data-person="${person}"]`)! })),
  }));

  // Ratings live in a local stand-in store (this phone's localStorage). The future shared store plugs in
  // behind the same RatingsStore shape. Blocked storage reads as empty and refuses saves, which shows as
  // "Ratings unavailable" rather than silently losing a tap.
  const storage = phoneStorage();
  const controller = createRatingsController({ store: createLocalRatingsStore({ storage }), identity: createIdentity(storage) });

  // The Undo offer on the shared bar: one per controller undo, so the bar's 10 second clock does not restart on redraws.
  let offered: { undo: object; offer: UndoOffer } | null = null;
  function syncUndo(view: RatingsView): void {
    if (!view.undo) {
      if (offered) slot.retract(offered.offer);
      offered = null;
      return;
    }
    if (offered?.undo !== view.undo) {
      offered = {
        undo: view.undo,
        offer: { text: 'Family favorite removed', run: () => void controller.undo(), drop: () => controller.dismissUndo() },
      };
    }
    slot.offer(offered.offer);
  }

  function render(): void {
    const view = controller.view();
    const { ratings, me, unavailable } = view;
    for (const card of cards) {
      for (const line of card.lines) {
        const value = ratings ? ratingOf(ratings, card.id, line.person) : null;
        line.el.textContent = `${PERSON_LABEL[line.person]}: ${unavailable ? 'unavailable' : value ? RATING_LABEL[value] : 'not rated yet'}`;
      }
      for (const button of card.buttons) {
        const mine = me && ratings ? ratingOf(ratings, card.id, me) : null;
        button.setAttribute('aria-pressed', String(mine === button.dataset.rating));
        button.disabled = unavailable; // with nobody picked a tap leads to the picker instead
      }
      card.badge.hidden = !(ratings && isFamilyFavorite(ratings, card.id));
    }
    for (const button of meButtons) button.setAttribute('aria-pressed', String(button.dataset.me === me));
    meHint.hidden = me !== null;
    if (me !== null) meHint.dataset.nudge = 'off';
    unavailableBar.hidden = !unavailable;
    syncUndo(view);
  }

  // A rating tap with nobody picked: take them to the picker and point at the hint. Nothing is saved.
  // The card they tapped is remembered, so picking a person takes them back to it.
  let tappedCard: HTMLElement | null = null;
  function nudgePicker(card: HTMLElement): void {
    tappedCard = card;
    meHint.dataset.nudge = 'on';
    $('#me-picker').scrollIntoView({ block: 'center' });
    meButtons[0]?.focus({ preventScroll: true });
  }

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-rating]');
    const card = button?.closest<HTMLElement>('[data-id]');
    const id = card?.dataset.id;
    if (!button || !card || !id) return;
    if (controller.view().me === null) return nudgePicker(card);
    void controller.tap(id, button.dataset.rating as Rating);
  });
  for (const button of meButtons) {
    button.addEventListener('click', () => {
      controller.setMe(button.dataset.me as Person);
      if (tappedCard?.isConnected && !tappedCard.hidden) tappedCard.scrollIntoView({ block: 'center' }); // back to where they were
      tappedCard = null;
    });
  }
  $('#ratings-retry').addEventListener('click', () => void controller.retry());
  controller.subscribe(render);
  // Another tab, or coming back to the app, may have changed the ratings.
  addEventListener('storage', (event) => event.key === RATINGS_KEY && void controller.refresh());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void controller.refresh());
  render();
  return { controller };
}
