// Ids here are stored in the database. ALLERGENS must match scripts/mealdb/normalize.mjs and the
// check constraints in supabase/migrations/0004_preferences.sql; change all three together.

export type Option = { id: string; label: string; emoji: string };

export const DIETS: Option[] = [
  { id: "none", label: "I eat everything", emoji: "🍽️" },
  { id: "pescatarian", label: "Pescatarian", emoji: "🐟" },
  { id: "vegetarian", label: "Vegetarian", emoji: "🥕" },
  { id: "vegan", label: "Vegan", emoji: "🌱" },
];

export const ALLERGENS: Option[] = [
  { id: "gluten", label: "Gluten", emoji: "🌾" },
  { id: "dairy", label: "Dairy", emoji: "🥛" },
  { id: "eggs", label: "Eggs", emoji: "🥚" },
  { id: "peanuts", label: "Peanuts", emoji: "🥜" },
  { id: "tree_nuts", label: "Tree nuts", emoji: "🌰" },
  { id: "soy", label: "Soy", emoji: "🫘" },
  { id: "fish", label: "Fish", emoji: "🐠" },
  { id: "shellfish", label: "Shellfish", emoji: "🦐" },
  { id: "sesame", label: "Sesame", emoji: "⚪" },
];

export const DISLIKES: Option[] = [
  { id: "beef", label: "Beef", emoji: "🥩" },
  { id: "pork", label: "Pork", emoji: "🐖" },
  { id: "lamb", label: "Lamb", emoji: "🐑" },
  { id: "chicken", label: "Chicken", emoji: "🍗" },
  { id: "seafood", label: "Seafood", emoji: "🦑" },
  { id: "mushrooms", label: "Mushrooms", emoji: "🍄" },
  { id: "olives", label: "Olives", emoji: "🫒" },
  { id: "cilantro", label: "Cilantro", emoji: "🌿" },
  { id: "onions", label: "Onions", emoji: "🧅" },
  { id: "tomatoes", label: "Tomatoes", emoji: "🍅" },
  { id: "bell_peppers", label: "Bell peppers", emoji: "🫑" },
  { id: "eggplant", label: "Eggplant", emoji: "🍆" },
  { id: "coconut", label: "Coconut", emoji: "🥥" },
  { id: "chili", label: "Spicy chili", emoji: "🌶️" },
  { id: "tofu", label: "Tofu", emoji: "🧈" },
  { id: "beets", label: "Beets", emoji: "🟣" },
];

export { countryFlag } from "./countries";

const DISH_TYPE_LABELS: Record<string, string> = {
  soup: "Soup",
  salad: "Salad",
  pasta: "Pasta",
  noodles: "Noodles",
  handheld: "Handheld",
  pie: "Pie & pastry",
  dumplings: "Dumplings",
  curry: "Curry",
  rice: "Rice dish",
  stew: "Stew",
  fried: "Crispy & fried",
  grilled: "Roast & grill",
  stirfry: "Stir-fry",
  egg: "Eggs",
  meatballs: "Meatballs",
  legumes: "Beans & lentils",
  meat: "Meat",
  seafood: "Seafood",
  veg: "Vegetable",
};

export const dishTypeLabel = (type: string) =>
  DISH_TYPE_LABELS[type] ?? "Dinner";

export const allergenLabel = (id: string) =>
  ALLERGENS.find((a) => a.id === id)?.label ?? id;

export const DEFAULT_MATCH_GOAL = 1;
