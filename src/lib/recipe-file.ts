// A recipe file: front matter holds the structure, the body holds the method as a numbered list.
// The step text lives only in the body. The front matter keeps each step's ingredient ids, in the same order.
import { parse } from 'yaml';
import type { ExampleRecipe, Step } from '../data/examples.ts';

const frontMatter = (file: string): { data: string; body: string } => {
  const match = file.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('a recipe file needs front matter');
  return { data: match[1], body: match[2] };
};

export const recipeFromFile = (file: string): ExampleRecipe => {
  const { data, body } = frontMatter(file);
  const front = parse(data) as Omit<ExampleRecipe, 'steps'> & { steps: { uses?: string[] }[] };
  const texts = [...body.matchAll(/^\d+\. (.*(?:\n(?!\d+\. ).*)*)/gm)].map((m) => m[1].trim());
  if (texts.length !== front.steps.length) throw new Error(`${front.id}: ${texts.length} steps in the body, ${front.steps.length} in the front matter`);
  const steps: Step[] = front.steps.map((step, i) => (step.uses ? { text: texts[i], uses: step.uses } : { text: texts[i] }));
  return { ...front, steps };
};
