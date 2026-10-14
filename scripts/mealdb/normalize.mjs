// Pure functions that turn a raw TheMealDB meal into one of our `recipes` rows.
// Allergen ids here must match ALLERGENS in src/constants/food.ts.

export const DINNER_CATEGORIES = new Set([
  'Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood', 'Pasta', 'Vegetarian', 'Vegan',
]);
const MEAT_CATEGORIES = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat']);

// Whole words only: a bare "oat" would also match "goats cheese".
const NON_DAIRY = /coconut|almond|\bsoy|\boats?\b|\brice\b|cashew|peanut|\bnut\b|cocoa|shea|butter ?beans?|butternut|buttercup|cream of tartar|vegan|plant.based|dairy.free|non.dairy/;
const NOT_GLUTEN_FLOUR = /corn|rice|gram|chickpea|almond|coconut|buckwheat|potato|tapioca|cassava|gluten.free|\boat/;

// [allergen id, matches, optional exclusion]. Matched against each lower-cased ingredient name.
const ALLERGEN_RULES = [
  ['gluten', /\b(flour|bread|breadcrumbs?|panko|pasta|spaghetti|linguine|fettuccine|tagliatelle|penne|macaroni|rigatoni|lasagn[ae]|noodles?|vermicelli|couscous|barley|rye|semolina|bulgur|bulghur|seitan|wheat|pastry|pita|pitta|tortillas?|naan|buns?|biscuits?|crackers?|soy sauce|beer|ale|stout|orzo|gnocchi|filo|phyllo|croutons?|baguette|ciabatta|brioche|dough|teriyaki|worcestershire)\b/, NOT_GLUTEN_FLOUR],
  ['dairy', /\b(milk|cream|butter|ghee|cheese|cheddar|parmesan|parmigiano|mozzarella|mozarella|feta|ricotta|mascarpone|halloumi|paneer|gruy[eè]re|brie|camembert|gorgonzola|pecorino|manchego|emmental|edam|gouda|yogh?urt|kefir|buttermilk|custard|whey|casein|cr[eè]me fra[iî]che|labneh|skyr|quark|ice cream)\b/, NON_DAIRY],
  ['eggs', /\b(eggs?|mayonnaise|mayo|meringue)\b/, /vegan|egg.free|plant.based/],
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

// Dish family, derived from the title: lets a deck avoid three rice dishes or three pies in a row.
// First matching rule wins, so order matters (specific before general). Unmatched dishes fall back to the
// category ("meat", "seafood") and finally "other". Reviewed against the whole catalog: see normalize.test.mjs.
const DISH_FAMILIES = [
  ['soup', /\b(soups?|broth|chowder|bisque|bors[c]h|borscht|bortsch|shchi|ukha|pho|laksa|congee|waterzooi|ribollita|pistou|fiskesuppe|tom (yum|kha)|chorba|leblebi)\b/i],
  ['salad', /\bsalad\b/i],
  ['pasta', /\b(pasta|mac and cheese|spaghetti|linguine|fettuccine|fettucine|penne|rigatoni|lasagn[ae]|cannelloni|macaroni|carbonara|bolognese|fideu[aà]|alfredo|puttanesca|cassoulet)\b/i],
  ['noodles', /\b(noodles?|lo mein|chow fun|chow mein|pad thai|pad see ew|ramen|udon|soba|mee goreng|bun-thit|drunken|singapore|yaki)\b/i],
  ['handheld', /\b(sandwich(es)?|burgers?|wraps?|tacos?|fajitas?|banh mi|arepas?|chivito|kapsalon|sloppy joes?|burritos?|quesadillas?|pita|choripán|zapiekanki|shawarma|prego|pizza|lahmacun|buns|roti(?! a l)|patties|parcels|cakes)\b/i],
  ['pie', /\b(pie|pies|pasty|pasties|pastel|tart|tourti[eè]re|wellington|empanadas?|pierogi|pierogii|briks|rotolo|flamiche|lakror|paszteciki|toad in the hole|pate chinois|moussaka)\b/i],
  ['dumplings', /\b(dumplings?|wontons?|gyoza|kn[öo]del|halu[sš]ky|gnocchi|raspeballer|momos?|dolma|golabki|cabbage rolls?|stuffed|spiralized rolls)\b/i],
  ['curry', /\b(curry|masala|rogan josh|korma|handi|karahi|rendang|massaman|panang|amok|moqueca|samlar|kaeng|tikka|katsu curry)\b/i],
  ['rice', /\b(rice|paella|risotto|pilaf|pilau|plov|biryani|mandi|kabse|arroz|jollof|koshari|nasi|gallo pinto|kedgeree|pulao|mastawa|mujaddara)\b/i],
  ['stew', /\b(stew|hotpot|hot pot|goulash|ragu|bourguignon|tagine|tajine|caldereta|sancocho|feijoada|bigos|pepperpot|mechado|pot roast|hodge|hutsepot|lapskaus|fårikål|waterzooi|chilli|chili|casserole|stoemp|stamppot|colcannon|hash)\b/i],
  ['fried', /\b(katsu|tonkatsu|katsudon|milanesa|schnitzel|breaded|karaage|fried chicken|crispy|wings|fritters?|croquetas|lollipop|calamari|squid|fried)\b/i],
  ['grilled', /\b(roast|roasted|grilled|grill|bbq|barbecue|barbecued|asado|kebabs?|skewers|tandoori|jerk|souvlaki|steak|chops|shanks?|brisket|ribs|smoked|peka|choma|seswaa|tafelspitz|leg of|slow-?cooked|sunday)\b/i],
  ['stirfry', /\b(stir-?fr(y|ied)|kung|szechuan|sichuan|teriyaki|sweet and sour|general ts|lok lak|prawn stir|snow peas|bistek|salt (and|&) pepper|orange chicken|honey)\b/i],
  ['egg', /\b(omelette|omelet|tortilla|shakshuka|frittata|egg foo|huevos|pisto|tortang|eggs)\b/i],
  ['meatballs', /\b(meatballs?|kofta|kefta|kafta|frikadeller|fa[sš][ií]rky|rissoles|cevapi|karbonader|meatloaves|bitterballen)\b/i],
  ['legumes', /\b(beans?|lentils?|dal|dhal|chickpeas?|falafel|ful|hummus|tamiya|kidney)\b/i],
];

export function dishFamily(title, category) {
  for (const [family, pattern] of DISH_FAMILIES) if (pattern.test(title)) return family;
  if (category === 'Seafood') return 'seafood';
  if (['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat'].includes(category)) return 'meat';
  if (category === 'Vegetarian' || category === 'Vegan') return 'veg';
  return 'other';
}

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
    dish_type: dishFamily(meal.strMeal, meal.strCategory),
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
