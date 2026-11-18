// Bundled as text. The prerender runs inside workerd and cannot read the project directory.
// This file exists on its own because import.meta.glob is only replaced when it is written as a direct call.
export const recipeFiles = import.meta.glob('../content/recipes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
