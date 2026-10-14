// Editorial diet corrections: TheMealDB entries our ingredient rules get wrong. Keyed by idMeal.
// `flags` replaces the computed diet_flags, so list every flag that should apply (a vegetarian dish is also
// pescatarian). `allergens` are added to the computed ones, for when the ingredient list leaves something out
// (the method mentions it). The importer refuses a vegetarian dish that names meat and an id that is not in the
// catalog. Add an entry (with a reason) when a deck shows a miss.

export const DIET_OVERRIDES = new Map([
  [
    '53000', // Vegetable Shepherds Pie
    { flags: ['pescatarian', 'vegetarian'], reason: 'Filed under Beef by TheMealDB, but lentils and mushrooms, no meat' },
  ],
  [
    '52955', // Egg Drop Soup
    {
      flags: ['pescatarian', 'vegetarian'],
      allergens: ['eggs'],
      reason: 'The ingredient list omits the eggs the method uses, so it is neither vegan nor egg-free',
    },
  ],
  [
    '53025', // Ful Medames
    {
      flags: ['pescatarian', 'vegetarian'],
      allergens: ['eggs'],
      reason: 'Served with hard-boiled eggs that the ingredient list omits, so it is not vegan',
    },
  ],
]);
