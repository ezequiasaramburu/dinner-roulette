// Prints a deck for a set of realistic couples so deck quality can be judged by eye.
//   npm run decks:review            # all personas
//   npm run decks:review -- vegan   # personas whose name contains "vegan"
// Needs no Docker: it builds a throwaway database from the migrations and seed.
import { buildDeck, createDb, prefs } from './harness.mjs';

const PERSONAS = [
  ['Open eaters, no preferences', prefs(), prefs()],
  ['Italy + Thailand lovers', prefs({ cuisines: ['Italy', 'Thailand'] }), prefs({ cuisines: ['Thailand', 'Italy', 'Japan'] })],
  ['Different tastes (Spain vs Vietnam)', prefs({ cuisines: ['Spain'] }), prefs({ cuisines: ['Vietnam'] })],
  ['One vegetarian, one omnivore', prefs({ diet: 'vegetarian' }), prefs()],
  ['One vegan + gluten-free, one omnivore', prefs({ diet: 'vegan', allergens: ['gluten'] }), prefs()],
  ['Shellfish + peanut allergy, no pork', prefs({ allergens: ['shellfish', 'peanuts'], disliked: ['pork'] }), prefs()],
  ['No onions, no tomatoes (soft)', prefs({ disliked: ['onions'] }), prefs({ disliked: ['tomatoes', 'chili'] })],
  ['Pescatarian + no mushrooms', prefs({ diet: 'pescatarian', disliked: ['mushrooms'] }), prefs({ cuisines: ['Japan', 'Spain'] })],
  ['Very restrictive (vegan, many allergies)', prefs({ diet: 'vegan', allergens: ['gluten', 'soy', 'tree_nuts', 'sesame'] }), prefs()],
];

const filter = process.argv[2]?.toLowerCase();
const db = await createDb();

for (const [name, a, b] of PERSONAS) {
  if (filter && !name.toLowerCase().includes(filter)) continue;
  const deck = await buildDeck(db, a, b);
  console.log(`\n=== ${name}  (${deck[0]?.pool_size ?? 0} eligible dishes)`);
  console.log(`    A: ${JSON.stringify(a)}\n    B: ${JSON.stringify(b)}`);
  for (const d of deck) {
    const flags = [d.diet_flags.includes('vegan') ? 'vegan' : d.diet_flags.includes('vegetarian') ? 'veg' : '', d.allergens.length ? `allergens: ${d.allergens.join(',')}` : '', d.hits.length ? `contains: ${d.hits.join(',')}` : ''].filter(Boolean).join(' | ');
    console.log(`  ${String(d.pos).padStart(2)}. ${d.title.slice(0, 46).padEnd(46)} ${d.country.slice(0, 14).padEnd(14)} ${d.dish_type.padEnd(9)} ${flags}`);
  }
}
