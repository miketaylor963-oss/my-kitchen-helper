-- =====================================================================
-- Recipe & Meal Planning Database — Full Install Script (v3.1)
-- =====================================================================
--
-- Source of truth for the cookbook, planning, shopping list, and
-- recipe-import app. Target dialect: PostgreSQL (Supabase-compatible).
--
-- This file is the canonical install script. It can be run end-to-end
-- against an empty database, or in sections via the Supabase SQL
-- editor.
--
-- A clean install is now a single paste — Section 14 carries every
-- grant accumulated through F1 and F2 patching. Earlier scripts
-- (v1, v2, v2_post_f1, v3) are superseded.
--
-- ---------------------------------------------------------------------
-- What changed from v3
-- ---------------------------------------------------------------------
--   * Section 12 staple seed expanded from 55 to 227 ingredients and
--     from 4 to 26 aliases, drawn from the breakfast, lunch, and dinner
--     source docs. The warm-up filled out meat, fish, dairy, grains,
--     pasta, noodles, nuts and seeds, produce (leaves, brassicas,
--     fruit, mushrooms), vinegars, sauces, and stocks. Reorganised
--     within the same Section 12 structure — no new sections.
--   * No schema changes.
--   * For databases already on v3, the additive script
--     recipe_db_install_v3_ingredients_warmup.sql carries the same
--     content and is safe to re-run.
--
-- ---------------------------------------------------------------------
-- What changed from v2_post_f1
-- ---------------------------------------------------------------------
--   * INSERT/UPDATE/DELETE grants on `ingredient` and `ingredient_alias`
--     added to the `authenticated` role in Section 14. F2 needs these
--     for the import flow's "create new ingredient" branch and for
--     alias maintenance. Forward-covers component CRUD in F3 (already
--     granted in v2_post_f1).
--   * No schema changes. Only Section 14 expands.
--
-- ---------------------------------------------------------------------
-- What changed from v1
-- ---------------------------------------------------------------------
--   * Method moved from a single TEXT column to first-class meal_step
--     and component_step tables.
--   * Ingredient master table added (ingredient, ingredient_category,
--     ingredient_alias). meal_ingredient / component_ingredient now
--     carry an ingredient_id FK alongside the contextual ingredient_name.
--   * Nutritional tags moved from a boolean (omega3_strong) to a
--     lookup table + join tables, mirroring dietary_restriction.
--   * Macro columns (protein_g, carbs_g, gi_index) added to meal and
--     component.
--   * Dietary restrictions seeded fully (was just 'dairy').
--   * Ingredient and step group labels (free text) for grouping within
--     a recipe.
--   * external_ref slug on meal and component for idempotent re-imports.
--   * Household table + household_id on every writable content/state
--     table (per requirements §6.1). Ingredient master is intentionally
--     NOT household-scoped (shared vocabulary).
--   * app_writer table linking auth.users to households + optional
--     person link (per requirements §6.2).
--   * import_log table tracking each recipe/component import event,
--     with import_id back-references from meal and component.
--   * RLS rewritten: library tables public-read; plan/cooked-log
--     public-read; shopping list writer-only.
--   * pg_trgm extension enabled for fuzzy ingredient matching, with
--     trigram indexes on ingredient.canonical_name and
--     ingredient_alias.alias.
--   * Staple ingredients pre-seeded (now 227 rows after v3.1 warm-up;
--     was ~50 in v2) to reduce first-import friction.
--
-- ---------------------------------------------------------------------
-- Usage
-- ---------------------------------------------------------------------
--   Run this file against an empty Postgres database via the Supabase
--   SQL editor. The editor will accept it as a single script, or you
--   can paste it in sections and verify each before continuing.
--
--   Recommended run order if pasting in pieces:
--     0. Section 0     (clean slate — only if needed; uncomment first)
--     1. Sections 1–2  (extensions + lookups)
--     2. Sections 3–4  (frameworks + ingredients)
--     3. Sections 5–6  (components + meals)
--     4. Section 7     (people + households + writers)
--     5. Section 8     (planning + cooked log)
--     6. Section 9     (shopping list)
--     7. Section 10    (import log)
--     8. Section 11    (indexes)
--     9. Section 12    (seeds — households, persons, staple ingredients)
--    10. Section 13    (Row Level Security)
--    11. Section 14    (Role grants — anon + authenticated)
--
-- ---------------------------------------------------------------------
-- Schema overview
-- ---------------------------------------------------------------------
--   Section 0  — Clean slate (optional, commented out by default)
--   Section 1  — Extensions
--   Section 2  — Lookups (6):   dietary_category, dietary_restriction,
--                               cuisine, meal_type, meal_format,
--                               nutritional_tag
--   Section 3  — Frameworks (3): framework, framework_layer,
--                                component_family
--   Section 4  — Ingredients (3): ingredient_category, ingredient,
--                                 ingredient_alias
--   Section 5  — Components (6): component, component_ingredient,
--                                component_restriction, component_layer,
--                                component_step, component_nutritional_tag
--   Section 6  — Meals (8):      meal, meal_ingredient, meal_restriction,
--                                meal_component, meal_meal_type,
--                                meal_meal_format, meal_step,
--                                meal_nutritional_tag
--   Section 7  — People (3):     household, person, person_restriction,
--                                app_writer
--   Section 8  — Planning (4):   meal_plan, meal_plan_entry,
--                                meal_plan_entry_diner, meal_cooked_log
--   Section 9  — Shopping (2):   shopping_list, shopping_list_item
--   Section 10 — Imports (1):    import_log
--   Section 11 — Indexes
--   Section 12 — Seeds (household, persons, staple ingredients)
--   Section 13 — Row Level Security
--   Section 14 — Role grants (anon + authenticated)
--
-- ---------------------------------------------------------------------
-- Conventions for code generation (any AI tool reading this, please note)
-- ---------------------------------------------------------------------
--   * The database schema is the source of truth. Do NOT create,
--     alter, or drop tables, columns, constraints, or indexes in
--     response to feature prompts. If a feature appears to need a
--     schema change, surface it for discussion rather than acting.
--   * RLS policies and role grants are intentional. Do NOT modify
--     without being asked.
--   * Build features as vertical slices: each feature goes from
--     database read/write to UI before the next one is started.
--   * Prefer real data over mock data.
--   * Keep table and column names exactly as defined here.
-- =====================================================================



-- =====================================================================
-- SECTION 0 — Clean slate (OPTIONAL — uncomment deliberately)
-- =====================================================================
-- Drops and recreates the public schema, removing every table, index,
-- policy, sequence, and function in it. Use when running this install
-- against a database that already has objects from a previous attempt.
--
-- What this DOES affect:
--   * Everything in the public schema (this app's tables and data).
--
-- What this DOES NOT affect:
--   * Supabase Auth (auth.users and the auth schema generally).
--   * Storage buckets, edge functions, other Supabase-managed schemas.
--   * Database roles or extensions installed at the cluster level.
--
-- After running this, any auth users you've created still exist, but
-- their app_writer rows are gone — recreate those after install.
--
-- This block is commented out by default. Uncomment the four
-- statements below ONLY when you intend to wipe the public schema.
-- =====================================================================

-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;



-- =====================================================================
-- SECTION 1 — Extensions
-- =====================================================================

-- Trigram fuzzy matching for ingredient import flow.
CREATE EXTENSION IF NOT EXISTS pg_trgm;



-- =====================================================================
-- SECTION 2 — Lookup tables
-- =====================================================================

-- ---------------------------------------------------------------------
-- dietary_category
-- Ranked hierarchy from most restrictive (vegan) to least (meat).
-- Used at meal, component, person, and ingredient level.
-- ---------------------------------------------------------------------
CREATE TABLE dietary_category (
    id          SERIAL PRIMARY KEY,
    code        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    rank        INTEGER NOT NULL UNIQUE,
    sort_order  INTEGER
);

INSERT INTO dietary_category (code, name, rank, sort_order) VALUES
  ('vegan',       'Vegan',       1, 1),
  ('vegetarian',  'Vegetarian',  2, 2),
  ('pescatarian', 'Pescatarian', 3, 3),
  ('meat',        'Meat',        4, 4);


-- ---------------------------------------------------------------------
-- dietary_restriction
-- Records what a meal/component CONTAINS. Filter "dairy-free" is the
-- negation (no row in *_restriction referencing dairy).
-- ---------------------------------------------------------------------
CREATE TABLE dietary_restriction (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    sort_order  INTEGER
);

INSERT INTO dietary_restriction (code, name, sort_order) VALUES
  ('dairy',     'Dairy',     1),
  ('gluten',    'Gluten',    2),
  ('eggs',      'Eggs',      3),
  ('nuts',      'Nuts',      4),
  ('peanuts',   'Peanuts',   5),
  ('soy',       'Soy',       6),
  ('shellfish', 'Shellfish', 7),
  ('sesame',    'Sesame',    8);


-- ---------------------------------------------------------------------
-- cuisine
-- ---------------------------------------------------------------------
CREATE TABLE cuisine (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    sort_order  INTEGER
);

INSERT INTO cuisine (code, name, sort_order) VALUES
  ('british',        'British',         1),
  ('chinese',        'Chinese',         2),
  ('french',         'French',          3),
  ('indian',         'Indian',          4),
  ('italian',        'Italian',         5),
  ('japanese',       'Japanese',        6),
  ('korean',         'Korean',          7),
  ('mediterranean',  'Mediterranean',   8),
  ('mexican',        'Mexican',         9),
  ('middle_eastern', 'Middle Eastern', 10),
  ('moroccan',       'Moroccan',       11),
  ('persian',        'Persian',        12),
  ('scandinavian',   'Scandinavian',   13),
  ('spanish',        'Spanish',        14),
  ('thai',           'Thai',           15),
  ('vietnamese',     'Vietnamese',     16);


-- ---------------------------------------------------------------------
-- meal_type
-- A single meal may fit multiple types (see meal_meal_type below).
-- ---------------------------------------------------------------------
CREATE TABLE meal_type (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    sort_order  INTEGER
);

INSERT INTO meal_type (code, name, sort_order) VALUES
  ('breakfast', 'Breakfast', 1),
  ('lunch',     'Lunch',     2),
  ('dinner',    'Dinner',    3),
  ('snack',     'Snack',     4),
  ('side',      'Side',      5),
  ('dessert',   'Dessert',   6);


-- ---------------------------------------------------------------------
-- meal_format
-- How a meal is consumed/transported. Many-to-many with meal.
-- ---------------------------------------------------------------------
CREATE TABLE meal_format (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER
);

INSERT INTO meal_format (code, name, description, sort_order) VALUES
  ('no_reheat', 'No reheat', 'Eaten cold or at room temperature',      1),
  ('microwave', 'Microwave', 'Cook ahead, reheat at point of eating',  2),
  ('thermos',   'Thermos',   'Kept hot in an insulated container',     3);


-- ---------------------------------------------------------------------
-- nutritional_tag
-- Qualitative flags ("notable for X") at meal/component level.
-- Numeric values (protein_g, carbs_g, gi_index) live on meal/component
-- directly. The two layers work together.
-- ---------------------------------------------------------------------
CREATE TABLE nutritional_tag (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER
);

INSERT INTO nutritional_tag (code, name, description, sort_order) VALUES
  ('omega3_strong', 'Omega-3 strong', 'Notable source of omega-3 fatty acids', 1);



-- =====================================================================
-- SECTION 3 — Frameworks, layers, and component families
-- =====================================================================

-- ---------------------------------------------------------------------
-- framework
-- A composition pattern: a way of assembling a meal from components.
-- ---------------------------------------------------------------------
CREATE TABLE framework (
    id           SERIAL PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    description  TEXT
);

INSERT INTO framework (code, name, description) VALUES
  ('component_dinner', 'Component-based Dinner',
   'Base + topping/carb + veg + finisher'),
  ('bento',            'Bento Box',
   'Anchor protein + carb + veg/salad + small extras'),
  ('breakfast_bowl',   'Breakfast Bowl',
   'Optional base + protein + veg + extras'),
  ('mason_jar_salad',  'Mason Jar Salad',
   'Dressing (bottom) + hardy veg + grain/protein + leaves (top)'),
  ('smorrebrod',       'Smørrebrød',
   'Bread base + spread + topping + garnish'),
  ('mezze',            'Mezze Plate',
   'Dips + salads/veg + protein + bread + pickles/extras');


-- ---------------------------------------------------------------------
-- framework_layer
-- A named slot within a framework. is_required is advisory.
-- ---------------------------------------------------------------------
CREATE TABLE framework_layer (
    id            SERIAL PRIMARY KEY,
    framework_id  INTEGER NOT NULL REFERENCES framework(id) ON DELETE CASCADE,
    code          TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    sort_order    INTEGER,
    is_required   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (framework_id, code)
);

-- component_dinner layers
INSERT INTO framework_layer (framework_id, code, name, sort_order, is_required)
SELECT id, 'base',     'Base',         1, TRUE  FROM framework WHERE code='component_dinner'
UNION ALL SELECT id, 'topping',  'Topping/Carb', 2, FALSE FROM framework WHERE code='component_dinner'
UNION ALL SELECT id, 'veg',      'Vegetables',   3, FALSE FROM framework WHERE code='component_dinner'
UNION ALL SELECT id, 'finisher', 'Finisher',     4, FALSE FROM framework WHERE code='component_dinner';

-- bento layers
INSERT INTO framework_layer (framework_id, code, name, sort_order, is_required)
SELECT id, 'anchor_protein', 'Anchor Protein', 1, TRUE  FROM framework WHERE code='bento'
UNION ALL SELECT id, 'carb',           'Carb',           2, TRUE  FROM framework WHERE code='bento'
UNION ALL SELECT id, 'veg_salad',      'Veg/Salad',      3, TRUE  FROM framework WHERE code='bento'
UNION ALL SELECT id, 'extras',         'Small Extras',   4, FALSE FROM framework WHERE code='bento';

-- breakfast_bowl layers
INSERT INTO framework_layer (framework_id, code, name, sort_order, is_required)
SELECT id, 'base',    'Base (grain/greens)', 1, FALSE FROM framework WHERE code='breakfast_bowl'
UNION ALL SELECT id, 'protein', 'Protein',             2, TRUE  FROM framework WHERE code='breakfast_bowl'
UNION ALL SELECT id, 'veg',     'Vegetables',          3, TRUE  FROM framework WHERE code='breakfast_bowl'
UNION ALL SELECT id, 'extras',  'Extras/Toppings',     4, FALSE FROM framework WHERE code='breakfast_bowl';

-- mason_jar_salad layers
INSERT INTO framework_layer (framework_id, code, name, sort_order, is_required)
SELECT id, 'dressing',      'Dressing',      1, TRUE FROM framework WHERE code='mason_jar_salad'
UNION ALL SELECT id, 'hardy_veg',     'Hardy Veg',     2, TRUE FROM framework WHERE code='mason_jar_salad'
UNION ALL SELECT id, 'grain_protein', 'Grain/Protein', 3, TRUE FROM framework WHERE code='mason_jar_salad'
UNION ALL SELECT id, 'leaves',        'Leaves',        4, TRUE FROM framework WHERE code='mason_jar_salad';

-- smorrebrod layers
INSERT INTO framework_layer (framework_id, code, name, sort_order, is_required)
SELECT id, 'bread',   'Bread Base', 1, TRUE  FROM framework WHERE code='smorrebrod'
UNION ALL SELECT id, 'spread',  'Spread',     2, FALSE FROM framework WHERE code='smorrebrod'
UNION ALL SELECT id, 'topping', 'Topping',    3, TRUE  FROM framework WHERE code='smorrebrod'
UNION ALL SELECT id, 'garnish', 'Garnish',    4, FALSE FROM framework WHERE code='smorrebrod';

-- mezze layers (all optional — layers organise, they don't enforce)
INSERT INTO framework_layer (framework_id, code, name, sort_order, is_required)
SELECT id, 'dip',       'Dip',            1, FALSE FROM framework WHERE code='mezze'
UNION ALL SELECT id, 'salad_veg', 'Salad/Veg',      2, FALSE FROM framework WHERE code='mezze'
UNION ALL SELECT id, 'protein',   'Protein',        3, FALSE FROM framework WHERE code='mezze'
UNION ALL SELECT id, 'bread',     'Bread',          4, FALSE FROM framework WHERE code='mezze'
UNION ALL SELECT id, 'extras',    'Pickles/Extras', 5, FALSE FROM framework WHERE code='mezze';


-- ---------------------------------------------------------------------
-- component_family
-- Sub-grouping of components within a single framework layer.
-- ---------------------------------------------------------------------
CREATE TABLE component_family (
    id                  SERIAL PRIMARY KEY,
    framework_layer_id  INTEGER NOT NULL REFERENCES framework_layer(id) ON DELETE CASCADE,
    code                TEXT    NOT NULL,
    name                TEXT    NOT NULL,
    sort_order          INTEGER,
    UNIQUE (framework_layer_id, code)
);

-- Component-dinner: topping layer families
INSERT INTO component_family (framework_layer_id, code, name, sort_order)
SELECT fl.id, 'mash',           'Mash family',          1
  FROM framework_layer fl JOIN framework f ON f.id = fl.framework_id
  WHERE f.code='component_dinner' AND fl.code='topping'
UNION ALL
SELECT fl.id, 'sliced_potato',  'Sliced potato family', 2
  FROM framework_layer fl JOIN framework f ON f.id = fl.framework_id
  WHERE f.code='component_dinner' AND fl.code='topping'
UNION ALL
SELECT fl.id, 'grain_seed',     'Grain & seed',         3
  FROM framework_layer fl JOIN framework f ON f.id = fl.framework_id
  WHERE f.code='component_dinner' AND fl.code='topping'
UNION ALL
SELECT fl.id, 'pastry',         'Pastry',               4
  FROM framework_layer fl JOIN framework f ON f.id = fl.framework_id
  WHERE f.code='component_dinner' AND fl.code='topping'
UNION ALL
SELECT fl.id, 'carb_alongside', 'Carb-alongside',       5
  FROM framework_layer fl JOIN framework f ON f.id = fl.framework_id
  WHERE f.code='component_dinner' AND fl.code='topping';



-- =====================================================================
-- SECTION 4 — Ingredients (master vocabulary)
-- =====================================================================
-- Shared across the database (not household-scoped). Categorisation,
-- naming, and aliases are universal. Per-household overrides are an
-- additive change for if/when multi-household lands; not in v1.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ingredient_category
-- Aisle-ordered shopping-list groupings. Flat structure, no hierarchy.
-- sort_order drives the shopping-list rendering order.
-- ---------------------------------------------------------------------
CREATE TABLE ingredient_category (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
);

INSERT INTO ingredient_category (code, name, sort_order) VALUES
  ('produce',       'Fresh produce',         1),
  ('herbs_fresh',   'Fresh herbs',           2),
  ('bakery',        'Bakery',                3),
  ('meat',          'Meat & poultry',        4),
  ('fish',          'Fish & seafood',        5),
  ('chilled',       'Chilled (dairy/alts)',  6),
  ('frozen',        'Frozen',                7),
  ('pantry_canned', 'Tinned & jarred',       8),
  ('pantry_dry',    'Dry goods',             9),
  ('pantry_oils',   'Oils & vinegars',      10),
  ('pantry_sauces', 'Sauces & condiments',  11),
  ('herbs_dried',   'Dried herbs & spices', 12),
  ('drinks',        'Drinks',               13),
  ('household',     'Household',            14);


-- ---------------------------------------------------------------------
-- ingredient
-- Canonical ingredient vocabulary. Recipe-contextual prep notes
-- ('red onion, finely diced') stay on meal_ingredient.ingredient_name;
-- ingredient.canonical_name is the clean master form ('red onion').
--
-- dietary_category_id powers the importer's consistency check (warn if
-- a meal's declared category is inconsistent with ingredients used).
-- Nothing propagates — meal-level tags are set explicitly.
-- ---------------------------------------------------------------------
CREATE TABLE ingredient (
    id                  SERIAL PRIMARY KEY,
    canonical_name      TEXT        NOT NULL UNIQUE,
    default_unit        TEXT,
    category_id         INTEGER     REFERENCES ingredient_category(id),
    dietary_category_id INTEGER     REFERENCES dietary_category(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- ingredient_alias
-- Alternative names that map to the same canonical ingredient.
-- alias is globally unique — same string can't point to two ingredients.
-- ---------------------------------------------------------------------
CREATE TABLE ingredient_alias (
    id            SERIAL PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
    alias         TEXT    NOT NULL UNIQUE
);



-- =====================================================================
-- SECTION 5 — Components
-- =====================================================================

-- ---------------------------------------------------------------------
-- component
-- A reusable building block. status='idea' has name+description only;
-- status='detailed' has ingredients, steps, and classification.
-- ---------------------------------------------------------------------
CREATE TABLE component (
    id                   SERIAL PRIMARY KEY,
    household_id         INTEGER     NOT NULL DEFAULT 1,
    external_ref         TEXT        UNIQUE,
    name                 TEXT        NOT NULL,
    status               TEXT        NOT NULL CHECK (status IN ('idea','detailed')),
    description          TEXT,
    cuisine_id           INTEGER     REFERENCES cuisine(id),
    dietary_category_id  INTEGER     REFERENCES dietary_category(id),
    prep_time_minutes    INTEGER,
    cook_time_minutes    INTEGER,
    serves               INTEGER,
    protein_g            REAL,
    carbs_g              REAL,
    gi_index             INTEGER,
    notes                TEXT,
    source               TEXT,
    import_id            INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- component_ingredient
-- ingredient_id is nullable for graceful migration / unmatched imports;
-- importer is expected to resolve it.
-- group_name is free-text ('mash', 'filling', etc.) for recipe-local
-- grouping in the UI.
-- ---------------------------------------------------------------------
CREATE TABLE component_ingredient (
    id               SERIAL PRIMARY KEY,
    component_id     INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    ingredient_id    INTEGER REFERENCES ingredient(id),
    ingredient_name  TEXT    NOT NULL,
    quantity         REAL,
    unit             TEXT,
    group_name       TEXT,
    notes            TEXT,
    sort_order       INTEGER
);


-- ---------------------------------------------------------------------
-- component_step
-- Method as discrete steps. content may contain {NNNN} placeholders
-- referencing component_ingredient.id (resolved at render time).
-- ---------------------------------------------------------------------
CREATE TABLE component_step (
    id             SERIAL PRIMARY KEY,
    component_id   INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    sort_order     INTEGER NOT NULL,
    title          TEXT,
    content        TEXT    NOT NULL,
    timer_seconds  INTEGER,
    group_name     TEXT
);


-- ---------------------------------------------------------------------
-- component_restriction
-- ---------------------------------------------------------------------
CREATE TABLE component_restriction (
    component_id    INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    restriction_id  INTEGER NOT NULL REFERENCES dietary_restriction(id),
    PRIMARY KEY (component_id, restriction_id)
);


-- ---------------------------------------------------------------------
-- component_nutritional_tag
-- ---------------------------------------------------------------------
CREATE TABLE component_nutritional_tag (
    component_id       INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    nutritional_tag_id INTEGER NOT NULL REFERENCES nutritional_tag(id),
    PRIMARY KEY (component_id, nutritional_tag_id)
);


-- ---------------------------------------------------------------------
-- component_layer
-- Registers a component against one or more framework layers.
-- component_family_id, when set, must belong to the same
-- framework_layer (validated in application code).
-- ---------------------------------------------------------------------
CREATE TABLE component_layer (
    component_id         INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    framework_layer_id   INTEGER NOT NULL REFERENCES framework_layer(id),
    component_family_id  INTEGER          REFERENCES component_family(id),
    PRIMARY KEY (component_id, framework_layer_id)
);



-- =====================================================================
-- SECTION 6 — Meals
-- =====================================================================

-- ---------------------------------------------------------------------
-- meal
-- Three statuses:
--   * 'idea'        — name + description only
--   * 'recipe'      — fully self-contained; ingredients + steps
--   * 'composition' — framework + components; ingredients/steps derived
--                     via meal_component -> component
-- ---------------------------------------------------------------------
CREATE TABLE meal (
    id                   SERIAL PRIMARY KEY,
    household_id         INTEGER     NOT NULL DEFAULT 1,
    external_ref         TEXT        UNIQUE,
    name                 TEXT        NOT NULL,
    status               TEXT        NOT NULL CHECK (status IN ('idea','recipe','composition')),
    description          TEXT,
    framework_id         INTEGER     REFERENCES framework(id),
    cuisine_id           INTEGER     REFERENCES cuisine(id),
    dietary_category_id  INTEGER     REFERENCES dietary_category(id),
    prep_time_minutes    INTEGER,
    cook_time_minutes    INTEGER,
    serves               INTEGER,
    protein_g            REAL,
    carbs_g              REAL,
    gi_index             INTEGER,
    notes                TEXT,
    source               TEXT,
    import_id            INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- meal_ingredient
-- Populated for status='recipe' meals. Composition meals derive
-- ingredients from their components at query time.
-- ---------------------------------------------------------------------
CREATE TABLE meal_ingredient (
    id               SERIAL PRIMARY KEY,
    meal_id          INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    ingredient_id    INTEGER REFERENCES ingredient(id),
    ingredient_name  TEXT    NOT NULL,
    quantity         REAL,
    unit             TEXT,
    group_name       TEXT,
    notes            TEXT,
    sort_order       INTEGER
);


-- ---------------------------------------------------------------------
-- meal_step
-- Method as discrete steps. content may contain {NNNN} placeholders
-- referencing meal_ingredient.id (resolved at render time).
-- ---------------------------------------------------------------------
CREATE TABLE meal_step (
    id             SERIAL PRIMARY KEY,
    meal_id        INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    sort_order     INTEGER NOT NULL,
    title          TEXT,
    content        TEXT    NOT NULL,
    timer_seconds  INTEGER,
    group_name     TEXT
);


-- ---------------------------------------------------------------------
-- meal_restriction
-- For composition meals, UI may pre-fill from the union of component
-- restrictions; the operator can override.
-- ---------------------------------------------------------------------
CREATE TABLE meal_restriction (
    meal_id         INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    restriction_id  INTEGER NOT NULL REFERENCES dietary_restriction(id),
    PRIMARY KEY (meal_id, restriction_id)
);


-- ---------------------------------------------------------------------
-- meal_nutritional_tag
-- ---------------------------------------------------------------------
CREATE TABLE meal_nutritional_tag (
    meal_id            INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    nutritional_tag_id INTEGER NOT NULL REFERENCES nutritional_tag(id),
    PRIMARY KEY (meal_id, nutritional_tag_id)
);


-- ---------------------------------------------------------------------
-- meal_component
-- Links a composition meal to its components.
-- ---------------------------------------------------------------------
CREATE TABLE meal_component (
    id                  SERIAL PRIMARY KEY,
    meal_id             INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    component_id        INTEGER NOT NULL REFERENCES component(id),
    framework_layer_id  INTEGER NOT NULL REFERENCES framework_layer(id),
    sort_order          INTEGER,
    notes               TEXT
);


-- ---------------------------------------------------------------------
-- meal_meal_type
-- ---------------------------------------------------------------------
CREATE TABLE meal_meal_type (
    meal_id       INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    meal_type_id  INTEGER NOT NULL REFERENCES meal_type(id),
    PRIMARY KEY (meal_id, meal_type_id)
);


-- ---------------------------------------------------------------------
-- meal_meal_format
-- ---------------------------------------------------------------------
CREATE TABLE meal_meal_format (
    meal_id         INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    meal_format_id  INTEGER NOT NULL REFERENCES meal_format(id),
    PRIMARY KEY (meal_id, meal_format_id)
);



-- =====================================================================
-- SECTION 7 — People, households, and writers
-- =====================================================================

-- ---------------------------------------------------------------------
-- household
-- v1 has one household (seeded as id=1). Multi-household is a future
-- concern; the column is in place across writable tables now to avoid
-- a 26-table migration later.
-- ---------------------------------------------------------------------
CREATE TABLE household (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- person
-- A diner (anyone who eats meals), not an auth user. app_writer links
-- the two where they overlap.
-- ---------------------------------------------------------------------
CREATE TABLE person (
    id                   SERIAL PRIMARY KEY,
    household_id         INTEGER     NOT NULL DEFAULT 1 REFERENCES household(id),
    name                 TEXT        NOT NULL,
    dietary_category_id  INTEGER     REFERENCES dietary_category(id),
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- person_restriction
-- ---------------------------------------------------------------------
CREATE TABLE person_restriction (
    person_id       INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    restriction_id  INTEGER NOT NULL REFERENCES dietary_restriction(id),
    PRIMARY KEY (person_id, restriction_id)
);


-- ---------------------------------------------------------------------
-- app_writer
-- Links a Supabase auth user to a household and optionally to a person
-- (so 'cooked by' defaults can use the auth user's matching person id).
-- Seeded with nothing — populated manually after creating auth users.
-- ---------------------------------------------------------------------
CREATE TABLE app_writer (
    user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id INTEGER     NOT NULL DEFAULT 1 REFERENCES household(id),
    person_id    INTEGER     REFERENCES person(id),
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- =====================================================================
-- SECTION 8 — Meal planning & cooked log
-- =====================================================================

CREATE TABLE meal_plan (
    id            SERIAL PRIMARY KEY,
    household_id  INTEGER     NOT NULL DEFAULT 1 REFERENCES household(id),
    name          TEXT        NOT NULL,
    start_date    DATE        NOT NULL,
    end_date      DATE        NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- meal_plan_entry
-- meal_id is nullable on purpose — you can plan a slot before picking a
-- meal. Multiple entries per (entry_date, meal_type_id) allowed so Mike
-- and Jane can have different meals in the same slot.
-- ---------------------------------------------------------------------
CREATE TABLE meal_plan_entry (
    id            SERIAL PRIMARY KEY,
    meal_plan_id  INTEGER NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
    entry_date    DATE    NOT NULL,
    meal_type_id  INTEGER NOT NULL REFERENCES meal_type(id),
    meal_id       INTEGER          REFERENCES meal(id) ON DELETE SET NULL,
    serves        INTEGER,
    notes         TEXT,
    sort_order    INTEGER
);


CREATE TABLE meal_plan_entry_diner (
    entry_id   INTEGER NOT NULL REFERENCES meal_plan_entry(id) ON DELETE CASCADE,
    person_id  INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, person_id)
);


CREATE TABLE meal_cooked_log (
    id                  SERIAL PRIMARY KEY,
    household_id        INTEGER     NOT NULL DEFAULT 1 REFERENCES household(id),
    meal_id             INTEGER     NOT NULL REFERENCES meal(id),
    meal_plan_entry_id  INTEGER              REFERENCES meal_plan_entry(id) ON DELETE SET NULL,
    cooked_date         DATE        NOT NULL,
    cooked_by           INTEGER              REFERENCES person(id),
    rating              INTEGER              CHECK (rating BETWEEN 1 AND 5),
    actual_serves       INTEGER,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- =====================================================================
-- SECTION 9 — Shopping list
-- =====================================================================

CREATE TABLE shopping_list (
    id            SERIAL PRIMARY KEY,
    household_id  INTEGER     NOT NULL DEFAULT 1 REFERENCES household(id),
    meal_plan_id  INTEGER     REFERENCES meal_plan(id) ON DELETE SET NULL,
    name          TEXT        NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes         TEXT
);


-- ---------------------------------------------------------------------
-- shopping_list_item
-- source='derived' items are recreated on regeneration; source='manual'
-- items survive regeneration.
-- ingredient_id is nullable to support manual items that haven't been
-- (or shouldn't be) matched against the master list — washing-up
-- liquid, etc.
-- ---------------------------------------------------------------------
CREATE TABLE shopping_list_item (
    id                SERIAL PRIMARY KEY,
    shopping_list_id  INTEGER NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
    ingredient_id     INTEGER REFERENCES ingredient(id),
    ingredient_name   TEXT    NOT NULL,
    quantity          REAL,
    unit              TEXT,
    source            TEXT    NOT NULL CHECK (source IN ('derived','manual')),
    is_checked        BOOLEAN NOT NULL DEFAULT FALSE,
    is_in_stock       BOOLEAN NOT NULL DEFAULT FALSE,
    notes             TEXT,
    sort_order        INTEGER
);



-- =====================================================================
-- SECTION 10 — Import log
-- =====================================================================
-- One row per import event (JSON file ingested). Supports re-import
-- (update-in-place), audit trail, and re-processing if importer logic
-- evolves.
-- =====================================================================

CREATE TABLE import_log (
    id                  SERIAL PRIMARY KEY,
    household_id        INTEGER     NOT NULL DEFAULT 1 REFERENCES household(id),
    external_ref        TEXT        NOT NULL,
    raw_json            JSONB       NOT NULL,
    status              TEXT        NOT NULL CHECK (status IN ('success','partial','failed')),
    error_message       TEXT,
    notes               TEXT,
    imported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imported_by_user_id UUID        REFERENCES auth.users(id)
);

-- Late-binding the FKs from meal/component to import_log — declared
-- here rather than in section 5/6 because import_log is defined later.
ALTER TABLE meal
    ADD CONSTRAINT meal_import_id_fkey
    FOREIGN KEY (import_id) REFERENCES import_log(id) ON DELETE SET NULL;

ALTER TABLE component
    ADD CONSTRAINT component_import_id_fkey
    FOREIGN KEY (import_id) REFERENCES import_log(id) ON DELETE SET NULL;

-- Late-binding household_id FKs on meal and component (deferred to keep
-- earlier sections runnable in isolation if pasted piecewise).
ALTER TABLE meal
    ADD CONSTRAINT meal_household_id_fkey
    FOREIGN KEY (household_id) REFERENCES household(id);

ALTER TABLE component
    ADD CONSTRAINT component_household_id_fkey
    FOREIGN KEY (household_id) REFERENCES household(id);



-- =====================================================================
-- SECTION 11 — Indexes
-- =====================================================================

-- Standard FK and date indexes
CREATE INDEX idx_component_ingredient_component   ON component_ingredient(component_id);
CREATE INDEX idx_component_ingredient_ingredient  ON component_ingredient(ingredient_id);
CREATE INDEX idx_component_restriction_component  ON component_restriction(component_id);
CREATE INDEX idx_component_layer_component        ON component_layer(component_id);
CREATE INDEX idx_component_layer_layer            ON component_layer(framework_layer_id);
CREATE INDEX idx_component_step_component         ON component_step(component_id);
CREATE INDEX idx_component_nut_tag_component      ON component_nutritional_tag(component_id);

CREATE INDEX idx_meal_ingredient_meal             ON meal_ingredient(meal_id);
CREATE INDEX idx_meal_ingredient_ingredient       ON meal_ingredient(ingredient_id);
CREATE INDEX idx_meal_restriction_meal            ON meal_restriction(meal_id);
CREATE INDEX idx_meal_component_meal              ON meal_component(meal_id);
CREATE INDEX idx_meal_component_component         ON meal_component(component_id);
CREATE INDEX idx_meal_step_meal                   ON meal_step(meal_id);
CREATE INDEX idx_meal_nut_tag_meal                ON meal_nutritional_tag(meal_id);

CREATE INDEX idx_meal_plan_entry_plan             ON meal_plan_entry(meal_plan_id);
CREATE INDEX idx_meal_plan_entry_date             ON meal_plan_entry(entry_date);
CREATE INDEX idx_meal_plan_entry_diner_entry      ON meal_plan_entry_diner(entry_id);

CREATE INDEX idx_meal_cooked_log_meal             ON meal_cooked_log(meal_id);
CREATE INDEX idx_meal_cooked_log_date             ON meal_cooked_log(cooked_date);

CREATE INDEX idx_shopping_list_item_list          ON shopping_list_item(shopping_list_id);
CREATE INDEX idx_shopping_list_item_ingredient    ON shopping_list_item(ingredient_id);

CREATE INDEX idx_ingredient_category              ON ingredient(category_id);
CREATE INDEX idx_ingredient_alias_ingredient      ON ingredient_alias(ingredient_id);

CREATE INDEX idx_import_log_external_ref          ON import_log(external_ref);
CREATE INDEX idx_import_log_imported_at           ON import_log(imported_at);
CREATE INDEX idx_meal_import                      ON meal(import_id);
CREATE INDEX idx_component_import                 ON component(import_id);

-- Household scoping indexes (cheap insurance for future multi-household)
CREATE INDEX idx_meal_household                   ON meal(household_id);
CREATE INDEX idx_component_household              ON component(household_id);
CREATE INDEX idx_meal_plan_household              ON meal_plan(household_id);
CREATE INDEX idx_meal_cooked_log_household        ON meal_cooked_log(household_id);
CREATE INDEX idx_shopping_list_household          ON shopping_list(household_id);

-- Trigram indexes for fuzzy ingredient matching at import time
CREATE INDEX idx_ingredient_canonical_name_trgm
    ON ingredient USING gin (canonical_name gin_trgm_ops);

CREATE INDEX idx_ingredient_alias_trgm
    ON ingredient_alias USING gin (alias gin_trgm_ops);

-- match_ingredient: per-ingredient fuzzy lookup for the recipe importer.
-- FUZZY_THRESHOLD = 0.3 hardcoded in this slice; 2B.3 may lift to a
-- configurable setting once real fixture runs have informed the value.
  CREATE OR REPLACE FUNCTION match_ingredient(query_name text)
  RETURNS TABLE (
    ingredient_id        integer,
    canonical_name       text,
    match_type           text,
    matched_text         text,
    similarity_score     real,
    category_id          integer,
    dietary_category_id  integer
  )
  LANGUAGE sql STABLE AS $$
    -- Exact canonical
    SELECT
      i.id                    AS ingredient_id,
      i.canonical_name        AS canonical_name,
      'exact_canonical'::text AS match_type,
      i.canonical_name        AS matched_text,
      1.0::real               AS similarity_score,
      i.category_id           AS category_id,
      i.dietary_category_id   AS dietary_category_id
    FROM ingredient i
    WHERE lower(i.canonical_name) = lower(trim(query_name))

    UNION ALL

    -- Exact alias
    SELECT
      i.id                    AS ingredient_id,
      i.canonical_name        AS canonical_name,
      'exact_alias'::text     AS match_type,
      ia.alias                AS matched_text,
      1.0::real               AS similarity_score,
      i.category_id           AS category_id,
      i.dietary_category_id   AS dietary_category_id
    FROM ingredient_alias ia
    JOIN ingredient i ON i.id = ia.ingredient_id
    WHERE lower(ia.alias) = lower(trim(query_name))

    UNION ALL

    -- Fuzzy canonical: top 5, threshold 0.3, excludes exact canonical match
    SELECT
      sub.ingredient_id,
      sub.canonical_name,
      sub.match_type,
      sub.matched_text,
      sub.similarity_score,
      sub.category_id,
      sub.dietary_category_id
    FROM (
      SELECT
        i.id                        AS ingredient_id,
        i.canonical_name            AS canonical_name,
        'fuzzy_canonical'::text     AS match_type,
        i.canonical_name            AS matched_text,
        similarity(lower(i.canonical_name), lower(trim(query_name)))::real AS similarity_score,
        i.category_id               AS category_id,
        i.dietary_category_id       AS dietary_category_id
      FROM ingredient i
      WHERE lower(i.canonical_name) <> lower(trim(query_name))
        AND similarity(lower(i.canonical_name), lower(trim(query_name))) >= 0.3
      ORDER BY similarity_score DESC
      LIMIT 5
    ) sub

    UNION ALL

    -- Fuzzy alias: top 5, threshold 0.3, excludes exact alias match
    SELECT
      sub.ingredient_id,
      sub.canonical_name,
      sub.match_type,
      sub.matched_text,
      sub.similarity_score,
      sub.category_id,
      sub.dietary_category_id
    FROM (
      SELECT
        i.id                    AS ingredient_id,
        i.canonical_name        AS canonical_name,
        'fuzzy_alias'::text     AS match_type,
        ia.alias                AS matched_text,
        similarity(lower(ia.alias), lower(trim(query_name)))::real AS similarity_score,
        i.category_id           AS category_id,
        i.dietary_category_id   AS dietary_category_id
      FROM ingredient_alias ia
      JOIN ingredient i ON i.id = ia.ingredient_id
      WHERE lower(ia.alias) <> lower(trim(query_name))
        AND similarity(lower(ia.alias), lower(trim(query_name))) >= 0.3
      ORDER BY similarity_score DESC
      LIMIT 5
    ) sub
  $$;

-- commit_import
-- Single-transaction recipe import. Writes import_log, meal,
-- ingredient (create_new choices), meal_ingredient, meal_step,
-- meal_restriction, meal_nutritional_tag, meal_meal_type, meal_meal_format.
-- Returns new meal.id.
-- SECURITY INVOKER — runs as caller; RLS on each table is the access gate.
CREATE OR REPLACE FUNCTION commit_import(
  payload            JSONB,
  ingredient_choices JSONB,
  on_conflict        TEXT DEFAULT 'fail'
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_import_id  INTEGER;
  new_meal_id    INTEGER;
  new_ing_id     INTEGER;
  cuisine_id_val INTEGER;
  dc_id_val      INTEGER;
  ing_el         JSONB;
  step_el        JSONB;
  choice         JSONB;
  ing_id_val     INTEGER;
  sort_idx       INTEGER;
  rec            RECORD;
  id_map            JSONB := '{}'::JSONB;
  new_mi_id         INTEGER;
  rewritten_content TEXT;
  map_key           TEXT;
  map_val           TEXT;
BEGIN
  -- 1. import_log
  INSERT INTO import_log (external_ref, raw_json, status, imported_by_user_id)
  VALUES (payload->>'external_ref', payload, 'success', auth.uid())
  RETURNING id INTO new_import_id;

  -- 2. Resolve cuisine_id
  cuisine_id_val := NULL;
  IF (payload->>'cuisine') IS NOT NULL AND (payload->>'cuisine') <> '' THEN
    SELECT id INTO cuisine_id_val FROM cuisine WHERE code = payload->>'cuisine';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown cuisine code: %', payload->>'cuisine';
    END IF;
  END IF;

  -- 3. Resolve dietary_category_id
  dc_id_val := NULL;
  IF (payload->>'dietary_category') IS NOT NULL AND (payload->>'dietary_category') <> '' THEN
    SELECT id INTO dc_id_val FROM dietary_category WHERE code = payload->>'dietary_category';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown dietary_category code: %', payload->>'dietary_category';
    END IF;
  END IF;

  -- 4. Insert or update meal (on_conflict = 'fail' | 'update')
  IF on_conflict = 'fail' THEN
    INSERT INTO meal (
      external_ref, name, status, description,
      cuisine_id, dietary_category_id,
      prep_time_minutes, cook_time_minutes, serves,
      protein_g, carbs_g, gi_index,
      notes, source, import_id
    ) VALUES (
      payload->>'external_ref',
      payload->>'name',
      'recipe',
      NULLIF(payload->>'description', ''),
      cuisine_id_val,
      dc_id_val,
      (payload->>'prep_time_minutes')::INTEGER,
      (payload->>'cook_time_minutes')::INTEGER,
      (payload->>'base_servings')::INTEGER,
      (payload->>'protein_g')::REAL,
      (payload->>'carbs_g')::REAL,
      (payload->>'gi_index')::INTEGER,
      NULLIF(payload->>'notes', ''),
      NULLIF(payload->>'source', ''),
      new_import_id
    )
    RETURNING id INTO new_meal_id;
  ELSIF on_conflict = 'update' THEN
    SELECT id INTO new_meal_id FROM meal WHERE external_ref = payload->>'external_ref';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'on_conflict=update: no existing meal for external_ref "%"', payload->>'external_ref';
    END IF;
    UPDATE meal SET
      name                = payload->>'name',
      status              = 'recipe',
      description         = NULLIF(payload->>'description', ''),
      cuisine_id          = cuisine_id_val,
      dietary_category_id = dc_id_val,
      prep_time_minutes   = (payload->>'prep_time_minutes')::INTEGER,
      cook_time_minutes   = (payload->>'cook_time_minutes')::INTEGER,
      serves              = (payload->>'base_servings')::INTEGER,
      protein_g           = (payload->>'protein_g')::REAL,
      carbs_g             = (payload->>'carbs_g')::REAL,
      gi_index            = (payload->>'gi_index')::INTEGER,
      notes               = NULLIF(payload->>'notes', ''),
      source              = NULLIF(payload->>'source', ''),
      import_id           = new_import_id
    WHERE id = new_meal_id;
    DELETE FROM meal_ingredient      WHERE meal_id = new_meal_id;
    DELETE FROM meal_step            WHERE meal_id = new_meal_id;
    DELETE FROM meal_restriction     WHERE meal_id = new_meal_id;
    DELETE FROM meal_nutritional_tag WHERE meal_id = new_meal_id;
    DELETE FROM meal_meal_type       WHERE meal_id = new_meal_id;
    DELETE FROM meal_meal_format     WHERE meal_id = new_meal_id;
  ELSE
    RAISE EXCEPTION 'Unknown on_conflict value: %', on_conflict;
  END IF;

  -- 5. Ingredients (preserves JSON array order as sort_order)
  sort_idx := 0;
  FOR ing_el IN SELECT value FROM jsonb_array_elements(payload->'ingredients') AS t(value)
  LOOP
    choice := ingredient_choices->(ing_el->>'id');
    IF choice IS NULL THEN
      RAISE EXCEPTION 'Missing ingredient choice for id: %', ing_el->>'id';
    END IF;

    IF choice->>'action' = 'create_new' THEN
      INSERT INTO ingredient (canonical_name, default_unit, category_id, dietary_category_id)
      VALUES (
        choice->>'canonical_name',
        NULLIF(choice->>'default_unit', ''),
        (choice->>'category_id')::INTEGER,
        (choice->>'dietary_category_id')::INTEGER
      )
      RETURNING id INTO new_ing_id;
      ing_id_val := new_ing_id;
    ELSIF choice->>'action' IN ('accept', 'override') THEN
      ing_id_val := (choice->>'ingredient_id')::INTEGER;
    ELSE
      RAISE EXCEPTION 'Unknown ingredient choice action: % for id: %',
        choice->>'action', ing_el->>'id';
    END IF;

    INSERT INTO meal_ingredient (
      meal_id, ingredient_id, ingredient_name,
      quantity, unit, group_name, notes, sort_order
    ) VALUES (
      new_meal_id,
      ing_id_val,
      ing_el->>'name',
      (ing_el->>'amount')::REAL,
      NULLIF(ing_el->>'unit', ''),
      NULLIF(ing_el->>'group', ''),
      NULLIF(ing_el->>'notes', ''),
      sort_idx
    )
    RETURNING id INTO new_mi_id;
    id_map := id_map || jsonb_build_object(ing_el->>'id', new_mi_id);
    sort_idx := sort_idx + 1;
  END LOOP;

  -- 6. Steps
  sort_idx := 0;
  FOR step_el IN SELECT value FROM jsonb_array_elements(payload->'steps') AS t(value)
  LOOP
    rewritten_content := step_el->>'content';
    FOR map_key, map_val IN SELECT key, value::TEXT FROM jsonb_each_text(id_map) LOOP
      rewritten_content := replace(rewritten_content, '{' || map_key || '}', '{' || map_val || '}');
    END LOOP;
    INSERT INTO meal_step (meal_id, sort_order, title, content, timer_seconds, group_name)
    VALUES (
      new_meal_id,
      sort_idx,
      NULLIF(step_el->>'title', ''),
      rewritten_content,
      (step_el->>'timer_seconds')::INTEGER,
      NULLIF(step_el->>'group', '')
    );
    sort_idx := sort_idx + 1;
  END LOOP;

  -- 7. Dietary restrictions
  FOR rec IN
    SELECT dr.id FROM dietary_restriction dr
    WHERE dr.code IN (
      SELECT jsonb_array_elements_text(COALESCE(payload->'dietary_restrictions', '[]'::JSONB))
    )
  LOOP
    INSERT INTO meal_restriction (meal_id, restriction_id)
    VALUES (new_meal_id, rec.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 8. Nutritional tags
  FOR rec IN
    SELECT nt.id FROM nutritional_tag nt
    WHERE nt.code IN (
      SELECT jsonb_array_elements_text(COALESCE(payload->'nutritional_tags', '[]'::JSONB))
    )
  LOOP
    INSERT INTO meal_nutritional_tag (meal_id, nutritional_tag_id)
    VALUES (new_meal_id, rec.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 9. Meal types
  FOR rec IN
    SELECT mt.id FROM meal_type mt
    WHERE mt.code IN (
      SELECT jsonb_array_elements_text(COALESCE(payload->'meal_types', '[]'::JSONB))
    )
  LOOP
    INSERT INTO meal_meal_type (meal_id, meal_type_id)
    VALUES (new_meal_id, rec.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 10. Meal formats
  FOR rec IN
    SELECT mf.id FROM meal_format mf
    WHERE mf.code IN (
      SELECT jsonb_array_elements_text(COALESCE(payload->'meal_formats', '[]'::JSONB))
    )
  LOOP
    INSERT INTO meal_meal_format (meal_id, meal_format_id)
    VALUES (new_meal_id, rec.id) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN new_meal_id;
END;
$$;

-- =====================================================================
-- SECTION 11a — Triggers
-- =====================================================================

-- One trigger function, reused by all four tables
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to each of the four tables
CREATE TRIGGER trg_ingredient_updated_at
  BEFORE UPDATE ON ingredient
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_component_updated_at
  BEFORE UPDATE ON component
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_meal_updated_at
  BEFORE UPDATE ON meal
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_meal_plan_updated_at
  BEFORE UPDATE ON meal_plan
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- SECTION 12 — Seeds
-- =====================================================================

-- ---------------------------------------------------------------------
-- Household
-- ---------------------------------------------------------------------
INSERT INTO household (id, name, notes)
VALUES (1, 'Default', 'v1 single household.')
ON CONFLICT DO NOTHING;

-- Reset the sequence so the next household added gets id=2.
SELECT setval('household_id_seq', GREATEST((SELECT MAX(id) FROM household), 1));


-- ---------------------------------------------------------------------
-- Persons
-- ---------------------------------------------------------------------
INSERT INTO person (household_id, name, dietary_category_id, notes)
VALUES
    (1, 'Mike',
     (SELECT id FROM dietary_category WHERE code='meat'),
     'Household member. Omnivore.'),
    (1, 'Jane',
     (SELECT id FROM dietary_category WHERE code='pescatarian'),
     'Household member. Pescatarian.')
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
-- Staple ingredients
-- High-frequency basics drawn from the source docs. Not exhaustive —
-- the long tail is filled in by the importer's human-in-the-loop flow.
-- Each row gets category and dietary category so the importer can match
-- usefully from day one.
-- ---------------------------------------------------------------------
INSERT INTO ingredient (canonical_name, default_unit, category_id, dietary_category_id, notes) VALUES
  -- Oils & vinegars
  ('olive oil',                   'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('extra virgin olive oil',      'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rapeseed oil',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sesame oil',                  'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('coconut oil',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('ghee',                        'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('avocado oil',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rice vinegar',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('white wine vinegar',          'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('red wine vinegar',            'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('balsamic vinegar',            'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cider vinegar',               'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Seasonings & dried herbs/spices
  ('fine salt',                   'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flaky sea salt',              'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('black pepper',                'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('ground cumin',                'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cumin seeds',                 'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('ground coriander',            'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('smoked paprika',              'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('chilli flakes',               'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('dried thyme',                 'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('dried rosemary',              'tsp',  (SELECT id FROM ingredient_category WHERE code='herbs_dried'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Fresh herbs
  ('fresh coriander',             'tbsp', (SELECT id FROM ingredient_category WHERE code='herbs_fresh'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fresh parsley',               'tbsp', (SELECT id FROM ingredient_category WHERE code='herbs_fresh'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fresh mint',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='herbs_fresh'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fresh dill',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='herbs_fresh'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — alliums & roots
  ('onion',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('red onion',                   NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('shallot',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('spring onion',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'bunch'),
  ('leek',                        NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('garlic clove',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fresh ginger',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('carrot',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('celery stalk',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('floury potatoes',             'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('waxy potatoes',               'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'new potatoes, salad potatoes'),
  ('sweet potato',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('beetroot',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fennel',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'bulb'),
  ('daikon',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — peppers, squash, courgette
  ('red pepper',                  NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('yellow pepper',               NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('green pepper',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('courgette',                   NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('aubergine',                   NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('butternut squash',            NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — brassicas & leaves
  ('broccoli',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'head'),
  ('tenderstem broccoli',         'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cauliflower',                 NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'head'),
  ('kale',                        'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('spinach',                     'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('chard',                       'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('watercress',                  'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rocket',                      'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('lettuce',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'head'),
  ('pak choi',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — beans & peas (fresh)
  ('green beans',                 'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sugar snap peas',             'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('edamame',                     'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — tomatoes, cucumber, avocado
  ('tomatoes',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cherry tomatoes',             'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cucumber',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('avocado',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — mushrooms
  ('chestnut mushrooms',          'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('portobello mushrooms',        'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('oyster mushrooms',            'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('shiitake mushrooms',          'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — citrus
  ('lemon',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('lime',                        NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — fruit
  ('apple',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('banana',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('strawberries',                'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('raspberries',                 'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('blueberries',                 'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('plums',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('peach',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pomegranate',                 NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('grapes',                      'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('satsuma',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rhubarb',                     'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Frozen
  ('frozen peas',                 'g',    (SELECT id FROM ingredient_category WHERE code='frozen'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('frozen mixed berries',        'g',    (SELECT id FROM ingredient_category WHERE code='frozen'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Tinned & jarred — legumes and tomatoes
  ('tinned chickpeas',            'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='vegan'),       '400g tin'),
  ('tinned black beans',          'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='vegan'),       '400g tin'),
  ('tinned butter beans',         'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='vegan'),       '400g tin'),
  ('tinned white beans',          'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='vegan'),       '400g tin'),
  ('tinned tomatoes',             'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='vegan'),       '400g tin'),

  -- Tinned & jarred — fish
  ('tinned tuna',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '120g tin, in brine or water'),
  ('tinned sardines',             'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '120g tin'),
  ('tinned anchovies',            'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '50g tin'),
  ('tinned mackerel',             'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '125g tin'),
  ('tinned salmon',               'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '200g tin'),

  -- Dry goods — rice
  ('basmati rice',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('brown rice',                  'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sushi rice',                  'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       'short-grain'),
  ('arborio rice',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       'for risotto'),

  -- Dry goods — other grains
  ('couscous',                    'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('bulgur wheat',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('freekeh',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pearl barley',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('farro',                       'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('polenta',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('quinoa',                      'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rolled oats',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — lentils
  ('green lentils',               'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('brown lentils',               'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('puy lentils',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — pasta
  ('spaghetti',                   'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('penne',                       'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fusilli',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pasta shells',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('lasagne sheets',              'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('orzo',                        'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — noodles
  ('soba noodles',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rice noodles',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('egg noodles',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('udon noodles',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — nuts & seeds
  ('walnuts',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pine nuts',                   'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cashews',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flaked almonds',              'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('hazelnuts',                   'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sesame seeds',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flaxseed',                    'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('hemp seeds',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sunflower seeds',             'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pumpkin seeds',               'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — flours & dry baking
  ('plain flour',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('self-raising flour',          'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('bicarbonate of soda',         'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('baking powder',               'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — other
  ('dried porcini mushrooms',     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('breadcrumbs',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('nori sheets',                 NULL,   (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Sauces & condiments — Asian
  ('soy sauce',                   'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('tamari',                      'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('white miso paste',            'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fish sauce',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('oyster sauce',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('mirin',                       'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('hoisin sauce',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sriracha',                    'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('gochujang',                   'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Sauces & condiments — pastes (other regions)
  ('tahini',                      'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rose harissa paste',          'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('chipotle paste',              'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('tomato purée',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       'stronger flavoured than tinned tomatoes; sold in tubes or small tins'),

  -- Sauces & condiments — European
  ('Dijon mustard',               'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('English mustard',             'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('wholegrain mustard',          'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('piccalilli',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('mayonnaise',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('ketchup',                     'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('Worcestershire sauce',        'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), 'contains anchovy'),

  -- Sauces & condiments — jars and preserves
  ('capers',                      'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('olives',                      'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sundried tomatoes',           'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pickled ginger',              'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('kimchi',                      'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sauerkraut',                  'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('honey',                       'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('maple syrup',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Sauces & condiments — stocks
  ('vegetable stock',             'ml',   (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('chicken stock',               'ml',   (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('fish stock',                  'ml',   (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),

  -- Chilled — yoghurts and dairy ferments
  ('full fat Greek yoghurt',      'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  '500g pot'),
  ('skyr',                        'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('natural yoghurt',             'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('cottage cheese',              'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('kefir',                       'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),

  -- Chilled — plant-based
  ('oat milk',                    'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('soy yoghurt',                 'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Chilled — cheeses
  ('cheddar',                     'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('parmesan',                    'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('feta',                        'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('halloumi',                    'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('mozzarella',                  'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('mascarpone',                  'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('ricotta',                     'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('blue cheese',                 'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('goat''s cheese',              'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('cream cheese',                'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),

  -- Chilled — milk, butter, cream, eggs
  ('whole milk',                  'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('butter',                      'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('double cream',                'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('single cream',                'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('large eggs',                  NULL,   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),

  -- Bakery
  ('sourdough bread',             'slice',(SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rye bread',                   'slice',(SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pitta bread',                 NULL,   (SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flatbread',                   NULL,   (SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('burger buns',                 NULL,   (SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Meat & poultry
  ('beef mince',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('beef steak',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('stewing steak',               'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('roast beef',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        'cold cuts, deli-style'),
  ('lamb mince',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('diced lamb',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('pork chop',                   NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('bacon',                       'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('pork sausages',               NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('chorizo',                     'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        'cooking or cured — specify in recipe'),
  ('prosciutto',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('serrano ham',                 'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('bresaola',                    'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('salami',                      'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('cooked ham',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('ham hock',                    NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('chicken breast',              NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('chicken thigh',               NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),

  -- Fish & seafood — fresh and chilled
  ('salmon fillet',               'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('smoked salmon',               'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), 'cold-smoked'),
  ('hot-smoked salmon',           'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('mackerel fillet',             'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('smoked mackerel',             'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('trout',                       'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('haddock',                     'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('smoked haddock',              'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('cod fillet',                  'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('hake fillet',                 'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('pollock fillet',              'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('tuna steak',                  'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('raw prawns',                  'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('cooked prawns',               'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('gravadlax',                   'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('pickled herring',             'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL)
ON CONFLICT (canonical_name) DO NOTHING;


-- ---------------------------------------------------------------------
-- Aliases. Long tail filled in via the importer.
-- ---------------------------------------------------------------------
INSERT INTO ingredient_alias (ingredient_id, alias) VALUES
  -- Baseline aliases (from v3)
  ((SELECT id FROM ingredient WHERE canonical_name='fresh coriander'),          'cilantro'),
  ((SELECT id FROM ingredient WHERE canonical_name='avocado'),                  'avocados'),
  ((SELECT id FROM ingredient WHERE canonical_name='chestnut mushrooms'),       'mushrooms'),
  ((SELECT id FROM ingredient WHERE canonical_name='soy sauce'),                'shoyu'),

  -- Proteins
  ((SELECT id FROM ingredient WHERE canonical_name='prosciutto'),               'parma ham'),
  ((SELECT id FROM ingredient WHERE canonical_name='tinned sardines'),          'sardines'),
  ((SELECT id FROM ingredient WHERE canonical_name='tinned anchovies'),         'anchovies'),
  ((SELECT id FROM ingredient WHERE canonical_name='beef mince'),               'minced beef'),
  ((SELECT id FROM ingredient WHERE canonical_name='lamb mince'),               'minced lamb'),

  -- Dairy
  ((SELECT id FROM ingredient WHERE canonical_name='full fat Greek yoghurt'),   'greek yogurt'),
  ((SELECT id FROM ingredient WHERE canonical_name='natural yoghurt'),          'natural yogurt'),
  ((SELECT id FROM ingredient WHERE canonical_name='soy yoghurt'),              'soy yogurt'),
  ((SELECT id FROM ingredient WHERE canonical_name='whole milk'),               'milk'),
  ((SELECT id FROM ingredient WHERE canonical_name='goat''s cheese'),           'chevre'),
  ((SELECT id FROM ingredient WHERE canonical_name='double cream'),             'heavy cream'),

  -- Grains
  ((SELECT id FROM ingredient WHERE canonical_name='rolled oats'),              'oats'),
  ((SELECT id FROM ingredient WHERE canonical_name='rolled oats'),              'porridge oats'),

  -- Produce
  ((SELECT id FROM ingredient WHERE canonical_name='spring onion'),             'scallion'),
  ((SELECT id FROM ingredient WHERE canonical_name='courgette'),                'courgettes'),
  ((SELECT id FROM ingredient WHERE canonical_name='aubergine'),                'aubergines'),
  ((SELECT id FROM ingredient WHERE canonical_name='waxy potatoes'),            'salad potatoes'),
  ((SELECT id FROM ingredient WHERE canonical_name='waxy potatoes'),            'new potatoes'),

  -- Vinegars and sauces
  ((SELECT id FROM ingredient WHERE canonical_name='white wine vinegar'),       'white vinegar'),
  ((SELECT id FROM ingredient WHERE canonical_name='red wine vinegar'),         'red vinegar'),
  ((SELECT id FROM ingredient WHERE canonical_name='cider vinegar'),            'apple cider vinegar'),
  ((SELECT id FROM ingredient WHERE canonical_name='white miso paste'),         'miso'),
  ((SELECT id FROM ingredient WHERE canonical_name='vegetable stock'),          'stock')
ON CONFLICT (alias) DO NOTHING;




-- =====================================================================
-- SECTION 13 — Row Level Security
-- =====================================================================
-- Three policy classes:
--   * LIBRARY tables (lookups, frameworks, ingredients, meals,
--     components, and their join tables): public read; authenticated
--     write.
--   * PLAN/LOG tables (meal_plan, meal_plan_entry, meal_plan_entry_diner,
--     meal_cooked_log, person, person_restriction): public read;
--     authenticated write. Per requirements §2 default.
--   * WRITER-ONLY tables (household, app_writer, shopping_list,
--     shopping_list_item, import_log): authenticated read AND write.
--
-- Revisit when access extends beyond the household: introduce
-- per-household policies on PLAN/LOG tables.
-- =====================================================================

-- Helper: enable RLS on every table in public.
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t
        );
    END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- LIBRARY tables: public read, authenticated write
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t text;
    library_tables text[] := ARRAY[
        'dietary_category', 'dietary_restriction', 'cuisine',
        'meal_type', 'meal_format', 'nutritional_tag',
        'framework', 'framework_layer', 'component_family',
        'ingredient_category', 'ingredient', 'ingredient_alias',
        'component', 'component_ingredient', 'component_step',
        'component_restriction', 'component_layer',
        'component_nutritional_tag',
        'meal', 'meal_ingredient', 'meal_step', 'meal_restriction',
        'meal_component', 'meal_meal_type', 'meal_meal_format',
        'meal_nutritional_tag'
    ];
BEGIN
    FOREACH t IN ARRAY library_tables
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "Public read" ON public.%I;', t
        );
        EXECUTE format(
            'CREATE POLICY "Public read" ON public.%I '
            'FOR SELECT TO anon, authenticated USING (true);', t
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS "Authenticated write" ON public.%I;', t
        );
        EXECUTE format(
            'CREATE POLICY "Authenticated write" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- PLAN/LOG tables: public read, authenticated write
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t text;
    plan_tables text[] := ARRAY[
        'person', 'person_restriction',
        'meal_plan', 'meal_plan_entry', 'meal_plan_entry_diner',
        'meal_cooked_log'
    ];
BEGIN
    FOREACH t IN ARRAY plan_tables
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "Public read" ON public.%I;', t
        );
        EXECUTE format(
            'CREATE POLICY "Public read" ON public.%I '
            'FOR SELECT TO anon, authenticated USING (true);', t
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS "Authenticated write" ON public.%I;', t
        );
        EXECUTE format(
            'CREATE POLICY "Authenticated write" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- WRITER-ONLY tables: authenticated read AND write
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t text;
    writer_tables text[] := ARRAY[
        'household', 'app_writer',
        'shopping_list', 'shopping_list_item',
        'import_log'
    ];
BEGIN
    FOREACH t IN ARRAY writer_tables
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "Authenticated access" ON public.%I;', t
        );
        EXECUTE format(
            'CREATE POLICY "Authenticated access" ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t
        );
    END LOOP;
END $$;



-- =====================================================================
-- SECTION 14 — Role grants
-- =====================================================================
-- RLS policies control row-level access, but Postgres also requires
-- table-level privileges to be granted to each role. Without these,
-- even a permissive RLS policy returns "permission denied for table".
--
-- anon    — unauthenticated visitors. Read-only on public tables.
-- authenticated — logged-in users. Read on all non-writer tables;
--                 write on content tables they own via RLS.
-- =====================================================================


-- ---------------------------------------------------------------------
-- anon: SELECT on all publicly readable tables
-- ---------------------------------------------------------------------
GRANT SELECT ON
    -- Lookups
    dietary_category, dietary_restriction, cuisine,
    meal_type, meal_format, nutritional_tag,
    -- Frameworks
    framework, framework_layer, component_family,
    -- Ingredients
    ingredient_category, ingredient, ingredient_alias,
    -- Components
    component, component_ingredient, component_step,
    component_restriction, component_nutritional_tag, component_layer,
    -- Meals
    meal, meal_ingredient, meal_step, meal_restriction,
    meal_nutritional_tag, meal_component, meal_meal_type, meal_meal_format,
    -- People + planning (public read)
    person, person_restriction,
    meal_plan, meal_plan_entry, meal_plan_entry_diner,
    meal_cooked_log
TO anon;


-- ---------------------------------------------------------------------
-- authenticated: SELECT on all non-writer-only tables
-- (includes everything anon can read, plus writer-only tables)
-- ---------------------------------------------------------------------
GRANT SELECT ON
    -- Everything anon can read
    dietary_category, dietary_restriction, cuisine,
    meal_type, meal_format, nutritional_tag,
    framework, framework_layer, component_family,
    ingredient_category, ingredient, ingredient_alias,
    component, component_ingredient, component_step,
    component_restriction, component_nutritional_tag, component_layer,
    meal, meal_ingredient, meal_step, meal_restriction,
    meal_nutritional_tag, meal_component, meal_meal_type, meal_meal_format,
    person, person_restriction,
    meal_plan, meal_plan_entry, meal_plan_entry_diner,
    meal_cooked_log,
    -- Writer-only tables (authenticated read)
    household, app_writer,
    shopping_list, shopping_list_item,
    import_log
TO authenticated;


-- ---------------------------------------------------------------------
-- authenticated: INSERT/UPDATE/DELETE on writable content tables
-- ---------------------------------------------------------------------
GRANT INSERT, UPDATE, DELETE ON
    -- Meals
    meal, meal_ingredient, meal_step, meal_restriction,
    meal_nutritional_tag, meal_component, meal_meal_type, meal_meal_format,
    -- Components
    component, component_ingredient, component_step,
    component_restriction, component_nutritional_tag, component_layer,
    -- Ingredients (master vocabulary — writers can extend it via the
    -- import flow's "create new ingredient" branch and alias maintenance)
    ingredient, ingredient_alias,
    -- Planning + log
    meal_plan, meal_plan_entry, meal_plan_entry_diner,
    meal_cooked_log,
    -- Shopping
    shopping_list, shopping_list_item,
    -- Imports
    import_log
TO authenticated;


-- ---------------------------------------------------------------------
-- Sequences — required for SERIAL / auto-increment inserts
-- ---------------------------------------------------------------------
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;



-- =====================================================================
-- Verification queries — run individually after install.
-- =====================================================================

-- 1. Every table in public has RLS enabled.
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public' ORDER BY tablename;

-- 2. Policy listing.
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
-- WHERE schemaname='public' ORDER BY tablename, policyname;

-- 3. Seed checks.
-- SELECT 'household',       COUNT(*) FROM household
-- UNION ALL SELECT 'person',  COUNT(*) FROM person
-- UNION ALL SELECT 'ingredient', COUNT(*) FROM ingredient
-- UNION ALL SELECT 'ingredient_alias', COUNT(*) FROM ingredient_alias;

-- 4. Lookup counts.
-- SELECT 'dietary_category',    COUNT(*) FROM dietary_category
-- UNION ALL SELECT 'dietary_restriction', COUNT(*) FROM dietary_restriction
-- UNION ALL SELECT 'cuisine',             COUNT(*) FROM cuisine
-- UNION ALL SELECT 'meal_type',           COUNT(*) FROM meal_type
-- UNION ALL SELECT 'meal_format',         COUNT(*) FROM meal_format
-- UNION ALL SELECT 'nutritional_tag',     COUNT(*) FROM nutritional_tag
-- UNION ALL SELECT 'framework',           COUNT(*) FROM framework
-- UNION ALL SELECT 'framework_layer',     COUNT(*) FROM framework_layer
-- UNION ALL SELECT 'component_family',    COUNT(*) FROM component_family
-- UNION ALL SELECT 'ingredient_category', COUNT(*) FROM ingredient_category;

-- =====================================================================
-- End of install script
-- =====================================================================
