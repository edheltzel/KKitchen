// Wires the Week page: seven rows (Monday to Sunday of the phone's week), one dinner per day, Add a dinner
// sheet, Remove. Every word from data goes in through textContent, never innerHTML.
import { createWeekController } from './week-controller';
import { createLocalWeekStore } from './week-store';
import { phoneStorage } from './phone-storage';
import { createUndoBar } from './undo-bar';
import { noteText, weekDays, weekRange, type WeekDay } from './week-plan';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const sheet = $<HTMLDialogElement>('#add-sheet');
const sheetTitle = $('#add-title');
const live = $('#week-live');
const recipes = new Map(
  [...sheet.querySelectorAll<HTMLButtonElement>('button[data-id]')].map((button) => [
    button.dataset.id!,
    { id: button.dataset.id!, name: button.dataset.name!, button, where: button.querySelector<HTMLElement>('[data-role="where"]')! },
  ]),
);
const nameOf = (id: string) => recipes.get(id)?.name ?? 'a recipe';

const days: WeekDay[] = weekDays(new Date());
const keys = days.map((d) => d.key);
const dayOf = (key: string) => days.find((d) => d.key === key)!;
const longOf = (key: string) => dayOf(key).long;

const rows = new Map<string, { li: HTMLElement; cell: HTMLElement }>();
$('#week-range').textContent = weekRange(days);
const todayKey = days[(new Date().getDay() + 6) % 7].key;
document.querySelectorAll<HTMLElement>('#week-list li[data-slot]').forEach((li) => {
  const day = days[Number(li.dataset.slot)];
  li.dataset.day = day.key;
  if (day.key === todayKey) {
    li.dataset.today = '';
    li.querySelector('.kk-week-day')!.setAttribute('aria-current', 'date');
  }
  rows.set(day.key, { li, cell: li.querySelector<HTMLElement>('.kk-week-cell')! });
});

const store = createLocalWeekStore({ storage: phoneStorage(), knownRecipeIds: new Set(recipes.keys()) });
const controller = createWeekController({ store, days: keys });
const undoBar = createUndoBar({ bar: $('#undo-bar'), stack: $('#bottom-stack'), expire: () => controller.dismissUndo() });
const undoText = $('#undo-text');
const unavailableBar = $('#week-unavailable');
const shortOf = (key: string) => dayOf(key).short;

const SVG = 'http://www.w3.org/2000/svg';
function trashIcon(): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3');
  svg.append(path);
  return svg;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, role?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (role) node.dataset.role = role;
  return node;
};

function dinnerCell(day: WeekDay, recipeId: string, note: string | null, disabled: boolean): HTMLElement {
  const name = nameOf(recipeId);
  const card = el('div', 'kk-week-card', 'card');
  const tile = el('span', 'kk-tile kk-week-tile');
  const letter = el('span', 'kk-tile-letter kk-week-letter');
  letter.textContent = name.slice(0, 1).toUpperCase();
  tile.append(letter);
  const words = el('button', 'kk-week-text', 'change');
  words.type = 'button';
  words.disabled = disabled;
  words.setAttribute('aria-label', `Change the dinner on ${day.long}`);
  const title = el('span', 'kk-week-name', 'name');
  title.textContent = name;
  words.append(title);
  if (note) {
    const noteEl = el('span', 'kk-week-note', 'note');
    noteEl.textContent = note;
    words.append(noteEl);
  }
  const remove = el('button', 'kk-week-remove', 'remove');
  remove.type = 'button';
  remove.disabled = disabled;
  remove.setAttribute('aria-label', 'Remove');
  remove.title = 'Remove'; // the hover title on desktop; the name stays the aria-label
  remove.append(trashIcon());
  card.append(tile, words, remove);
  // The red area under the card: a swipe slides the card left to show it. Not in the tab order, because the outlined
  // Remove icon button does the same job for keyboards and screen readers.
  const reveal = el('button', 'kk-week-reveal', 'reveal');
  reveal.type = 'button';
  reveal.tabIndex = -1;
  reveal.setAttribute('aria-hidden', 'true');
  reveal.disabled = disabled;
  const revealText = el('span', 'kk-week-reveal-text', 'reveal-text');
  revealText.textContent = 'Remove';
  reveal.append(trashIcon(), revealText);
  const swipe = el('div', 'kk-week-swipe');
  swipe.dataset.state = 'closed';
  swipe.append(reveal, card);
  return swipe;
}

function emptyCell(day: WeekDay, disabled: boolean): HTMLElement {
  const add = el('button', 'kk-week-add', 'add');
  add.type = 'button';
  add.disabled = disabled;
  add.textContent = '+ Add a dinner';
  add.setAttribute('aria-label', `Add a dinner for ${day.long}`);
  return add;
}

let lastPlan = null as ReturnType<typeof controller.view>['plan'];
function render(): void {
  const view = controller.view();
  if (view.plan) lastPlan = view.plan;
  const plan = lastPlan ?? {};
  const note = noteText(view.note, longOf, nameOf);
  if (view.undo) undoText.textContent = `Took ${nameOf(view.undo.recipeId)} off ${shortOf(view.undo.day)}`;
  undoBar.show(view.undo);
  unavailableBar.hidden = !view.unavailable;
  for (const day of days) {
    const { cell } = rows.get(day.key)!;
    const recipeId = plan[day.key]?.recipeId ?? null;
    const noteHere = view.note?.day === day.key ? note : null;
    const sig = `${recipeId}|${noteHere}|${view.unavailable}`;
    if (cell.dataset.sig === sig) continue;
    cell.dataset.sig = sig;
    cell.replaceChildren(recipeId ? dinnerCell(day, recipeId, noteHere, view.unavailable) : emptyCell(day, view.unavailable));
  }
}

let addDay: WeekDay | null = null;
function openSheet(day: WeekDay): void {
  addDay = day;
  sheetTitle.textContent = `Dinner for ${day.long}`;
  const plan = lastPlan ?? {};
  for (const recipe of recipes.values()) {
    const where = keys.find((k) => plan[k]?.recipeId === recipe.id);
    recipe.where.textContent = where === day.key ? 'Planned here' : where ? `On ${longOf(where)}. Planning it here moves it.` : '';
  }
  sheet.showModal();
}

$('#week-list').addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-role]');
  if (swallowClick || !target || target.disabled) return;
  const day = dayOf(target.closest<HTMLElement>('li[data-day]')!.dataset.day!);
  if (target.dataset.role === 'add' || target.dataset.role === 'change') openSheet(day);
  if (target.dataset.role === 'remove' || target.dataset.role === 'reveal') removeDinner(day.key);
});

// One tap, one removal: a second tap while the first is saving does nothing (the controller also refuses an empty day).
const removing = new Set<string>();
function removeDinner(day: string): void {
  if (removing.has(day)) return;
  removing.add(day);
  void controller.remove(day).finally(() => removing.delete(day));
}

// Swipe left on a dinner: past about 40px it can rest open on the red Remove; a long swipe (more than half
// the row) says "Release to remove" and removes when the finger lifts. A mostly-vertical drag is just scrolling.
const REVEAL = 96;
const LONG = 0.55;
let openSwipe: HTMLElement | null = null;
let drag: { swipe: HTMLElement; x: number; y: number; start: number; mode: 'unknown' | 'swipe' | 'scroll'; offset: number; width: number } | null = null;
let swallowClick = false;

function setOffset(swipe: HTMLElement, offset: number, width: number): void {
  const card = swipe.querySelector<HTMLElement>('.kk-week-card')!;
  const reveal = swipe.querySelector<HTMLElement>('.kk-week-reveal')!;
  card.style.transform = offset === 0 ? '' : `translateX(${offset}px)`;
  reveal.style.width = `${-offset}px`;
  const long = -offset > width * LONG;
  reveal.dataset.long = long ? 'on' : 'off';
  reveal.querySelector('[data-role="reveal-text"]')!.textContent = long ? 'Release to remove' : 'Remove';
}
function settle(swipe: HTMLElement, state: 'open' | 'closed'): void {
  swipe.dataset.state = state;
  setOffset(swipe, state === 'open' ? -REVEAL : 0, swipe.getBoundingClientRect().width);
  if (state === 'open') openSwipe = swipe;
  else if (openSwipe === swipe) openSwipe = null;
}

const list = $('#week-list');
list.addEventListener('pointerdown', (event) => {
  const target = event.target as HTMLElement;
  const swipe = target.closest<HTMLElement>('.kk-week-swipe');
  if (openSwipe && openSwipe !== swipe) settle(openSwipe, 'closed');
  if (!swipe || target.closest('[data-role="reveal"]') || !event.isPrimary) return;
  drag = { swipe, x: event.clientX, y: event.clientY, start: swipe.dataset.state === 'open' ? -REVEAL : 0, mode: 'unknown', offset: 0, width: swipe.getBoundingClientRect().width };
});
list.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (drag.mode === 'unknown') {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    drag.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll';
    if (drag.mode === 'swipe') {
      drag.swipe.dataset.state = 'dragging';
      drag.swipe.setPointerCapture?.(event.pointerId);
    }
  }
  if (drag.mode !== 'swipe') return;
  drag.offset = Math.min(0, Math.max(-drag.width, drag.start + dx));
  setOffset(drag.swipe, drag.offset, drag.width);
});
function endDrag(event: PointerEvent): void {
  const current = drag;
  drag = null;
  if (!current || current.mode !== 'swipe') return;
  swallowClick = true;
  setTimeout(() => (swallowClick = false), 0);
  const day = current.swipe.closest<HTMLElement>('li[data-day]')!.dataset.day!;
  if (event.type === 'pointercancel') return settle(current.swipe, 'closed');
  if (-current.offset > current.width * LONG) {
    settle(current.swipe, 'closed');
    removeDinner(day);
  } else settle(current.swipe, -current.offset > REVEAL / 2 ? 'open' : 'closed');
}
list.addEventListener('pointerup', endDrag);
list.addEventListener('pointercancel', endDrag);

sheet.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
  if (!button || !addDay) return;
  const day = addDay;
  addDay = null;
  sheet.close();
  void controller.plan(day.key, button.dataset.id!);
});

// What a change did, for people who cannot see the row: a polite announcement.
let announced: unknown = null;
controller.subscribe(() => {
  const view = controller.view();
  if (view.note && view.note !== announced) {
    announced = view.note;
    live.textContent =
      noteText(view.note, longOf, nameOf) ?? `Planned ${nameOf(lastPlan?.[view.note.day]?.recipeId ?? '')} on ${longOf(view.note.day)}.`;
  }
});
controller.subscribe(render);
render();

// The week rolls over at midnight; coming back to an old page after that shows the new week.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (weekDays(new Date())[0].key !== keys[0]) location.reload();
  else void controller.refresh();
});
$('#week-retry').addEventListener('click', () => void controller.retry());
$('#undo-button').addEventListener('click', () => void controller.undo());
addEventListener('storage', (event) => event.key === 'kk:week' && void controller.refresh());
void controller.init();
