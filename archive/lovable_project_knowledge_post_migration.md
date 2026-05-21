# Project Knowledge — Recipe & Meal Planning App

Standing brief for any AI tool building this app. Read this on every prompt.

Historically this lived in Lovable's Knowledge feature. The project has since moved to local Claude Code; this same content now serves as the project knowledge inside the claude.ai project and, when needed, as the contents of a `CLAUDE.md` in the repo root.

This document captures conventions and the schema map. The current feature focus lives in a separate document and changes more often.

---

## 1. The schema is the source of truth

The database schema is installed directly via the Supabase SQL editor, not by the build agent. The canonical install script (`recipe_db_install_v3.sql`) defines every table, column, constraint, index, RLS policy, and role grant.

**Do not**:
- Create, alter, or drop tables.
- Add or remove columns.
- Change constraints or indexes.
- Modify RLS policies or role grants.

**If a feature appears to need a schema change**, surface it for discussion. Don't silently act on it. The schema is co-designed with the import contract — drift in one breaks the other.

The build agent's database role is read-only at the structural level: read the live schema, generate code against it, do not modify it.

---

## 2. Build features as vertical slices

Each feature goes from database read/write through to UI before the next one is started. Do not scaffold horizontal layers in advance — no premature API layer, no preemptive component library, no speculative state management.

A "vertical slice" means: pick one feature, build the minimum DB queries needed, build the minimum UI needed, ship it, move on.

The current feature focus is documented separately. Outside that focus, do not generate code.

---

## 3. Real data, not mock data

The app has a real meal library waiting to be imported. Once the import flow exists, the library is populated from actual recipes. Until then, prompt the user to enter or import test data via the app rather than seeding mocks into code.

If test data is genuinely needed for a feature to be demonstrable, suggest specific recipes from the source documents and let the user import them — don't fabricate.

---

## 4. Naming discipline

Table and column names in the database are deliberate. Do not rename, alias, or pluralise them in code in ways that hide the underlying schema names.

- A table called `meal` stays `meal` in TypeScript types, query builders, and API routes — not `meals`, not `Meal`, not `MealRecord`.
- A column called `external_ref` stays `external_ref` — not `externalRef`, not `slug`, not `ref`.
- Generated TypeScript types from Supabase should reflect the schema verbatim.

Camel-casing for variable names locally is fine. The rule applies to anything that references the schema.

---

## 5. RLS policies and role grants are intentional

Three policy classes (per the install script):

- **Library tables** (lookups, frameworks, ingredients, meals, components, all their join tables): public read, authenticated write.
- **Plan/log tables** (meal_plan, meal_plan_entry, meal_plan_entry_diner, meal_cooked_log, person, person_restriction): public read, authenticated write.
- **Writer-only tables** (household, app_writer, shopping_list, shopping_list_item, import_log): authenticated read AND write.

**Implications for code**:
- Read queries on library and plan tables should work with the anon Supabase key (no login required).
- Write operations need an authenticated session.
- Shopping list views are gated behind auth — design the UI so unauthenticated users see a "log in to view shopping lists" path, not an empty list or an error.

**Do not modify RLS policies or role grants.** If a feature seems to need different access control, raise it for discussion.

The `recipe_db_install_v3.sql` script includes Section 14 with all the necessary `GRANT SELECT/INSERT/UPDATE/DELETE` and `GRANT USAGE ON SEQUENCES` statements for `anon` and `authenticated`. A clean install is now a single paste.

---

## 6. Household scoping

Every writable content/state table has a `household_id` column (DEFAULT 1). v1 has a single household. Multi-household is a future concern, not active in v1.

**For code generation**:
- When inserting new rows, do not set `household_id` explicitly — let the default take effect.
- When querying, do not filter by `household_id` yet. v1 has one household; filtering would be noise.
- When the multi-household feature lands, the queries get a `WHERE household_id = ...` retrofit and RLS tightens. That's a future task.

**Ingredient tables are intentionally NOT household-scoped.** `ingredient`, `ingredient_category`, `ingredient_alias` are shared vocabulary. Do not add household filtering to them.

---

## 7. Authentication model

- `auth.users` is Supabase's table — managed by Supabase Auth, not by this app.
- `app_writer` links `auth.users.id` to a household and optionally to a `person`. Writers are added via Supabase's invite-by-email flow (or directly in the SQL editor until the admin feature is built) — there is no self-serve signup.
- `person` is a diner — anyone who eats meals. Not the same as an auth user. Mike and Jane are persons; they may or may not also be auth users.
- Auth uses **magic link / OTP** (email-only). No password auth in this app.

**For code**:
- Login flows authenticate against Supabase Auth via magic link.
- After login, look up the user's `app_writer` row to find their `household_id` and optional `person_id`.
- The `person_id` on `app_writer` is useful for defaulting "cooked by" when the user logs a cook event.
- The application layer uses the presence of an `app_writer` row to decide whether to show edit/create buttons. RLS gates writes at the database; `app_writer` gates UI at the app.

---

## 8. Condensed schema map

Tables grouped by area. Refer to `recipe_db_install_v3.sql` for full column definitions and constraints.

### Lookups (Section 2)
- `dietary_category` — ranked: vegan(1) → vegetarian(2) → pescatarian(3) → meat(4). Used at meal, component, person, and ingredient level.
- `dietary_restriction` — "contains" axis: dairy, gluten, eggs, nuts, peanuts, soy, shellfish, sesame.
- `cuisine` — single values, no regional splits.
- `meal_type` — breakfast, lunch, dinner, snack, side, dessert.
- `meal_format` — no_reheat, microwave, thermos (for transport).
- `nutritional_tag` — qualitative flags. `omega3_strong` seeded; extensible.

### Frameworks (Section 3)
- `framework` — six seeded: component_dinner, bento, breakfast_bowl, mason_jar_salad, smorrebrod, mezze.
- `framework_layer` — named slots within a framework (e.g. base, topping, veg, finisher for component_dinner).
- `component_family` — sub-grouping within a layer (e.g. mash family, sliced potato family within the topping layer).

### Ingredients (Section 4)
- `ingredient_category` — aisle-ordered, flat, 14 seeded categories.
- `ingredient` — canonical master vocabulary. `canonical_name` UNIQUE. Has `default_unit`, `category_id`, `dietary_category_id`. NOT household-scoped.
- `ingredient_alias` — alternative names for the same canonical ingredient. `alias` globally UNIQUE.

### Components (Section 5)
- `component` — reusable building block. `status` IN ('idea','detailed'). Has macros (protein_g, carbs_g, gi_index) and `external_ref` slug.
- `component_ingredient` — carries both `ingredient_id` (FK to canonical) and `ingredient_name` (recipe-contextual). Has `group_name` for recipe-local grouping.
- `component_step` — discrete method steps with `sort_order`, `title`, `content` (may contain {NNNN} placeholders), `timer_seconds`, `group_name`.
- `component_restriction` — many-to-many with dietary_restriction.
- `component_nutritional_tag` — many-to-many with nutritional_tag.
- `component_layer` — registers component against framework_layer(s), with optional component_family.

### Meals (Section 6)
- `meal` — `status` IN ('idea','recipe','composition'). Has macros and `external_ref` slug.
  - `idea`: name + description only.
  - `recipe`: full content via meal_ingredient + meal_step.
  - `composition`: assembled from components via meal_component.
- `meal_ingredient` — same dual-storage pattern as component_ingredient.
- `meal_step` — same shape as component_step.
- `meal_restriction`, `meal_nutritional_tag` — many-to-many lookups.
- `meal_component` — links composition meal to its components, per framework_layer.
- `meal_meal_type`, `meal_meal_format` — many-to-many.

### People (Section 7)
- `household` — seeded with single row (id=1) for v1.
- `person` — diners. Not the same as auth users.
- `person_restriction` — diner-level dietary restrictions.
- `app_writer` — links auth.users to household + optional person.

### Planning (Section 8)
- `meal_plan` — a planning period (dated range).
- `meal_plan_entry` — one slot. `meal_id` nullable (you can plan a slot before picking a meal). Multiple entries per (date, meal_type) allowed — Mike and Jane can eat different meals at the same slot.
- `meal_plan_entry_diner` — per-entry, not per-plan.
- `meal_cooked_log` — historical record of actual cook events with rating.

### Shopping (Section 9)
- `shopping_list` — generated from a meal_plan or ad-hoc.
- `shopping_list_item` — `source` IN ('derived','manual'). Derived items are recreated on regeneration; manual items survive. `is_checked` (in basket) and `is_in_stock` (skip when shopping) are separate flags.

### Imports (Section 10)
- `import_log` — one row per JSON import event. Raw JSON kept in JSONB. `external_ref` indexed for re-import lookups.
- `meal.import_id` and `component.import_id` back-reference the import event that created them.

---

## 9. Key relationships and patterns to know

**Three meal statuses, three rendering paths:**
- `idea` → render name and description only.
- `recipe` → render meal_ingredient (with group_name sections) and meal_step (ordered by sort_order, group_name sections optional).
- `composition` → render meal_component grouped by framework_layer, each component rendered recursively.

**Ingredient placeholders in step content:**
- `{0001}` in `step.content` references the ingredient with `id` = '0001' *within this meal/component*. The id is the local ingredient id from the import JSON, surfaced as `meal_ingredient.id` after import.
- At render time, the placeholder is replaced with the scaled quantity (e.g. "3 tbsp olive oil" when serving 4, "6 tbsp olive oil" when serving 8).
- The mapping is local to the meal — `{0001}` in one recipe is a different ingredient from `{0001}` in another.

**Shopping list aggregation:**
- Aggregate on `ingredient_id` (canonical), not on `ingredient_name`.
- Walk into composition meals: a composition's ingredients are the union of its components' ingredients.
- Scale by the meal_plan_entry's `serves` divided by the meal's `serves` (base servings).
- Sum quantities where units match; list separately where they don't.
- Group by `ingredient.category_id`, ordered by `ingredient_category.sort_order`.

**Dietary category — least-restrictive-eater rule:**
- A meal's `dietary_category` is the most restrictive eater who can eat it. Vegan dishes are classified `vegan`, not `vegetarian`.
- Group suitability ("what can both Mike and Jane eat?") is one query: meal's rank ≤ MIN(rank of all diners).

**Macro aggregation handles nulls explicitly:**
- "Protein this week" should report "X g across N of M tracked meals", not assume null = 0.

---

## 10. Build order

Strictly vertical slices. Current and planned sequence:

1. **Meals** — library, detail view, create/edit, login *(complete — built in Lovable)*
2. **Ingredient master + import flow** — master ingredient table, import JSON pathway *(F2, in Claude Code)*
3. **Components** — component library, detail view, create/edit
4. **Composition builder** — framework picker, layer slots, component picker
5. **Meal plan** — weekly calendar, slot assignment, portion scaling
6. **Shopping list** — generated from plan, manual items, check-off
7. **Cooked log** — cook events, ratings, history view
8. **Writer management** — invite by email, `app_writer` row management, revoke access
9. **LLM features** — post-v1

Do not build ahead of the current focus. If a feature appears to need work from a later slice, surface it for discussion.

---

## 11. What's NOT in the schema (yet)

So you don't try to use them:

- Ingredient substitutions — deferred to staples/pantry feature.
- Per-ingredient nutrition data — deferred. Macros sit at meal level only.
- Leftovers — manual for v1.
- Away-from-home flag — deferred.
- Versioned recipes — re-import updates in place.
- URL recipe import, image-based import — deferred.
- Multi-household — schema-ready (household_id columns exist), not active.

---

## 12. Tech stack

- Frontend: React + Tailwind. Vite-based scaffold (carried forward from Lovable's original output).
- Backend: Supabase (Postgres + Auth + RLS) — hosted in Mike's own Supabase account.
- Build agent: Claude Code, running locally against a clone of the GitHub repo. Cursor or another editor is fine for hand-edits.
- Source control: GitHub repo `miketaylor963-oss/my-kitchen-helper`. Push directly from local; no intermediate sync layer.
- Hosting: Vercel, auto-deploy on push to `main`.
- Local dev: `npm run dev` against the same Supabase instance as production. Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) in `.env.local` (git-ignored) and in Vercel's environment settings.
- Postgres extensions: `pg_trgm` (enabled by install script) for fuzzy ingredient matching at import time.

---

## 13. When in doubt

- Ask before changing the schema.
- Ask before changing RLS or role grants.
- Ask before building outside the current feature focus.
- Prefer fewer, simpler queries over many small ones.
- Prefer real data flowing end-to-end over fabricated demos.
- When editing files, show the diff first and wait for confirmation before applying — that's the Claude Code workflow the project relies on.
