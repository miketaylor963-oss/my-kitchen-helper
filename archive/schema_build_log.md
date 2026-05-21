# Schema Build Log

A record of decisions and issues during the v2 schema rewrite — the rebuild that folded in recipe import support, portfolio-ready foundations, and the structural changes flagged during planning. Output is `recipe_db_install_v2.sql`.

Companion documents produced alongside: `recipe_import_spec.md` and `recipe_import_template.json`.

---

## Stage 1 — Discovery from example recipes

### Issue 1 — Example JSON recipes were inconsistent with each other

**Symptom:** Four example recipes were uploaded as the source material for designing the import contract. None of them shared a format.

**Cause:** They were exported at different points from the recipe widget plus some manual additions, not a stable schema. Specifically:
- Three were flat objects; `black_bean_patties.json` wrapped everything in a `"recipe": {}` envelope.
- `butter_bean_mushroom_walnut_loaf.json` had `notes` as a structured object; the others had it as a string.
- Only `black_bean_patties.json` included `ingredient_refs` on steps and `group` on ingredients.
- Only `black_bean_patties.json` used `{0001}` placeholder syntax in step content.
- Only `black_bean_patties.json` had a slug-style `id` at the top level.

**Fix:** Before designing schema changes around them, pick one canonical format and document it as the import contract. `black_bean_patties.json` was the richest of the four and became the starting point.

**Implication:** Conversion of the existing four recipes to the canonical format is hand work. The importer should validate against the contract, not accept dialectal variants.

---

### Decision 1 — One template with discriminator, not two

**Decision:** A single import template with `import_type: "recipe" | "component"`. Component-only fields (framework layer registrations) and recipe-only fields (meal types, meal formats) coexist on the template, ignored when not applicable.

**Reasoning:** Recipes and components share ~90% of their structure (name, ingredients, steps, dietary classification). Two near-duplicate templates is drift waiting to happen.

**Implication:** Validator switches on `import_type`. Compositions are explicitly excluded from import — they're assembled from existing components in-app.

---

### Decision 2 — Keep both inline placeholders and explicit ingredient_refs

**Decision:** Step content uses `{0001}` placeholders referencing the local ingredient `id`. Steps also carry an explicit `ingredient_refs` array. Both supported.

**Reasoning:**
- Placeholders enable inline-scaled-quantity rendering ("3 tbsp olive oil" → "6 tbsp olive oil" when serving 8).
- Refs let "which steps use harissa?" queries work without parsing strings.
- For hand-conversion of existing recipes, writing both is self-checking.

**Deferred:** Whether the importer derives refs from placeholders, making refs optional in the template, was left open. Decide after converting two or three recipes by hand.

**Implication:** The `{NNNN}` mapping is *local to the meal*. `{0001}` in one recipe is a different ingredient from `{0001}` in another. Resolved at insert time when `meal_ingredient.id` is generated.

---

## Stage 2 — Structural schema changes

### Decision 3 — Method becomes first-class meal_step / component_step tables

**Decision:** Drop the `method TEXT` columns on `meal` and `component`. Replace with:

```sql
CREATE TABLE meal_step (
    id              SERIAL PRIMARY KEY,
    meal_id         INTEGER NOT NULL REFERENCES meal(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL,
    title           TEXT,
    content         TEXT NOT NULL,
    timer_seconds   INTEGER,
    group_name      TEXT
);
```

And the equivalent `component_step`.

**Reasoning:** Every example JSON had steps as discrete items with title, content, optional timer, and optional ingredient refs. A single TEXT blob loses all of that. Keeping both (text method *and* structured steps) is the kind of dual-storage drift that bites later.

**Implication:** Free-text narrative methods on simpler recipes get migrated to a single-row step on import. Render order driven by `sort_order`, not insertion order.

---

### Decision 4 — Ingredient groups as nullable free-text, not a lookup

**Decision:** `group_name TEXT` column on `meal_ingredient` and `component_ingredient`. Nullable. No lookup table.

**Reasoning:** Groups like "patty", "mushrooms", "assembly" are recipe-local labels, not shared vocabulary. Normalising would force "filling" and "patty" into the same scheme without anything to anchor them.

**Implication:** Ungrouped recipes leave the field empty. Renderer groups by `group_name` when present, lists straight when not.

---

### Decision 5 — `external_ref` slug for import idempotency

**Decision:** Add `external_ref TEXT` (nullable, unique-where-set) on `meal` and `component`.

**Reasoning:** Two payoffs. First, re-imports of the same JSON update the existing row instead of duplicating. Second, traceability back to the chat or doc the recipe came from.

**Re-import strategy locked:** Option A — update in place. Find existing meal/component by `external_ref`, replace its child rows, append a new `import_log` entry. Option B (versioning with `superseded` status) was considered and rejected as over-engineering for personal scale.

**Implication:** Indexed for lookup speed during re-import. Source field stays as free text (`"Claude chat, March 2026"`) — not worth structuring at v1.

---

### Issue 2 — No master ingredient table broke everything downstream

**Symptom:** Original schema had `meal_ingredient.ingredient_name` as free text with no `ingredient` table to reference.

**Cause:** v1 schema treated ingredients as recipe-local. The implications surfaced when designing the shopping list aggregation and the import flow.

**Consequences without it:**
- Shopping list can't aggregate properly. "3 tbsp olive oil" from recipe A and "2 tbsp olive oil" from recipe B are two separate strings.
- Category-based shopping list grouping has nothing to hang categories on.
- The import flow's "propose matches" step has nothing to match against.

**Fix:** Add three tables — `ingredient_category`, `ingredient`, `ingredient_alias`. Both join tables (`meal_ingredient`, `component_ingredient`) carry both the canonical `ingredient_id` *and* the recipe-contextual `ingredient_name` ("red onion, finely diced"). Canonical drives aggregation; contextual drives display.

**Implication:** This was the largest single change in v2. Section 4 of the install script is dedicated to it.

---

### Decision 6 — Ingredient master is shared, NOT household-scoped

**Decision:** `ingredient`, `ingredient_category`, and `ingredient_alias` have no `household_id` column. They're shared vocabulary across the database.

**Reasoning:** Considered the alternative (per-household master) and the hybrid (shared catalogue with `ingredient_household_override` for category and unit). Three reasons the shared model won:
1. **Portfolio framing.** If the app ever opens up beyond the household, a shared canonical vocabulary is a feature. Households should not each redo "red onion is in fresh produce".
2. **The data is genuinely universal at this level.** `red onion` is `red onion` everywhere.
3. **Categorisation and alias work compounds across households.** "Cilantro → coriander" is a true mapping, not a household preference.

**Implication:** Multi-household activation later doesn't touch ingredient tables. If household-specific overrides are ever needed (category, unit, notes), `ingredient_household_override` is an additive table.

---

### Decision 7 — Aisle-ordered ingredient categories, flat structure

**Decision:** 14 seeded categories, flat (no hierarchy), with `sort_order` driving shopping-list grouping:

1. Fresh produce
2. Fresh herbs
3. Bakery
4. Meat & poultry
5. Fish & seafood
6. Chilled (dairy/alts)
7. Frozen
8. Tinned & jarred
9. Dry goods
10. Oils & vinegars
11. Sauces & condiments
12. Dried herbs & spices
13. Drinks
14. Household

**Reasoning:** Order matches the way the shop is actually walked. Flat structure avoids the "is it pantry/oils or just oils?" question.

**Implication:** Shopping list orders items by category `sort_order`. Adding a new category is one row; reordering is updating `sort_order` values.

---

### Decision 8 — Pre-seed ~50 staple ingredients in the install script

**Decision:** Pre-seed the ingredient master with ~50 high-frequency basics drawn from the source docs — olive oil, garlic, lemon, red onion, tinned tomatoes, and so on.

**Reasoning:** Without it, the first import asks the operator to create every single ingredient, which is tedious. With it, the first import is mostly auto-matched, and only the long tail (`gochujang`, `freekeh`, `urfa biber`) hits the create-new path.

**Bonus:** The seed list is itself a useful portfolio artefact — here's the master vocabulary.

**Implication:** Lives in Section 4 of the install script, after the table creation. Easy to extend.

---

### Decision 9 — Trigram matching via pg_trgm, with prep-note stripping first

**Decision:** Ingredient matching uses, in order:
1. Prep-note suffix stripping in code (`"red onion, finely diced"` → `"red onion"`).
2. Exact match against `canonical_name` and `ingredient_alias.alias`.
3. Trigram fuzzy match (Postgres `pg_trgm` extension, threshold ~0.6) returning top 3 candidates.
4. Operator confirms top match / picks alternative / creates new.

**Reasoning:** Prep-note stripping handles 95% of contextual variants in code, no schema. Trigram fuzzy handles typos and word-order shifts. Operator-in-the-loop catches the long tail.

**Schema impact:** Enable `pg_trgm` extension. Trigram indexes on `ingredient.canonical_name` and `ingredient_alias.alias`.

**No `ingredient_match` table.** Considered and rejected — the case "operator told us X maps to Y, don't ask again" is mostly handled by aliases. The remaining edge cases aren't worth a whole table at v1 scale.

---

## Stage 3 — Tags, macros, and nutritional model

### Decision 10 — Nutritional tags via lookup + join, not boolean columns

**Decision:** Replace the v1 boolean `omega3_strong` on `meal` with a `nutritional_tag` lookup and `meal_nutritional_tag` / `component_nutritional_tag` join tables. Mirrors the dietary_restriction pattern.

**Initial seed:** `omega3_strong` only. Extensible.

**Reasoning:** Adding new qualitative flags (high-protein, low-carb, anti-inflammatory) shouldn't need an ALTER on `meal` every time. Tag pattern is cheap and right.

**Implication:** Existing `omega3_strong` boolean values get migrated to join rows. Boolean column dropped.

---

### Decision 11 — Macros as nullable numeric columns, not via ingredients

**Decision:** Add `protein_g`, `carbs_g`, `gi_index` directly to `meal` and `component`. Nullable — only carry values when known.

**Considered and deferred:** Per-ingredient nutrition data with computed meal totals. Cost was disproportionate (~200 ingredients × per-100g data × unit conversion overhead). Schema change is small but the data work is large. Deferred until/unless it's actually needed.

**Aggregation rule:** Always report "X g across N of M tracked meals" — explicit about coverage, no false precision from treating null as 0.

**Implication:** Tags answer "which meals are notable for protein?". Numeric columns answer "how much protein did I have this week?". Two layers, neither pretending to be the other.

---

### Issue 3 — Missing dietary_restriction seeds blocked imports

**Symptom:** v1 schema seeded only `dairy` in `dietary_restriction`. Example recipes referenced `gluten`, `nuts`, `eggs`, `shellfish`, `soy`. The importer would have failed FK constraints on first contact.

**Cause:** Seeds were minimal at v1 with "add others as needed" — needed turned out to be immediately.

**Fix:** Seed eight restrictions in v2: `dairy`, `gluten`, `eggs`, `nuts`, `peanuts`, `soy`, `shellfish`, `sesame`.

**Implication:** Reviewing seed completeness against real example data should be standard before any new content type lands.

---

## Stage 4 — Ownership, writers, and RLS

### Decision 12 — Household table with single seeded row

**Decision:** `household` table seeded with one row (id=1, name='Default'). Every writable content/state table gets `household_id INTEGER NOT NULL REFERENCES household(id) DEFAULT 1`.

**Writable tables affected:** `meal`, `component`, `person`, `person_restriction`, `meal_plan`, `meal_plan_entry`, `meal_plan_entry_diner`, `meal_cooked_log`, `shopping_list`, `shopping_list_item`, `app_writer`, `import_log`.

**Reasoning:** v1 has one household. The column is functionally unused. Cost now: one column per table. Cost later (when multi-household activates): a `WHERE household_id = ...` retrofit on queries and an RLS tightening. No data migration.

**Implication:** `DEFAULT 1` means inserts don't need to set it explicitly — Lovable-generated code is unchanged. Vocabulary tables (`ingredient` and friends) deliberately not scoped, per Decision 6.

---

### Decision 13 — app_writer table replaces hardcoded writer lists

**Decision:**

```sql
CREATE TABLE app_writer (
    user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id INTEGER NOT NULL REFERENCES household(id),
    person_id    INTEGER REFERENCES person(id),  -- optional link to a diner
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Reasoning:** Flipping to invite-based access later becomes a row insert, not a code change or RLS rewrite. Person link is useful for defaulting "cooked by" when the user logs a cook event — cooked_log references `person`, not `auth.users`.

**Seeded:** Nothing. Operator adds rows manually after creating Supabase auth users.

**Implication:** The application layer checks for an `app_writer` row to decide whether to show edit/create buttons. RLS gates write at the database layer; `app_writer` gates UI at the application layer. Two layers, complementary.

---

### Decision 14 — Three-tier RLS replacing the single permissive policy

**Decision:** RLS rewritten into three policy classes:

- **Library** (meals, components, ingredients, frameworks, all lookups, all join tables): `FOR SELECT TO anon, authenticated USING (true)` + `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.
- **Plan/log** (meal_plan, meal_plan_entry, meal_plan_entry_diner, meal_cooked_log, person, person_restriction): same — public read, authenticated write.
- **Writer-only** (household, app_writer, shopping_list, shopping_list_item, import_log): `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. No anon.

**Reasoning:** Resolves Issue 4 from the planning log — requirements wanted public read on library and plan tables; v1 RLS had auth-only on everything. Shopping list and import log are transient working artefacts not interesting publicly. Household and app_writer are administrative — never public.

**Implication:** Anon Supabase key can SELECT from library and plan tables. Cannot read shopping lists, writer lists, or household data. Cannot write anywhere.

**Open question parked:** Whether plan/log tables should remain public-read once the app has visitors. Acceptable for v1; revisit when there's a reason.

---

## Stage 5 — Import audit trail

### Decision 15 — import_log table with raw JSON in JSONB

**Decision:**

```sql
CREATE TABLE import_log (
    id            SERIAL PRIMARY KEY,
    external_ref  TEXT,
    import_type   TEXT NOT NULL,  -- 'recipe' or 'component'
    payload       JSONB NOT NULL,
    status        TEXT NOT NULL,  -- 'success', 'failed', 'partial'
    error_message TEXT,
    imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    household_id  INTEGER NOT NULL REFERENCES household(id) DEFAULT 1
);
```

`meal.import_id` and `component.import_id` back-reference the import event that created them.

**Reasoning:** Two things this earns its place for. Re-imports can find prior history. Failed imports keep the raw payload for debugging without forcing the operator to copy it out of the chat. JSONB indexable on `external_ref` for re-import lookups.

**Considered and rejected:** An `import_staging` table for in-flight review queues. Validation in code before live write is enough at v1; staging adds complexity without payoff yet.

**Implication:** Every import — successful or failed — produces an `import_log` row. Re-imports append a new row rather than overwriting the previous one.

---

## Stage 6 — Operational notes

### Issue 4 — Clean reinstall strategy for the v2 rewrite

**Symptom:** Moving from v1 to v2 against the existing Supabase project required deciding how to clear the v1 schema cleanly.

**Cause:** ~26 tables created by v1, no data yet (Lovable hadn't been wired up), but the v1 tables present.

**Fix (recommended):** `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;` — wipes everything in `public` cleanly. Run v2 install script against the empty schema.

**Caveats documented in install script:**
- `auth.users` is in a different schema; dropping `public` doesn't touch Supabase Auth.
- Storage buckets, edge functions, other schemas unaffected.
- The v2 script's `CREATE TABLE` statements are not idempotent — re-running on a populated database fails on the first existing table. v3 may add `CREATE TABLE IF NOT EXISTS`; not now.

**Implication:** Section 0 of the install script (optionally uncommentable "Clean slate" block) was offered but not added by default. Keeping it manual prevents accidental wipes.

---

### Decision 16 — Section structure of the v2 install script

**Decision:** 13 sections, in dependency order:

1. (Optional) Clean slate
2. Lookups — dietary categories, restrictions, cuisines, meal types, formats, nutritional tags
3. Frameworks, layers, component families
4. Ingredients — categories, master, aliases (with `pg_trgm` extension + indexes), staples seed
5. Components — table + ingredients + steps + join tables
6. Meals — table + ingredients + steps + join tables
7. People — household (seeded id=1), person, person_restriction, app_writer
8. Planning — meal_plan, meal_plan_entry, meal_plan_entry_diner, meal_cooked_log
9. Shopping — shopping_list, shopping_list_item
10. Imports — import_log
11. (Seed) Persons — Mike and Jane
12. Indexes — additional indexes beyond PK/FK
13. Row Level Security — three policy classes
14. (Added post-Feature 1) Role grants for anon and authenticated

**Reasoning:** Foreign key dependencies dictate order. RLS comes after data so policies attach to real tables. Indexes come after data for the same reason (no functional difference, but keeps the file scannable).

**Implication:** Each section can be pasted into the Supabase SQL editor independently and verified before continuing. Verification queries live at the end as commented-out blocks.

---

## Post-build outputs

Three artefacts produced from this stage:

- **`recipe_db_install_v2.sql`** — the canonical install script.
- **`recipe_import_spec.md`** — field-by-field specification of the import template, with worked example (shepherd's pie).
- **`recipe_import_template.json`** — blank template for hand-conversion of existing recipes.

These are the inputs to the feature build phase. Recipe conversion is hand work happening alongside feature development; the importer is built when the ingredient master has been partly populated by manual seeding, to avoid the chicken-and-egg of every first import asking to create every ingredient.

---

## Things to revisit

Carrying forward from the v2 build:

- **`is_public` flag on meal/component** — flagged but not added. Useful if a curated public landing page ever wants to show only some library items rather than all of them.
- **`image_url` on meal/component** — flagged, not added. Recipes without photos look thin for a portfolio piece. Easy to add later and back-fill imports.
- **`{0001}` vs `[[0001]]` placeholder syntax** — `{}` retained for now. Worth changing if literal `{ }` in step content ever clashes.
- **Plan templates** — deferred until the basic planner is in use.
- **Versioning of imports** — Option A (update in place) chosen for v1. Revisit if recipe edits ever need to leave old plans pointing at the old version.

These were deliberate non-decisions, not omissions.
