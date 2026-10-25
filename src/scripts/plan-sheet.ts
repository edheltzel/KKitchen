// Plan button on each recipe card: a day picker sheet, the third way to plan a dinner (after the Week page's
// Add a dinner and swiping/Remove there). Same store key and controller as the Week page. Text via textContent only.
import { createWeekController } from './week-controller';
import { createLocalWeekStore } from './week-store';
import { phoneStorage } from './phone-storage';
import { noteText, weekDays } from './week-plan';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const sheet = $<HTMLDialogElement>('#plan-sheet');
const title = $('#plan-title');
const live = $('#plan-live');
const unavailableBar = $('#week-unavailable');
const cards = [...document.querySelectorAll<HTMLElement>('#recipe-grid article[data-id]')].map((el) => ({
  el,
  id: el.dataset.id!,
  name: el.dataset.name!,
  button: el.querySelector<HTMLButtonElement>('[data-role="plan"]')!,
  status: el.querySelector<HTMLElement>('[data-role="plan-status"]')!,
}));
const nameOf = (id: string) => cards.find((c) => c.id === id)?.name ?? 'a recipe';

const days = weekDays(new Date());
const keys = days.map((d) => d.key);
const todayKey = days[(new Date().getDay() + 6) % 7].key;
const longOf = (key: string) => days.find((d) => d.key === key)!.long;
const shortOf = (key: string) => days.find((d) => d.key === key)!.short;

const store = createLocalWeekStore({ storage: phoneStorage(), knownRecipeIds: new Set(cards.map((c) => c.id)) });
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
  title.textContent = `Plan ${card.el.querySelector('h2')!.textContent}`;
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
sheet.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-day]');
  if (!button || !picking) return;
  const card = picking;
  picking = null;
  sheet.close();
  void controller.plan(button.dataset.day!, card.id);
});

let announced: unknown = null;
controller.subscribe(() => {
  const view = controller.view();
  if (!view.note || view.note === announced) return;
  announced = view.note;
  live.textContent =
    noteText(view.note, longOf, nameOf) ?? `Planned ${nameOf(dinnerOf(view.note.day) ?? '')} on ${longOf(view.note.day)}.`;
});
controller.subscribe(render);
$('#week-retry').addEventListener('click', () => void controller.retry());
render();

addEventListener('storage', (event) => event.key === 'kk:week' && void controller.refresh());
addEventListener('pageshow', (event) => event.persisted && void controller.refresh());
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void controller.refresh());
void controller.init();
