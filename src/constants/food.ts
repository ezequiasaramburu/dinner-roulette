// Ids here are stored in the database. ALLERGENS must match scripts/mealdb/normalize.mjs and the
// check constraints in supabase/migrations/0004_preferences.sql; change all three together.

export type Option = { id: string; label: string; emoji: string };

export const DIETS: Option[] = [
  { id: 'none', label: 'I eat everything', emoji: '🍽️' },
  { id: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥕' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
];

export const ALLERGENS: Option[] = [
  { id: 'gluten', label: 'Gluten', emoji: '🌾' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  { id: 'tree_nuts', label: 'Tree nuts', emoji: '🌰' },
  { id: 'soy', label: 'Soy', emoji: '🫘' },
  { id: 'fish', label: 'Fish', emoji: '🐠' },
  { id: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { id: 'sesame', label: 'Sesame', emoji: '⚪' },
];

export const DISLIKES: Option[] = [
  { id: 'beef', label: 'Beef', emoji: '🥩' },
  { id: 'pork', label: 'Pork', emoji: '🐖' },
  { id: 'lamb', label: 'Lamb', emoji: '🐑' },
  { id: 'chicken', label: 'Chicken', emoji: '🍗' },
  { id: 'seafood', label: 'Seafood', emoji: '🦑' },
  { id: 'mushrooms', label: 'Mushrooms', emoji: '🍄' },
  { id: 'olives', label: 'Olives', emoji: '🫒' },
  { id: 'cilantro', label: 'Cilantro', emoji: '🌿' },
  { id: 'onions', label: 'Onions', emoji: '🧅' },
  { id: 'tomatoes', label: 'Tomatoes', emoji: '🍅' },
  { id: 'bell_peppers', label: 'Bell peppers', emoji: '🫑' },
  { id: 'eggplant', label: 'Eggplant', emoji: '🍆' },
  { id: 'coconut', label: 'Coconut', emoji: '🥥' },
  { id: 'chili', label: 'Spicy chili', emoji: '🌶️' },
  { id: 'tofu', label: 'Tofu', emoji: '🧈' },
  { id: 'beets', label: 'Beets', emoji: '🟣' },
];

const COUNTRY_CODES: Record<string, string> = {
  Afghanistan: 'AF', Albania: 'AL', Algeria: 'DZ', Argentina: 'AR', Australia: 'AU', Austria: 'AT',
  Barbados: 'BB', Belgium: 'BE', Brazil: 'BR', Bulgaria: 'BG', Cambodia: 'KH', Canada: 'CA',
  'Cayman Islands': 'KY', Chile: 'CL', China: 'CN', Colombia: 'CO', 'Costa Rica': 'CR', Croatia: 'HR',
  Denmark: 'DK', Dominica: 'DM', Egypt: 'EG', Estonia: 'EE', France: 'FR', Greece: 'GR', India: 'IN',
  Ireland: 'IE', Italy: 'IT', Jamaica: 'JM', Japan: 'JP', Kenya: 'KE', Malaysia: 'MY', Mexico: 'MX',
  Morocco: 'MA', Netherlands: 'NL', Norway: 'NO', Philippines: 'PH', Poland: 'PL', Portugal: 'PT',
  Russia: 'RU', 'Saudi Arabia': 'SA', Spain: 'ES', Thailand: 'TH', Tunisia: 'TN', Turkey: 'TR',
  Ukraine: 'UA', 'United Kingdom': 'GB', 'United States': 'US', Uruguay: 'UY', Venezuela: 'VE', Vietnam: 'VN',
};

/** Flag emoji for a country name from the recipe data, or a plate for anything we don't know. */
export function countryFlag(country: string): string {
  const code = COUNTRY_CODES[country];
  if (!code) return '🍽️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const DISH_TYPE_LABELS: Record<string, string> = {
  soup: 'Soup', salad: 'Salad', pasta: 'Pasta', noodles: 'Noodles', handheld: 'Handheld', pie: 'Pie & pastry',
  dumplings: 'Dumplings', curry: 'Curry', rice: 'Rice dish', stew: 'Stew', fried: 'Crispy & fried',
  grilled: 'Roast & grill', stirfry: 'Stir-fry', egg: 'Eggs', meatballs: 'Meatballs', legumes: 'Beans & lentils',
  meat: 'Meat', seafood: 'Seafood', veg: 'Vegetable',
};

export const dishTypeLabel = (type: string) => DISH_TYPE_LABELS[type] ?? 'Dinner';

export const allergenLabel = (id: string) => ALLERGENS.find((a) => a.id === id)?.label ?? id;
