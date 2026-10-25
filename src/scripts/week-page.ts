// Wires the Week page: seven rows (Monday to Sunday of the phone's week), one dinner per day, Add a dinner
// sheet, Remove. Every word from data goes in through textContent, never innerHTML.
import { createWeekController } from './week-controller';
import { createLocalWeekStore } from './week-store';
import { phoneStorage } from './phone-storage';
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
  remove.setAttribute('aria-label', `Remove ${name} from ${day.long}`);
  const label = document.createElement('span');
  label.textContent = 'Remove';
  remove.append(trashIcon(), label);
  card.append(tile, words, remove);
  return card;
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
  if (!target || target.disabled) return;
  const day = dayOf(target.closest<HTMLElement>('li[data-day]')!.dataset.day!);
  if (target.dataset.role === 'add' || target.dataset.role === 'change') openSheet(day);
  if (target.dataset.role === 'remove') void controller.remove(day.key);
});

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
addEventListener('storage', (event) => event.key === 'kk:week' && void controller.refresh());
void controller.init();
