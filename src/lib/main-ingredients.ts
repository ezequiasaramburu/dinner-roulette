// What a dish is "made of", for the swipe card. Recipes list ingredients in the order the author wrote them, which
// buries the point of the dish under oil and salt, so we drop the pantry basics and put the main ingredients first.

/** Oils, salt, spices, herbs, stock, sugar, flour, aromatics and condiments: in nearly every dish, so they say little. */
const BASICS =
  /\b(salt|black pepper|white pepper|ground pepper|peppercorns?|water|oil|vinegar|sugar|honey|flour|cornflour|cornstarch|starch|stock|broth|bouillon|yeast|baking (powder|soda)|bay leaf|bay leaves|cumin|paprika|turmeric|cinnamon|nutmeg|allspice|cloves?|cayenne|oregano|thyme|rosemary|parsley|coriander|cilantro|mint|dill|basil|sage|chives?|saffron|spices?|seasoning|garlic|onions?|shallots?|scallions?|spring onions?|ginger|soy sauce|fish sauce|oyster sauce|worcestershire sauce|tomato (puree|paste)|mustard|ketchup|butter|margarine|milk|cream|wine|lime|lemon juice|lime juice)\b/i;

/** Ingredients that tell you what the meal actually is: proteins, legumes, cheese and staples. */
const MAINS =
  /\b(chicken|beef|steak|pork|lamb|mutton|bacon|chorizo|sausages?|ham|turkey|duck|veal|mince|meatballs?|fish|salmon|cod|tuna|haddock|trout|sardines?|anchov\w+|prawns?|shrimps?|squid|mussels?|clams?|crab|lobster|eggs?|tofu|tempeh|chickpeas?|lentils?|beans?|peas|cheese|halloumi|feta|paneer|mozzarella|pasta|spaghetti|linguine|penne|lasagne|noodles?|rice|potato(es)?|bread|couscous|quinoa|pastry|dough|tortillas?|pumpkin|aubergines?|eggplants?|mushrooms?)\b/i;

function titleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Up to `count` main ingredient names (lower-cased as stored), main ingredients first, pantry basics last. */
export function mainIngredients(names: string[], count = 4): string[] {
  const seen = new Set<string>();
  const interesting = names.filter((n) => {
    const key = n.trim().toLowerCase();
    if (!key || seen.has(key) || key === 'pepper' || BASICS.test(key)) return false;
    seen.add(key);
    return true;
  });
  const mains = interesting.filter((n) => MAINS.test(n));
  const rest = interesting.filter((n) => !MAINS.test(n));
  return [...mains, ...rest].slice(0, count);
}

/** "Chicken · rice · peppers", or null when nothing is left after dropping the basics. */
export function ingredientLine(names: string[], count = 4): string | null {
  const main = mainIngredients(names, count);
  if (!main.length) return null;
  return titleCase(main.join(' · '));
}

/** Every ingredient name, nicely capitalised, with duplicates (egg / eggs) kept as the recipe wrote them. */
export function ingredientList(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].map(titleCase);
}
