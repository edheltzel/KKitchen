// Recipes page entry for the plan sheet: every card in the grid gets a Plan button.
import { mountPlanSheet } from './plan-ui';

const cards = [...document.querySelectorAll<HTMLElement>('#recipe-grid article[data-id]')];
mountPlanSheet({ cards, names: new Map(cards.map((el) => [el.dataset.id!, el.dataset.name!])) });
