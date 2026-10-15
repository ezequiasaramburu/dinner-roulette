type Ingredient = { name: string; measure: string };

/** Plain text for the share sheet: the dish name, then one "- measure name" line per ingredient. */
export function shoppingList(title: string, ingredients: Ingredient[]) {
  const lines = ingredients.map((i) => `- ${`${i.measure} ${i.name}`.trim()}`);
  return [`Ingredients for ${title}`, ...lines].join('\n');
}
