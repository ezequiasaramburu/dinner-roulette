// Editorial blocklist: TheMealDB entries that are not dinner. Reviewed by hand against the full catalog.
// Keyed by TheMealDB idMeal. Keyword rules would also catch real dinners (e.g. "Meatballs in Syrup Sauce"),
// so this stays explicit. Add an entry (with a reason) whenever a bad dish shows up in a deck.

const group = (reason, ids) => ids.map((id) => [id, reason]);

export const EXCLUDED = new Map([
  ...group('sauce, condiment or pickle', [
    '53480', // Creamy Aji green sauce
    '53115', // Red onion pickle
    '53307', // Beetroot & red cabbage sauerkraut
    '53254', // Ezme (salsa)
  ]),
  ...group('side salad or slaw, not a main', [
    '53312', // Tangy cabbage slaw
    '53246', // Tangy carrot, cabbage & onion salad
    '53309', // Cucumber & fennel salad
    '53491', // Shopska Salad
    '53288', // Algerian Flafla (Bell Pepper Salad)
    '53297', // Pomegranate salad
    '53275', // Sweet potato salad
    '53573', // Papaya salad
    '52797', // Spicy North African Potato Salad
    '53081', // Potato Salad (Olivier Salad)
  ]),
  ...group('dessert', [
    '52794', // Vegan Chocolate Cake
  ]),
  ...group('snack, starter or tapas', [
    '53107', // Avocado dip with new potatoes
    '53499', // Prahok Ktis, pork and coconut dip
    '53369', // Silken Tofu with Sesame Soy Sauce
    '53478', // Grilled corn with garlic mayo
    '53417', // Pa Amb Tomaquet (bread with tomato)
    '53176', // Spanish tomato bread with jamon
    '53158', // Air fryer patatas bravas
    '53172', // Patatas bravas
    '53179', // Ham croquetas
    '53145', // Jamon & wild garlic croquetas
    '53561', // Codfish deviled eggs
    '53505', // Conch Fritters
    '53178', // Fried calamari
    '53108', // Quick salt & pepper squid (duplicate of 53233)
    '53023', // Sledz w Oleju (herring in oil)
    '52979', // Bitterballen
    '53109', // Mini chilli beef pies
    '53455', // Chicken Liver Pate
    '53504', // Macaroni Pudding (a side)
  ]),
  ...group('open sandwich / lunch', [
    '53117', // Nordic smorrebrod
    '53554', // Open-faced Sandwich With Potato
  ]),
  ...group('breakfast', [
    '53036', // Boxty Breakfast
  ]),
  ...group('branded fast-food clone', [
    '53013', // Big Mac
    '52813', // Kentucky Fried Chicken
    '53016', // Chick-Fil-A Sandwich
  ]),
  ...group('duplicate of another recipe', [
    '52835', // Fettucine alfredo (keeps 53064)
    '53194', // Tom yum soup with prawns (keeps 53196)
    '53314', // Sauerkraut pierogii (keeps 53296)
  ]),
]);
