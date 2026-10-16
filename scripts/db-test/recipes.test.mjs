import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { addUser, asUser, createDb } from './harness.mjs';

let db;
before(async () => {
  db = await createDb();
});

const as = (user, sql, params = []) => asUser(db, user, () => db.query(sql, params));
const rpc = async (user, sql, params = []) => (await as(user, sql, params)).rows;

const ing = (...names) => names.map((name) => ({ name, measure: '1' }));
const STEPS = ['Chop everything.', 'Cook it until done.'];

let counter = 0;
async function newUser(name) {
  const id = await addUser(db, `${name}-${++counter}@test.dev`);
  await db.query('update public.profiles set display_name = $2 where id = $1', [id, name]);
  return id;
}

async function submit(user, over = {}) {
  const v = {
    title: 'Garlic rice bowl',
    country: 'Kenya',
    ingredients: ing('rice', 'garlic', 'broccoli', 'olive oil'),
    steps: STEPS,
    image: null,
    terms: true,
    ...over,
  };
  const rows = await rpc(user, 'select public.submit_recipe($1, $2, $3::jsonb, $4::jsonb, $5, $6) as id', [
    v.title, v.country, JSON.stringify(v.ingredients), JSON.stringify(v.steps), v.image, v.terms,
  ]);
  return rows[0].id;
}

const recipe = async (id) => (await db.query('select * from public.recipes where id = $1', [id])).rows[0];
const approve = (id) => db.query("update public.recipes set status = 'approved' where id = $1", [id]);

async function couple(diet = 'vegan') {
  const owner = await newUser('Owner');
  const partner = await newUser('Partner');
  await rpc(owner, 'select public.create_couple($1)', ['UTC']);
  const code = (await rpc(owner, 'select public.create_invite() as code'))[0].code;
  await rpc(partner, 'select public.join_couple($1)', [code]);
  for (const u of [owner, partner]) await db.query('insert into public.preferences (user_id, diet) values ($1, $2)', [u, diet]);
  return { owner, partner };
}

/** The recipes in this couple's queue, built fresh. A vegan couple has a small pool, so everything fits in the queue. */
async function queue(user) {
  await db.query('delete from public.daily_decks where true');
  await rpc(user, 'select public.get_swipe_feed()');
  const { rows } = await db.query('select recipe_ids from public.daily_decks');
  return rows[0].recipe_ids;
}

describe('the derivation rules agree with the importer on the whole catalogue', () => {
  // Hand-corrected in scripts/mealdb/overrides.mjs, so the rules are not expected to reproduce them.
  const OVERRIDDEN = new Set(['53000', '52955', '53025']);

  test('allergens, diet flags and swaps', async () => {
    const { rows } = await db.query(
      `select source_id, title, allergens, diet_flags, swaps, public.derive_flags(category, ingredient_names) as f
       from public.recipes where author_id is null`,
    );
    assert.ok(rows.length > 400);
    const wrong = [];
    for (const r of rows) {
      if (OVERRIDDEN.has(r.source_id)) continue;
      const same =
        JSON.stringify(r.allergens) === JSON.stringify(r.f.allergens) &&
        JSON.stringify(r.diet_flags) === JSON.stringify(r.f.diet_flags) &&
        JSON.stringify(r.swaps) === JSON.stringify(r.f.swaps);
      if (!same) wrong.push(`${r.title}: stored ${r.allergens}|${r.diet_flags} vs derived ${r.f.allergens}|${r.f.diet_flags}`);
    }
    assert.deepEqual(wrong, []);
  });

  test('dish types', async () => {
    const { rows } = await db.query(
      `select title, dish_type, public.derive_dish_type(title, category) as derived from public.recipes where author_id is null`,
    );
    // JavaScript's \b doesn't see "à" as a letter, so the importer files "Seafood fideuà" under seafood; the rules
    // here correctly call it pasta. Anything else that differs is a bug in one of the two.
    const known = new Set(['Seafood fideuà']);
    assert.deepEqual(
      rows.filter((r) => r.dish_type !== r.derived && !known.has(r.title)).map((r) => `${r.title}: ${r.dish_type} vs ${r.derived}`),
      [],
    );
  });
});

describe('what is derived from the ingredients', () => {
  test('a chicken pie: meat, dairy and gluten, and the title says it is a pie', async () => {
    const u = await newUser('Chef');
    const r = await recipe(await submit(u, { title: 'Creamy chicken pie', ingredients: ing('chicken breast', 'double cream', 'plain flour', 'butter') }));
    assert.equal(r.category, 'Chicken');
    assert.equal(r.dish_type, 'pie');
    assert.deepEqual(r.allergens, ['dairy', 'gluten']);
    assert.deepEqual(r.diet_flags, []);
    assert.deepEqual(r.ingredient_names, ['chicken breast', 'double cream', 'plain flour', 'butter']);
  });

  test('a plant-based dish is vegan, and an egg makes it vegetarian only', async () => {
    const u = await newUser('Chef');
    const vegan = await recipe(await submit(u, { ingredients: ing('rice', 'broccoli', 'garlic') }));
    assert.equal(vegan.category, 'Vegan');
    assert.deepEqual(vegan.diet_flags, ['pescatarian', 'vegan', 'vegetarian']);
    const egg = await recipe(await submit(u, { title: 'Egg fried rice', ingredients: ing('rice', 'egg', 'peas') }));
    assert.equal(egg.category, 'Vegetarian');
    assert.deepEqual(egg.diet_flags, ['pescatarian', 'vegetarian']);
    assert.deepEqual(egg.allergens, ['eggs']);
  });

  test('fish makes a dish pescatarian with the fish allergen', async () => {
    const u = await newUser('Chef');
    const r = await recipe(await submit(u, { title: 'Baked salmon', ingredients: ing('salmon', 'lemon', 'potatoes') }));
    assert.equal(r.category, 'Seafood');
    assert.deepEqual(r.allergens, ['fish']);
    assert.deepEqual(r.diet_flags, ['pescatarian']);
  });

  test('a meat stock cube is a swap, not a reason to call the dish meat', async () => {
    const u = await newUser('Chef');
    const r = await recipe(await submit(u, { title: 'Pea soup', ingredients: ing('peas', 'chicken stock cube', 'potatoes', 'leek') }));
    assert.deepEqual(r.diet_flags, ['pescatarian', 'vegan', 'vegetarian']);
    assert.deepEqual(r.swaps, [{ from: 'chicken stock cube', to: 'vegetable stock cube' }]);
    assert.equal(r.category, 'Vegan');
  });

  test('changing the ingredients derives everything again', async () => {
    const u = await newUser('Chef');
    const id = await submit(u, { ingredients: ing('rice', 'broccoli', 'garlic') });
    await db.query(
      "update public.recipes set ingredients = $2::jsonb where id = $1",
      [id, JSON.stringify(ing('rice', 'prawns', 'garlic'))],
    );
    const r = await recipe(id);
    assert.equal(r.category, 'Seafood');
    assert.deepEqual(r.allergens, ['shellfish']);
  });
});

describe('submitting a recipe', () => {
  test('it starts pending, with the author and a submission time', async () => {
    const u = await newUser('Chef');
    const r = await recipe(await submit(u));
    assert.equal(r.status, 'pending');
    assert.equal(r.author_id, u);
    assert.ok(r.submitted_at);
    assert.equal(r.source_id, null);
  });

  test('bad input is refused with a reason', async () => {
    const u = await newUser('Chef');
    const refused = (over, pattern) => assert.rejects(submit(u, over), pattern);
    await refused({ title: 'Hi' }, /invalid_title/);
    await refused({ country: 'Narnia' }, /invalid_country/);
    await refused({ ingredients: ing('rice', 'peas') }, /invalid_ingredients/);
    await refused({ ingredients: [...ing('rice', 'peas'), { name: '  ', measure: '1' }] }, /invalid_ingredients/);
    await refused({ steps: [] }, /invalid_steps/);
    await refused({ steps: ['ok'] }, /invalid_steps/);
    await refused({ steps: ['Buy it at www.shop.example now'] }, /links_not_allowed/);
    await refused({ title: 'See https://spam.example' }, /links_not_allowed/);
    await refused({ image: 'https://evil.example/pic.jpg' }, /invalid_image/);
  });

  test('a photo has to come from the author\'s own folder in our storage', async () => {
    const u = await newUser('Chef');
    const other = await newUser('Other');
    const url = (uid) => `http://127.0.0.1:54321/storage/v1/object/public/recipe-photos/${uid}/a1b2.jpg`;
    await assert.rejects(submit(u, { image: url(other) }), /invalid_image/);
    assert.equal((await recipe(await submit(u, { image: url(u) }))).image_url, url(u));
  });

  test('the terms must be accepted once, and are remembered', async () => {
    const u = await newUser('Chef');
    await assert.rejects(submit(u, { terms: false }), /terms_required/);
    await submit(u, { terms: true });
    await submit(u, { terms: false });
    assert.ok((await db.query('select terms_accepted_at from public.profiles where id = $1', [u])).rows[0].terms_accepted_at);
  });

  test('at most 5 a day, and at most 10 waiting for review', async () => {
    const u = await newUser('Chef');
    for (let i = 0; i < 5; i++) await submit(u);
    await assert.rejects(submit(u), /too_many_recipes/);

    await db.query("update public.recipes set submitted_at = now() - interval '2 days' where author_id = $1", [u]);
    for (let i = 0; i < 5; i++) await submit(u);
    await db.query("update public.recipes set submitted_at = now() - interval '2 days' where author_id = $1", [u]);
    await assert.rejects(submit(u), /too_many_pending/);
  });

  test('authors can delete their own recipes, and only theirs', async () => {
    const a = await newUser('A');
    const b = await newUser('B');
    const id = await submit(a);
    await assert.rejects(rpc(b, 'select public.delete_recipe($1)', [id]), /recipe_not_found/);
    await rpc(a, 'select public.delete_recipe($1)', [id]);
    assert.equal(await recipe(id), undefined);
  });
});

describe('who can see a recipe', () => {
  test('pending recipes are only visible to their author; approved ones to everyone', async () => {
    const a = await newUser('A');
    const b = await newUser('B');
    const id = await submit(a);
    assert.equal((await rpc(a, 'select id from public.recipes where id = $1', [id])).length, 1);
    assert.equal((await rpc(b, 'select id from public.recipes where id = $1', [id])).length, 0);
    await approve(id);
    assert.equal((await rpc(b, 'select id from public.recipes where id = $1', [id])).length, 1);
  });

  test('a country appears in the cuisine list only once a recipe from it is approved', async () => {
    const a = await newUser('A');
    const id = await submit(a, { country: 'Iceland' });
    const has = async () => (await rpc(a, "select 1 from public.cuisine_options where country = 'Iceland'")).length === 1;
    assert.equal(await has(), false);
    await approve(id);
    assert.equal(await has(), true);
  });

  test('people cannot write recipes directly', async () => {
    const a = await newUser('A');
    const id = await submit(a);
    await assert.rejects(rpc(a, "update public.recipes set status = 'approved' where id = $1", [id]), /permission denied/);
    await assert.rejects(rpc(a, "update public.recipes set title = 'Hacked' where id = $1", [id]), /permission denied/);
    await assert.rejects(rpc(a, "insert into public.recipes (author_id, source_id, title, category, country, ingredients, steps, ingredient_names) values (auth.uid(), 'x', 't', 'Beef', 'Kenya', '[]', '[]', '{}')"), /row-level security|permission denied/);
    const r = await recipe(id);
    assert.equal(r.status, 'pending');
    assert.equal(r.title, 'Garlic rice bowl');
  });
});

describe('decks and community recipes', () => {
  test('only approved recipes are in the queue, and the diet filter applies to them', async () => {
    const { owner } = await couple('vegan');
    const author = await newUser('Chef');
    const veganId = await submit(author, { title: 'Vegan bowl', ingredients: ing('rice', 'broccoli', 'garlic') });
    const meatId = await submit(author, { title: 'Beef bowl', ingredients: ing('rice', 'beef mince', 'garlic') });

    let ids = await queue(owner);
    assert.ok(!ids.includes(veganId), 'pending is not shown');

    await approve(veganId);
    await approve(meatId);
    ids = await queue(owner);
    assert.ok(ids.includes(veganId), 'approved and vegan is shown to a vegan couple');
    assert.ok(!ids.includes(meatId), 'approved but meat is not');
  });

  test('exclusions apply to community recipes like any other', async () => {
    const { owner } = await couple('vegan');
    const author = await newUser('Chef');
    const id = await submit(author, { ingredients: ing('rice', 'tofu', 'garlic') });
    await approve(id);
    assert.ok((await queue(owner)).includes(id));
    await db.query("update public.preferences set allergens = '{soy}' where user_id = $1", [owner]);
    assert.ok(!(await queue(owner)).includes(id), 'tofu is soy');
    await db.query("update public.preferences set allergens = '{}', custom_allergens = '{garlic}' where user_id = $1", [owner]);
    assert.ok(!(await queue(owner)).includes(id), 'a free-text exclusion');
  });

  test('blocking an author hides them for the whole couple, and the author is never told', async () => {
    const { owner, partner } = await couple('vegan');
    const author = await newUser('Chef');
    const id = await submit(author);
    await approve(id);
    assert.ok((await queue(owner)).includes(id));

    await rpc(partner, 'select public.block_author($1)', [id]);
    assert.ok(!(await queue(owner)).includes(id), 'the other partner no longer sees it either');
    assert.equal((await db.query('select count(*)::int as n from public.author_blocks where blocked_id = $1', [author])).rows[0].n, 1);
    // Nobody can read blocks directly, the author least of all.
    await assert.rejects(rpc(author, 'select * from public.author_blocks'), /permission denied/);

    await rpc(partner, 'select public.clear_blocks()');
    assert.ok((await queue(owner)).includes(id));
  });

  test('a block can never hide yourself or your partner', async () => {
    const { owner, partner } = await couple('vegan');
    const mine = await submit(owner);
    const theirs = await submit(partner);
    await assert.rejects(rpc(owner, 'select public.block_author($1)', [mine]), /cannot_block_yourself/);
    await assert.rejects(rpc(owner, 'select public.block_author($1)', [theirs]), /cannot_block_partner/);
    // Imported recipes have no author, so there is nobody to block.
    const imported = (await db.query('select id from public.recipes where author_id is null limit 1')).rows[0].id;
    await assert.rejects(rpc(owner, 'select public.block_author($1)', [imported]), /recipe_not_found/);
  });

  test('even a block made by hand against a partner is ignored when queues are built', async () => {
    const { owner, partner } = await couple('vegan');
    const id = await submit(partner);
    await approve(id);
    await db.query('insert into public.author_blocks (blocker_id, blocked_id) values ($1, $2)', [owner, partner]);
    assert.ok((await queue(owner)).includes(id));
  });

  test('a block made before two people pair up is removed when they pair', async () => {
    const a = await newUser('A');
    const b = await newUser('B');
    const id = await submit(b);
    await approve(id);
    await rpc(a, 'select public.block_author($1)', [id]);
    assert.equal((await db.query('select count(*)::int as n from public.author_blocks where blocker_id = $1', [a])).rows[0].n, 1);

    await rpc(b, 'select public.create_couple($1)', ['UTC']);
    const code = (await rpc(b, 'select public.create_invite() as code'))[0].code;
    await rpc(a, 'select public.join_couple($1)', [code]);
    assert.equal((await db.query('select count(*)::int as n from public.author_blocks where blocker_id = $1', [a])).rows[0].n, 0);
  });
});

describe('reporting a recipe', () => {
  test('the reporter\'s couple stops seeing it right away', async () => {
    const { owner, partner } = await couple('vegan');
    const author = await newUser('Chef');
    const id = await submit(author);
    await approve(id);
    await rpc(partner, "select public.report_recipe($1, 'spam', 'ads')", [id]);
    assert.ok(!(await queue(owner)).includes(id));
    assert.equal((await recipe(id)).status, 'approved', 'one report does not unpublish it');
  });

  test('three different reporters send it back to review', async () => {
    const author = await newUser('Chef');
    const id = await submit(author);
    await approve(id);
    const reporters = [await newUser('R'), await newUser('R'), await newUser('R')];
    await rpc(reporters[0], "select public.report_recipe($1, 'offensive')", [id]);
    await rpc(reporters[0], "select public.report_recipe($1, 'offensive')", [id]); // the same person twice counts once
    await rpc(reporters[1], "select public.report_recipe($1, 'copied')", [id]);
    assert.equal((await recipe(id)).status, 'approved');
    await rpc(reporters[2], "select public.report_recipe($1, 'unsafe')", [id]);
    const r = await recipe(id);
    assert.equal(r.status, 'pending');
    assert.match(r.review_note, /reports/);
  });

  test('only community recipes that are published can be reported, and not your own', async () => {
    const author = await newUser('Chef');
    const reporter = await newUser('R');
    const id = await submit(author);
    await assert.rejects(rpc(reporter, "select public.report_recipe($1, 'spam')", [id]), /recipe_not_found/); // pending
    await approve(id);
    await assert.rejects(rpc(author, "select public.report_recipe($1, 'spam')", [id]), /cannot_report_own_recipe/);
    await assert.rejects(rpc(reporter, "select public.report_recipe($1, 'nonsense')", [id]), /check constraint|recipe_reports_reason_check/);
    const imported = (await db.query('select id from public.recipes where author_id is null limit 1')).rows[0].id;
    await assert.rejects(rpc(reporter, "select public.report_recipe($1, 'spam')", [imported]), /recipe_not_found/);
  });
});

describe('hiding takes effect at once', () => {
  async function queueWith(user, recipeId) {
    await queue(user);
    await db.query('update public.daily_decks set recipe_ids = array[$1::uuid] || recipe_ids where true', [recipeId]);
  }
  const firstDish = async (user) => (await rpc(user, 'select public.get_swipe_feed() as f'))[0].f.dishes[0]?.id;

  test('a report or a block removes the dish from a queue that is already built', async () => {
    const { owner, partner } = await couple('vegan');
    const author = await newUser('Chef');
    const reported = await submit(author, { title: 'Report me' });
    const blocked = await submit(author, { title: 'Block me' });
    await approve(reported);
    await approve(blocked);

    await queueWith(owner, reported);
    assert.equal(await firstDish(owner), reported);
    await rpc(partner, "select public.report_recipe($1, 'spam')", [reported]);
    assert.notEqual(await firstDish(owner), reported);

    await queueWith(owner, blocked);
    assert.equal(await firstDish(owner), blocked);
    await rpc(owner, 'select public.block_author($1)', [blocked]);
    assert.notEqual(await firstDish(owner), blocked);
  });

  test('a recipe sent back to review leaves queues straight away', async () => {
    const { owner } = await couple('vegan');
    const author = await newUser('Chef');
    const id = await submit(author);
    await approve(id);
    await queueWith(owner, id);
    assert.equal(await firstDish(owner), id);
    await db.query("update public.recipes set status = 'pending' where id = $1", [id]);
    assert.notEqual(await firstDish(owner), id);
  });

  test('dishes say who wrote them', async () => {
    const { owner, partner } = await couple('vegan');
    const stranger = await newUser('Chef');
    const mine = await submit(owner, { title: 'Mine' });
    const theirs = await submit(partner, { title: 'Theirs' });
    const other = await submit(stranger, { title: 'Other' });
    const imported = (await db.query('select id from public.recipes where author_id is null limit 1')).rows[0].id;
    const who = async (id) => {
      // dish_json is internal; call it with the viewer's identity set, as the feed functions do.
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
      const d = (await db.query('select public.dish_json($1::uuid[]) as d', [[id]])).rows[0].d[0];
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
      return [d.community, d.authored_by];
    };
    assert.deepEqual(await who(mine), [true, 'me']);
    assert.deepEqual(await who(theirs), [true, 'partner']);
    assert.deepEqual(await who(other), [true, null]);
    assert.deepEqual(await who(imported), [false, null]);
  });

  test('Settings can count and clear the authors I hid', async () => {
    const reader = await newUser('Reader');
    const author = await newUser('Chef');
    const id = await submit(author);
    await approve(id);
    assert.equal((await rpc(reader, 'select public.blocked_authors_count() as n'))[0].n, 0);
    await rpc(reader, 'select public.block_author($1)', [id]);
    assert.equal((await rpc(reader, 'select public.blocked_authors_count() as n'))[0].n, 1);
    await rpc(reader, 'select public.clear_blocks()');
    assert.equal((await rpc(reader, 'select public.blocked_authors_count() as n'))[0].n, 0);
  });
});

describe('recipe photos', () => {
  const put = (user, path) =>
    rpc(user, "insert into storage.objects (bucket_id, name) values ('recipe-photos', $1)", [path]);

  test('the bucket is public, small and JPEG only', async () => {
    const [b] = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'recipe-photos'")).rows;
    assert.equal(b.public, true);
    assert.equal(Number(b.file_size_limit), 3 * 1024 * 1024);
    assert.deepEqual(b.allowed_mime_types, ['image/jpeg']);
  });

  test('people can add, list and remove files in their own folder only', async () => {
    const a = await newUser('A');
    const b = await newUser('B');
    await put(a, `${a}/one.jpg`);
    await assert.rejects(put(a, `${b}/two.jpg`), /row-level security/);
    await assert.rejects(put(a, 'loose.jpg'), /row-level security/);

    await put(b, `${b}/three.jpg`);
    assert.deepEqual((await rpc(a, "select name from storage.objects where bucket_id = 'recipe-photos'")).map((r) => r.name), [`${a}/one.jpg`]);

    await rpc(b, "delete from storage.objects where name = $1", [`${a}/one.jpg`]); // someone else's: matches nothing
    assert.equal((await db.query('select 1 from storage.objects where name = $1', [`${a}/one.jpg`])).rowCount, 1);
    await rpc(a, "delete from storage.objects where name = $1", [`${a}/one.jpg`]);
    assert.equal((await db.query('select 1 from storage.objects where name = $1', [`${a}/one.jpg`])).rowCount, 0);
  });

  test('nobody can overwrite a file (there is no update policy)', async () => {
    const a = await newUser('A');
    await put(a, `${a}/x.jpg`);
    await rpc(a, "update storage.objects set name = $2 where name = $1", [`${a}/x.jpg`, `${a}/y.jpg`]);
    assert.equal((await db.query('select 1 from storage.objects where name = $1', [`${a}/x.jpg`])).rowCount, 1);
  });
});

describe('deleting an account', () => {
  test('removes the recipes the person wrote', async () => {
    const a = await newUser('Chef');
    const id = await submit(a);
    await rpc(a, 'select public.delete_account()');
    assert.equal(await recipe(id), undefined);
  });
});
