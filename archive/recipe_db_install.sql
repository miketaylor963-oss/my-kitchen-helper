-- =====================================================================
-- Recipe & Meal Planning Database — Full Install Script
-- =====================================================================
--
-- Source of truth for the cookbook, planning, and shopping list app.
-- Target dialect: PostgreSQL (Supabase-compatible).
--
-- This file is the canonical install script. It can be run end-to-end
-- against an empty database, or in sections via the Supabase SQL
-- editor. It contains:
--
--   * Section 1–8: schema definition (tables, constraints, lookup seeds,
--                  indexes).
--   * Section 9:   person seed (the two household diners).
--   * Section 10:  Row Level Security enablement.
--
-- The opening block (above section 1) is also the project's standing
-- brief — keep it in sync with Lovable's Knowledge / Project
-- Instructions so the same context is in both places.
--
-- ---------------------------------------------------------------------
-- Project context
-- ---------------------------------------------------------------------
--   * Personal recipe and meal planning app for a two-person household
--     (may extend to family/friends later).
--   * Tech stack: React + Tailwind frontend, Supabase (Postgres + Auth)
--     backend.
--   * Built as a learning project; prioritise clarity and working
--     features over commercial-grade polish.
--
-- ---------------------------------------------------------------------
-- Usage
-- ---------------------------------------------------------------------
--   Run this file against an empty Postgres database via the Supabase
--   SQL editor. The editor will accept it as a single script, or you
--   can paste it in sections and verify each before continuing.
--
--   Recommended run order if pasting in pieces:
--     1. Sections 1–8   (schema + indexes)
--     2. Section 9      (person seed)
--     3. Section 10     (RLS — must be after data exists so policies
--                        attach to real tables)
--
--   Schema installation is done directly via the Supabase SQL editor,
--   NOT via Lovable. Lovable should treat the live schema as read-only
--   reference (see Conventions below).
--
-- ---------------------------------------------------------------------
-- Design summary
-- ---------------------------------------------------------------------
--   * Meals come in three statuses: 'idea' (one-liner), 'recipe' (full
--     self-contained), and 'composition' (framework + chosen components).
--   * Components are reusable building blocks registered against
--     framework layers (e.g. "salmon & leek base" is a 'base' layer
--     component in the 'component_dinner' framework). Components have
--     their own 'idea' / 'detailed' status, mirroring meal status one
--     level down.
--   * Frameworks (component dinner, bento, breakfast bowl, mason jar
--     salad, smørrebrød, mezze) are data-driven and extensible.
--   * Dietary category is a ranked hierarchy (vegan=1 < vegetarian=2 <
--     pescatarian=3 < meat=4). Group-suitability is one query:
--     "rank <= MIN(rank of all diners)".
--   * Dietary restrictions are separate (dairy, gluten, etc.) and
--     record what something CONTAINS, not what it's free from.
--   * Shopping lists are persisted (so they can be ticked off), derived
--     from a meal plan via a recursive walk into composition meals'
--     components. Derived items and manually added items are kept
--     distinguishable so regeneration doesn't lose the manual ones.
--   * Compositions inherit `serves` from the meal row, not from their
--     components. Components have their own `serves` only for when
--     independently scaled.
--   * `person` here is application-level domain data (who eats what),
--     not authentication. Auth users live in auth.users and are
--     managed by Supabase Auth separately.
--
-- ---------------------------------------------------------------------
-- Schema overview
-- ---------------------------------------------------------------------
--   Section 1 — Lookups (5):         dietary_category, dietary_restriction,
--                                    cuisine, meal_type, meal_format
--   Section 2 — Frameworks (3):      framework, framework_layer,
--                                    component_family
--   Section 3 — Components (4):      component, component_ingredient,
--                                    component_restriction, component_layer
--   Section 4 — Meals (6):           meal, meal_ingredient, meal_restriction,
--                                    meal_component, meal_meal_type,
--                                    meal_meal_format
--   Section 5 — People (2):          person, person_restriction
--   Section 6 — Planning (4):        meal_plan, meal_plan_entry,
--                                    meal_plan_entry_diner, meal_cooked_log
--   Section 7 — Shopping (2):        shopping_list, shopping_list_item
--   Section 8 — Indexes
--   Section 9 — Person seed
--   Section 10 — Row Level Security
--
-- ---------------------------------------------------------------------
-- Conventions for code generation (Lovable, read this)
-- ---------------------------------------------------------------------
--   * The database schema is the source of truth. Do NOT create,
--     alter, or drop tables, columns, constraints, or indexes in
--     response to feature prompts. If a feature appears to need a
--     schema change, surface it for discussion rather than acting.
--   * All tables have Row Level Security enabled with a single
--     permissive policy ("Authenticated users have full access"). Do
--     NOT modify RLS policies without being explicitly asked.
--   * Build features as vertical slices: each feature goes from
--     database read/write to UI before the next one is started. Don't
--     scaffold horizontal layers in advance.
--   * Prefer real data over mock data. If test data is needed, prompt
--     the user to enter it via the app rather than seeding mocks into
--     code.
--   * Keep table and column names exactly as defined here. Do not
--     rename, alias, or pluralise in code in ways that hide the
--     underlying schema names.
-- =====================================================================



-- =====================================================================
-- SECTION 1 — Lookup tables
-- =====================================================================

-- ---------------------------------------------------------------------
-- dietary_category
-- Ranked hierarchy from most restrictive (vegan) to least (meat).
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
-- Records what a meal/component CONTAINS. The filter "show dairy-free"
-- is the negation (no row in *_restriction referencing dairy).
-- Add gluten, nuts, eggs, soy, shellfish etc. as needed.
-- ---------------------------------------------------------------------
CREATE TABLE dietary_restriction (
    id          SERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    sort_order  INTEGER
);

INSERT INTO dietary_restriction (code, name, sort_order) VALUES
  ('dairy', 'Dairy', 1);


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
-- How a meal is consumed/transported. Many-to-many with meal so the
-- same dish (e.g. dal) can be valid in multiple formats.
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



-- =====================================================================
-- SECTION 2 — Frameworks, layers, and component families
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
-- A named slot within a framework. is_required is advisory — the UI
-- can warn rather than block when a required layer has no component.
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
-- Sub-grouping of components within a single framework layer (e.g. the
-- topping layer of component_dinner contains "Mash family", "Sliced
-- potato family", etc.). Used to group options in the UI when picking
-- a component for a slot.
--
-- A component's family is recorded on the component_layer join, not on
-- the component itself, because a component used across frameworks may
-- legitimately fall in different families per context. Application code
-- should validate that component_layer.component_family_id (when set)
-- references a family belonging to the same framework_layer_id.
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
-- SECTION 3 — Components
-- =====================================================================

-- ---------------------------------------------------------------------
-- component
-- A reusable building block. status='idea' has name+description only;
-- status='detailed' has ingredients (component_ingredient) and method.
-- ---------------------------------------------------------------------
CREATE TABLE component (
    id                   SERIAL PRIMARY KEY,
    name                 TEXT        NOT NULL,
    status               TEXT        NOT NULL CHECK (status IN ('idea','detailed')),
    description          TEXT,
    cuisine_id           INTEGER     REFERENCES cuisine(id),
    dietary_category_id  INTEGER     REFERENCES dietary_category(id),
    method               TEXT,
    prep_time_minutes    INTEGER,
    cook_time_minutes    INTEGER,
    serves               INTEGER,
    omega3_strong        BOOLEAN     NOT NULL DEFAULT FALSE,
    notes                TEXT,
    source               TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- component_ingredient
-- Populated for status='detailed' components only.
-- ---------------------------------------------------------------------
CREATE TABLE component_ingredient (
    id               SERIAL PRIMARY KEY,
    component_id     INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    quantity         REAL,
    unit             TEXT,
    ingredient_name  TEXT    NOT NULL,
    notes            TEXT,
    sort_order       INTEGER
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
-- component_layer
-- Registers a component against a framework layer. Many-to-many so the
-- same component (e.g. miso-walnut dressing) can serve as 'finisher'
-- in component_dinner and as 'extras' in bento. component_family_id is
-- optional and, when set, must belong to the same framework_layer
-- (validated in application code).
-- ---------------------------------------------------------------------
CREATE TABLE component_layer (
    component_id         INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    framework_layer_id   INTEGER NOT NULL REFERENCES framework_layer(id),
    component_family_id  INTEGER          REFERENCES component_family(id),
    PRIMARY KEY (component_id, framework_layer_id)
);



-- =====================================================================
-- SECTION 4 — Meals
-- =====================================================================

-- ---------------------------------------------------------------------
-- meal
-- The central entity. Three statuses:
--   * 'idea'        — name + description only
--   * 'recipe'      — fully self-contained; ingredients in meal_ingredient
--   * 'composition' — framework + components; ingredients derived via
--                     meal_component -> component -> component_ingredient
-- ---------------------------------------------------------------------
CREATE TABLE meal (
    id                   SERIAL PRIMARY KEY,
    name                 TEXT        NOT NULL,
    status               TEXT        NOT NULL CHECK (status IN ('idea','recipe','composition')),
    description          TEXT,
    framework_id         INTEGER     REFERENCES framework(id),
    cuisine_id           INTEGER     REFERENCES cuisine(id),
    dietary_category_id  INTEGER     REFERENCES dietary_category(id),
    method               TEXT,
    prep_time_minutes    INTEGER,
    cook_time_minutes    INTEGER,
    serves               INTEGER,
    omega3_strong        BOOLEAN     NOT NULL DEFAULT FALSE,
    notes                TEXT,
    source               TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- meal_ingredient
-- Populated for status='recipe' meals. Composition meals derive
-- ingredients from their components.
-- ---------------------------------------------------------------------
CREATE TABLE meal_ingredient (
    id               SERIAL PRIMARY KEY,
    meal_id          INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    quantity         REAL,
    unit             TEXT,
    ingredient_name  TEXT    NOT NULL,
    notes            TEXT,
    sort_order       INTEGER
);


-- ---------------------------------------------------------------------
-- meal_restriction
-- For composition meals, UI can pre-fill by union of component
-- restrictions; user can override.
-- ---------------------------------------------------------------------
CREATE TABLE meal_restriction (
    meal_id         INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    restriction_id  INTEGER NOT NULL REFERENCES dietary_restriction(id),
    PRIMARY KEY (meal_id, restriction_id)
);


-- ---------------------------------------------------------------------
-- meal_component
-- Links a composition meal to its components and the layer each plays.
-- No unique (meal, layer) constraint — bento legitimately has multiple
-- veg components in a single layer, mezze has multiple dips, etc.
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
-- Many-to-many: e.g. a frittata can be both breakfast and lunch.
-- ---------------------------------------------------------------------
CREATE TABLE meal_meal_type (
    meal_id       INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    meal_type_id  INTEGER NOT NULL REFERENCES meal_type(id),
    PRIMARY KEY (meal_id, meal_type_id)
);


-- ---------------------------------------------------------------------
-- meal_meal_format
-- Many-to-many: a meal can be valid in multiple formats.
-- ---------------------------------------------------------------------
CREATE TABLE meal_meal_format (
    meal_id         INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    meal_format_id  INTEGER NOT NULL REFERENCES meal_format(id),
    PRIMARY KEY (meal_id, meal_format_id)
);



-- =====================================================================
-- SECTION 5 — People
-- =====================================================================

-- ---------------------------------------------------------------------
-- person
-- Represents a diner (anyone who eats meals here), not necessarily an
-- app user. When authentication is added, link to the auth user table
-- via a nullable user_id column.
-- ---------------------------------------------------------------------
CREATE TABLE person (
    id                   SERIAL PRIMARY KEY,
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



-- =====================================================================
-- SECTION 6 — Meal planning
-- =====================================================================

-- ---------------------------------------------------------------------
-- meal_plan
-- ---------------------------------------------------------------------
CREATE TABLE meal_plan (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    start_date  DATE        NOT NULL,
    end_date    DATE        NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- meal_plan_entry
-- One slot in a plan. meal_id is nullable on purpose — you can plan
-- "Thursday dinner, pescatarian and quick" before picking a meal.
-- Multiple entries per (entry_date, meal_type_id) are allowed.
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


-- ---------------------------------------------------------------------
-- meal_plan_entry_diner
-- Per-entry, not per-plan — diners often vary by day/slot.
-- ---------------------------------------------------------------------
CREATE TABLE meal_plan_entry_diner (
    entry_id   INTEGER NOT NULL REFERENCES meal_plan_entry(id) ON DELETE CASCADE,
    person_id  INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, person_id)
);


-- ---------------------------------------------------------------------
-- meal_cooked_log
-- Records each time a meal was actually cooked. Drives analytics
-- (favourites, frequency, what works for whom). Optionally linked to
-- the meal plan entry that triggered it.
-- ---------------------------------------------------------------------
CREATE TABLE meal_cooked_log (
    id                  SERIAL PRIMARY KEY,
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
-- SECTION 7 — Shopping list
-- =====================================================================

-- ---------------------------------------------------------------------
-- shopping_list
-- meal_plan_id is nullable — supports plan-derived and ad-hoc lists.
-- ---------------------------------------------------------------------
CREATE TABLE shopping_list (
    id            SERIAL PRIMARY KEY,
    meal_plan_id  INTEGER     REFERENCES meal_plan(id) ON DELETE SET NULL,
    name          TEXT        NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes         TEXT
);


-- ---------------------------------------------------------------------
-- shopping_list_item
-- source='derived' items are managed by the regeneration logic; they
-- are deleted and re-created when the source plan changes.
-- source='manual' items (e.g. washing-up liquid) survive regeneration.
-- is_checked = "I've put this in the basket".
-- is_in_stock = "I already have this; skip when shopping".
-- ---------------------------------------------------------------------
CREATE TABLE shopping_list_item (
    id                SERIAL PRIMARY KEY,
    shopping_list_id  INTEGER NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
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
-- SECTION 8 — Indexes
-- =====================================================================
-- Personal-scale data won't need many indexes, but indexing common
-- join columns up front is cheap and avoids surprises later.
-- =====================================================================

CREATE INDEX idx_component_ingredient_component   ON component_ingredient(component_id);
CREATE INDEX idx_component_restriction_component  ON component_restriction(component_id);
CREATE INDEX idx_component_layer_component        ON component_layer(component_id);
CREATE INDEX idx_component_layer_layer            ON component_layer(framework_layer_id);

CREATE INDEX idx_meal_ingredient_meal             ON meal_ingredient(meal_id);
CREATE INDEX idx_meal_restriction_meal            ON meal_restriction(meal_id);
CREATE INDEX idx_meal_component_meal              ON meal_component(meal_id);
CREATE INDEX idx_meal_component_component         ON meal_component(component_id);

CREATE INDEX idx_meal_plan_entry_plan             ON meal_plan_entry(meal_plan_id);
CREATE INDEX idx_meal_plan_entry_date             ON meal_plan_entry(entry_date);
CREATE INDEX idx_meal_plan_entry_diner_entry      ON meal_plan_entry_diner(entry_id);

CREATE INDEX idx_meal_cooked_log_meal             ON meal_cooked_log(meal_id);
CREATE INDEX idx_meal_cooked_log_date             ON meal_cooked_log(cooked_date);

CREATE INDEX idx_shopping_list_item_list          ON shopping_list_item(shopping_list_id);



-- =====================================================================
-- SECTION 9 — Person seed
-- =====================================================================
-- Seeds the two primary diners. `person` is application-level domain
-- data (who eats what), not authentication. Auth users live in
-- auth.users and are managed separately by Supabase Auth.
--
-- Additional persons (family, friends, occasional guests) can be added
-- later via the app UI.
-- =====================================================================

INSERT INTO person (name, notes)
VALUES
    ('Mike', 'Household member. Omnivore.'),
    ('Jane', 'Household member. Pescatarian.')
ON CONFLICT DO NOTHING;



-- =====================================================================
-- SECTION 10 — Row Level Security
-- =====================================================================
-- Enables RLS on every table in `public` and applies a single
-- permissive policy: any authenticated user has full access. The
-- security boundary that matters for v1 is "logged in vs not logged
-- in" — the Supabase anon API key (visible in client-side code)
-- cannot read or write anything.
--
-- Revisit when access extends beyond the household: introduce a
-- household/group concept and per-household policies.
--
-- Safe to re-run: each iteration drops the policy if it exists, then
-- recreates it. ENABLE ROW LEVEL SECURITY is itself idempotent.
-- =====================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',
            t
        );

        EXECUTE format(
            'DROP POLICY IF EXISTS "Authenticated users have full access" '
            'ON public.%I;',
            t
        );

        EXECUTE format(
            'CREATE POLICY "Authenticated users have full access" '
            'ON public.%I FOR ALL TO authenticated '
            'USING (true) WITH CHECK (true);',
            t
        );
    END LOOP;
END $$;


-- =====================================================================
-- Verification queries — run individually to sanity-check the install.
-- =====================================================================

-- 1. Every table in public should have RLS enabled.
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- 2. Every table should have the permissive policy attached.
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- 3. Confirm the person seed.
-- SELECT id, name, notes FROM person ORDER BY name;

-- 4. Confirm the lookups are populated.
-- SELECT 'dietary_category' AS lookup, COUNT(*) FROM dietary_category
-- UNION ALL SELECT 'dietary_restriction', COUNT(*) FROM dietary_restriction
-- UNION ALL SELECT 'cuisine',             COUNT(*) FROM cuisine
-- UNION ALL SELECT 'meal_type',           COUNT(*) FROM meal_type
-- UNION ALL SELECT 'meal_format',         COUNT(*) FROM meal_format
-- UNION ALL SELECT 'framework',           COUNT(*) FROM framework
-- UNION ALL SELECT 'framework_layer',     COUNT(*) FROM framework_layer
-- UNION ALL SELECT 'component_family',    COUNT(*) FROM component_family;

-- =====================================================================
-- End of install script
-- =====================================================================
