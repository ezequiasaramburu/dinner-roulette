// Pure functions that turn a raw TheMealDB meal into one of our `recipes` rows.
// Allergen ids here must match ALLERGENS in src/constants/food.ts.

export const DINNER_CATEGORIES = new Set([
  'Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood', 'Pasta', 'Vegetarian', 'Vegan',
]);
const MEAT_CATEGORIES = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat']);

const NON_DAIRY = /coconut|almond|soy|oat|rice|cashew|peanut|\bnut\b|cocoa|shea|butter ?beans?|butternut|buttercup|cream of tartar/;
const NOT_GLUTEN_FLOUR = /corn|rice|gram|chickpea|almond|coconut|buckwheat|potato|tapioca|cassava|gluten.free|\boat/;

// [allergen id, matches, optional exclusion]. Matched against each lower-cased ingredient name.
const ALLERGEN_RULES = [
  ['gluten', /\b(flour|bread|breadcrumbs?|panko|pasta|spaghetti|linguine|fettuccine|tagliatelle|penne|macaroni|rigatoni|lasagn[ae]|noodles?|vermicelli|couscous|barley|rye|semolina|bulgur|bulghur|seitan|wheat|pastry|pita|pitta|tortillas?|naan|buns?|biscuits?|crackers?|soy sauce|beer|ale|stout|orzo|gnocchi|filo|phyllo|croutons?|baguette|ciabatta|brioche|dough|teriyaki|worcestershire)\b/, NOT_GLUTEN_FLOUR],
  ['dairy', /\b(milk|cream|butter|ghee|cheese|cheddar|parmesan|parmigiano|mozzarella|mozarella|feta|ricotta|mascarpone|halloumi|paneer|gruy[eè]re|brie|camembert|gorgonzola|pecorino|manchego|emmental|edam|gouda|yogh?urt|kefir|buttermilk|custard|whey|casein|cr[eè]me fra[iî]che|labneh|skyr|quark|ice cream)\b/, NON_DAIRY],
  ['eggs', /\b(eggs?|mayonnaise|mayo|meringue)\b/],
  ['peanuts', /\b(peanuts?|groundnuts?)\b/],
  ['tree_nuts', /\b(almonds?|walnuts?|cashews?|pistachios?|hazelnuts?|pecans?|macadamias?|brazil nuts?|pine nuts?|pine kernels?|chestnuts?|praline|marzipan|nutella|amaretto|nuts?)\b/, /water chestnut/],
  ['soy', /\b(soy|soya|soybeans?|tofu|edamame|miso|tempeh|tamari|soy sauce|teriyaki)\b/],
  ['fish', /\b(fish|salmon|tuna|cod|haddock|mackerel|sardines?|anchov(y|ies)|trout|bass|halibut|tilapia|snapper|herring|pollock|plaice|sole|monkfish|swordfish|eel|kippers?|whitebait|mullet|carp|catfish|pilchards?|bonito|dashi|worcestershire|barramundi|hake|bream|whiting|skate|grouper|mahi.mahi|pike|perch|roe|caviar|surimi|kingfish)\b/],
  ['shellfish', /\b(shrimps?|prawns?|crabs?|crabmeat|lobsters?|mussels?|clams?|oysters?|scallops?|squid|calamari|crayfish|crawfish|langoustines?|cockles?|octopus|cuttlefish|whelks?|abalone|krill|shellfish|conchs?|snails?|escargot)\b/],
  ['sesame', /\b(sesame|tahini|hummus)\b/],
];

const MEAT = /\b(beef|steaks?|mince|veal|brisket|chicken|turkey|duck|goose|pork|bacon|ham|gammon|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|lamb|mutton|goat|venison|rabbit|oxtail|ribs?|liver|kidney|lard|suet|gelatine?|marrow|meatballs?|mortadella|bresaola|pat[eé])\b/;
const NOT_MEAT = /kidney beans?/;
const NON_VEGAN = /\b(honey|gelatine?)\b/;

export function parseIngredients(meal) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] ?? '').trim();
    if (!name) continue;
    out.push({ name, measure: (meal[`strMeasure${i}`] ?? '').trim() });
  }
  return out;
}

export function parseSteps(text) {
  const raw = (text ?? '').replace(/\r/g, '\n');
  let steps = raw
    .split('\n')
    .map((l) => l.trim())
    .map((l) => l.replace(/^step\s*\d+\s*[:.\-)]?\s*/i, '').replace(/^\d+\s*[.):\-]\s*/, ''))
    .filter((l) => l && !/^(step\s*\d*|\d+)$/i.test(l));

  // Some recipes are one big paragraph: split it into sentences so the UI has real steps.
  if (steps.length <= 2 && steps.join(' ').length > 300) {
    const sentences = steps.join(' ').split(/(?<=[.!?])\s+(?=[A-Z])/);
    steps = [];
    for (const s of sentences) {
      if (steps.length && s.length < 25) steps[steps.length - 1] += ' ' + s;
      else steps.push(s);
    }
  }
  return steps;
}

export function tagAllergens(names) {
  const found = new Set();
  for (const name of names) {
    for (const [id, match, exclude] of ALLERGEN_RULES) {
      if (match.test(name) && !(exclude && exclude.test(name))) found.add(id);
    }
  }
  // An unspecified "seafood mix" could contain anything.
  if (names.some((n) => /\bseafood\b/.test(n))) {
    found.add('fish');
    found.add('shellfish');
  }
  return [...found].sort();
}

export function dietFlags({ category, names, allergens }) {
  const hasMeat = names.some((n) => MEAT.test(n) && !NOT_MEAT.test(n)) || MEAT_CATEGORIES.has(category);
  const hasFish = allergens.includes('fish') || allergens.includes('shellfish') || category === 'Seafood';
  const flags = [];
  if (!hasMeat) flags.push('pescatarian');
  if (!hasMeat && !hasFish) {
    flags.push('vegetarian');
    const animal = allergens.includes('dairy') || allergens.includes('eggs') || names.some((n) => NON_VEGAN.test(n));
    if (!animal) flags.push('vegan');
  }
  return flags.sort();
}

/** Raw TheMealDB meal -> `recipes` row, or null if it isn't a usable dinner. */
export function normalizeMeal(meal) {
  if (!DINNER_CATEGORIES.has(meal.strCategory) || !meal.strCountry) return null;

  const ingredients = parseIngredients(meal);
  const steps = parseSteps(meal.strInstructions);
  if (ingredients.length < 3 || steps.length < 1) return null;

  const names = ingredients.map((i) => i.name.toLowerCase());
  const allergens = tagAllergens(names);
  // Safety net for allergy filtering: a Seafood dish we couldn't classify counts as both.
  if (meal.strCategory === 'Seafood' && !allergens.some((a) => a === 'fish' || a === 'shellfish')) {
    allergens.push('fish', 'shellfish');
    allergens.sort();
  }

  return {
    source_id: meal.idMeal,
    title: meal.strMeal.trim(),
    category: meal.strCategory,
    country: meal.strCountry.trim(),
    tags: (meal.strTags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    image_url: meal.strMealThumb,
    youtube_url: meal.strYoutube || null,
    source_url: meal.strSource || null,
    ingredients,
    steps,
    ingredient_names: names,
    allergens,
    diet_flags: dietFlags({ category: meal.strCategory, names, allergens }),
  };
}
