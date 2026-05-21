# Planning Log

A record of decisions, revisions, and issues across the life of the project. Covers tool choice, domain modelling, the schema v1/v2 work, the F1 build's tooling lessons, and the cutover from Lovable to local Claude Code + Vercel.

Format mirrors the feature build log: decisions and issues each get an entry with the problem (or decision), what was chosen, and any implication for future work. Stages are ordered roughly chronologically. Earlier stages are preserved as written — decisions later overtaken by events are flagged with a `[Superseded]` line rather than rewritten.

---

## Stage 1 — Tool choice and starting point

### Decision 1 — Lovable as the starting tool, with Claude Code as fallback

**Context:** Background is Oracle SQL/Forms/Stored Procedures, long since cold. PM role, looking for minimal coding and quick prototyping rather than commercial-grade engineering. Two-user household scope. Personal-use prototype, not a customer-facing product.

**Options considered:**
- **Lovable** — describe-the-app builder with built-in Supabase, GitHub sync, React + Tailwind output.
- **Bolt.new** — similar to Lovable but reportedly struggles past ~15-20 components.
- **v0** — frontend-only, needs a separate backend.
- **Claude Code** — terminal-based, more powerful, steeper setup curve.

**Choice:** Hybrid. Start in Lovable because the schema-first approach plays directly to its strengths and time-to-working-app is in days, not weeks. Switch to Claude Code via GitHub export when complexity hits a wall — likely candidates are the composition builder, shopping list generation, and the import parser.

**Implication:** Schema is designed in chat with Claude, installed directly via Supabase SQL editor, treated by Lovable as read-only reference. Lovable should never create or modify tables.

**[Superseded by Decision 15.]** The "switch when complexity hits a wall" trigger fired earlier than expected — after F1, before F2. The wall was less about feature complexity than about Lovable's round-tripping behaviour and its tendency to drift from the schema. See Stage 6.

---

### Decision 2 — Schema first, then features

**Decision:** Generate the full DDL upfront rather than letting Lovable evolve the schema as features are built.

**Reasoning:** ~26 tables with non-trivial relationships (ranked dietary categories, framework-layer-component model, three-status meals). Lovable losing context across sessions on a schema this size would cause silent drift and duplicate tables.

**Implication:** Two distinct concerns kept strictly separate — schema setup (Supabase SQL editor, direct) and feature building (Lovable, prompted with the schema as standing brief). Lovable's Knowledge feature carries a condensed schema summary so it doesn't re-introspect every session.

---

## Stage 2 — Initial schema design (v1)

### Decision 3 — Three meal statuses

**Decision:** `meal.status` enum of `idea` | `recipe` | `composition`.

**Reasoning:**
- An *idea* is a one-liner ("smoked mackerel salad") — useful in the library and the planner long before there's a recipe written for it.
- A *recipe* is a full, self-contained meal with its own ingredients and method.
- A *composition* is assembled from reusable components via a framework — no method or ingredients of its own at meal level; everything comes from the components.

Each status has a different rendering path. Idea renders name + description. Recipe walks `meal_ingredient` and `meal_step`. Composition walks `meal_component` grouped by framework layer.

**Implication:** Promotion from idea → recipe is a deliberate UX moment, not a silent edit. Shopping list generation treats idea-status meals as flagged-but-non-blocking (you can still generate, but those entries warn that they can't contribute ingredients).

---

### Decision 4 — Component-and-framework model

**Decision:** Components are first-class entities, registered against one or more framework layers. Compositions pick one component per layer (or several where the layer allows multiples).

**Six seeded frameworks:**
1. Component-based dinner — base / topping/carb / veg / finisher
2. Bento — anchor protein / carb / veg-or-salad / small extras
3. Breakfast bowl — base / protein / veg / extras
4. Mason jar salad — dressing / hardy veg / grain-or-protein / leaves
5. Smørrebrød — bread / spread / topping / garnish
6. Mezze — dips / salads-or-veg / protein / bread / pickles-or-extras

**Reasoning:** Most evening meals slot cleanly into "base + topping + veg + finisher", and most lunches into one of the other five. Modelling those patterns explicitly means the composition builder can present the right slots and the library can be filtered by layer ("show me all the bases").

**Implication:** Components live in their own table, not embedded in meals. A single component (e.g. "sesame spinach") can be a veg/salad in bento *and* a vegetable layer in dinner — `component_layer` join supports many-to-many.

---

### Decision 5 — Dietary category as a ranked hierarchy

**Decision:** `dietary_category` lookup with a `rank` column. Vegan(1) < Vegetarian(2) < Pescatarian(3) < Meat(4).

**Reasoning:** Group-suitability becomes one query — "what can everyone eat tonight?" is `meal.rank <= MIN(rank of all diners)`. No tag-matching gymnastics, no special cases for adding a vegan friend to dinner.

**Implication:** A meal's category is the *least restrictive eater* who can eat it. Vegan dishes are classified `vegan`, not `vegetarian` — the rank query relies on that.

---

### Decision 6 — Dietary restrictions as a "contains" axis, not "free-from"

**Decision:** `dietary_restriction` lookup records what a meal *contains* (dairy, gluten, nuts, etc.). "Dairy-free" filters are the negation — no row in `meal_restriction` referencing dairy.

**Reasoning:** Storing "contains" lets meals be tagged once, and filters compose by absence. Storing "free-from" would mean every meal needs every relevant tag explicitly, which doesn't scale and is failure-prone (forgetting to mark something dairy-free doesn't make it dairy-bearing — it makes the data wrong).

**Implication:** Required seeds at v1 install included dairy. The rest (gluten, nuts, eggs, soy, shellfish, peanuts, sesame) were flagged but not seeded — picked up later as a v2 fix.

---

### Decision 7 — Cuisines consolidated, no regional splits

**Decision:** Single cuisine values — British, Italian, Japanese, Levantine, Scandinavian, etc. — not regional breakdowns.

**Reasoning:** Personal use, two diners. "Italian" is granular enough; "Tuscan vs Sicilian" is overhead with no payoff.

**Implication:** Trivially extensible if it ever matters. A migration adding regional sub-cuisines is one ALTER and a backfill.

---

### Decision 8 — Person table separate from auth.users

**Decision:** `person` is application-level domain data (who eats what). `auth.users` is Supabase Auth, managed separately.

**Reasoning:** Diners are not the same as users. Future guests, family, friends who eat with the household but never log in still need to be plannable. Forcing every diner to be an auth user couples two different problems.

**Implication:** A bridge column (`auth_user_id uuid REFERENCES auth.users(id)` on `person`) was flagged as a clean future extension when per-user logic became useful. Initially deferred.

---

### Decision 9 — Shopping list persisted, with derived/manual distinction

**Decision:** `shopping_list` and `shopping_list_item` tables. Items carry `source` IN ('derived', 'manual'). Two flags: `is_checked` ("in basket") and `is_in_stock` ("skip, already have it"). Regeneration deletes derived items and reinserts; manual items survive.

**Reasoning:** The list is fundamentally a query, but tick-off behaviour, manual additions, and "I already have this" all need persistence. Without the source distinction, regenerating after adding a meal to the plan either nukes manual items or duplicates derived ones.

**Implication:** The generation algorithm is a recursive walk into composition meals' components. Idea-status meals produce a warning, not an error — the list still generates, with those entries flagged.

---

## Stage 3 — First DDL pass and RLS

### Issue 1 — `CREATE POLICY IF NOT EXISTS` doesn't exist in Postgres

**Symptom:** Running the initial RLS script returned `syntax error at or near "NOT"` on the `CREATE POLICY IF NOT EXISTS` line.

**Cause:** Claude conflated `CREATE POLICY` with `CREATE TABLE IF NOT EXISTS`. Postgres supports `IF NOT EXISTS` on tables, indexes, and a few other DDL statements, but not on `CREATE POLICY` — even in version 15+.

**Fix:** Use `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` inside the loop. Same idempotent re-run behaviour, valid syntax.

**Implication:** The corrected RLS script became the canonical version. Future RLS rewrites use the same drop-then-create pattern.

---

### Decision 10 — Single permissive RLS policy for v1

**Decision:** Every table in `public` gets RLS enabled and one policy: `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.

**Reasoning:** Personal household app. Both diners share all data freely within the app. The security boundary that matters is "logged in vs not logged in" — the Supabase anon API key (visible in client-side code) must not read or write anything.

**Implication:** This locks the app behind login for everything. Later flagged as inconsistent with the requirements doc's stated intent of public reads on the library — see Issue 4 below, addressed properly in the v2 schema.

---

### Issue 2 — Lovable Knowledge feature, not DDL comments

**Symptom:** Initial assumption was that the top-of-DDL comment block would inform Lovable's code generation. It doesn't.

**Cause:** The DDL is run against Supabase; Lovable knows the schema only by introspecting the live database, which it doesn't always do reliably, and it certainly doesn't read intent or conventions from SQL comments.

**Fix:** Lovable's Knowledge feature (a project-level text area, exact label varies) is the right home for standing instructions. The top-of-DDL block was expanded to do double duty — same text in both places, single source of truth.

**Key content for the Knowledge entry:**
- Project context (two-person household, React + Tailwind + Supabase, learning project)
- Domain summary (three meal statuses, components-and-frameworks, ranked dietary categories, contains-axis restrictions)
- Conventions: schema is read-only to Lovable, do not modify tables or RLS, build vertical slices, use real data
- The "do not modify schema" line was singled out as the most valuable single instruction

**Implication:** Schema-summary-in-Knowledge is now standard practice. Updated whenever the schema changes materially.

---

## Stage 4 — Requirements consolidation

### Decision 11 — Requirements doc as the working spec

**Decision:** Maintain a single `requirements.md` with versioned drafts (v0.1 → v0.4) rather than scattering decisions across chat history.

**Reasoning:** The schema is the source of truth for *structure*. The requirements doc is the source of truth for *intent* — what the app is for, who uses it, what's in and out of scope. Without it, every schema-change discussion starts from first principles.

**Implication:** Updated alongside every material design decision. Version bumps mark significant scope changes.

---

### Decision 12 — Add meal_cooked_log, component_family, side/dessert meal types

**Decision:** Three additions to the v1 schema after requirements review.

- **`meal_cooked_log`** — historical record of actual cook events with date, diner, rating, notes. Feeds back into library filters ("things we've rated 4+", "haven't cooked in 3 months").
- **`component_family`** — sub-grouping within a layer for UI clustering (e.g. "mash family" inside the dinner *topping* layer).
- **Side and dessert meal types** — added to the seed list. Meal plans want to record sides explicitly rather than bury them in notes.

**Deferred:** meal variants (Jane's vs Mike's version of the same dish), ingredient quality notes, photos, equipment notes. All flagged as cheap to add later without disruption.

---

### Issue 3 — Initial DDL had no ownership columns

**Symptom:** When portfolio considerations came up, the v1 schema had no `household_id` on writable tables.

**Cause:** v1 was scoped to a single household. Ownership columns weren't on the radar.

**Fix:** Flagged for action *before* the schema went into Supabase. Cheap-now/expensive-later — adding a column to ~26 tables empty is a five-minute edit; adding it after data is loaded is migration work.

**Implication:** Addressed in the v2 rewrite. Every writable content/state table got a `household_id INTEGER NOT NULL REFERENCES household(id) DEFAULT 1`. Vocabulary tables (`ingredient`, `ingredient_category`, `ingredient_alias`) deliberately not scoped — universal vocabulary.

---

### Issue 4 — RLS contradicted the stated read model

**Symptom:** Requirements doc said read access was unrestricted. RLS script enabled auth-only access to everything.

**Cause:** The v1 RLS was written before the public-read decision was locked. The requirements were written after Claude had moved on.

**Fix:** Locked the per-table read decisions in §6.3 of the requirements:
- **Library** (meals, components, ingredients, frameworks, all lookups): public read.
- **Plan tables** (meal_plan, meal_plan_entry, cooked_log, person): public read.
- **Writer-only**: shopping_list, import_log, household, app_writer.

**Implication:** Required a full RLS rewrite in v2 — three policy classes instead of one. The single permissive policy approach was retired.

---

### Decision 13 — Portfolio-ready foundations

**Decision:** Five things treated as cheap-now/expensive-later, locked in before installing the schema:

1. **Ownership columns** on every writable table (`household_id`).
2. **Writers as a database table** (`app_writer`) linking `auth.users` to household and optional person — not a hardcoded list.
3. **Per-table public-read decisions** (per Issue 4 above).
4. **Repo and naming hygiene** — pick a name, decent commits from the first one, README, no secrets in repo, public from day one.
5. **Build journal** — these very logs. The story of building this with AI is the portfolio asset, possibly more than the app itself.

Everything else portfolio-related (landing page, demo dataset, case study write-up, custom domain) is retrofittable.

**Implication:** Items 1–3 became schema work in v2. Items 4–5 are process commitments.

---

### Issue 5 — Ingredient matching strategy needed locking

**Symptom:** The requirements doc didn't say how the import flow would match `"red onion, finely diced"` against the master ingredient list.

**Cause:** Initially deferred as "consider substitution links" — too vague.

**Fix:** Human-in-the-loop, documented in §3.8 of v0.3:
1. Prep-note suffix stripping (`"red onion, finely diced"` → `"red onion"`).
2. Exact match against canonical name and aliases.
3. Trigram fuzzy match (via `pg_trgm`) if no exact hit; top 3 candidates surfaced.
4. Operator confirms top match, picks an alternative, or creates a new ingredient.

**Implication:** Required `pg_trgm` extension and trigram indexes in the v2 install. No silent auto-matching.

---

### Decision 14 — Per-person macro tracking added back to v1 scope

**Decision:** Add nullable macro columns (`protein_g`, `carbs_g`, `gi_index`) to `meal` and `component`. Brought back into scope from the original "deferred to Claude in chat" framing.

**Reasoning:** The original deferral assumed macros were a single-meal property the operator could eyeball in conversation. "Did I get enough protein this week?" reframes it as a daily-aggregation question Claude-in-conversation can't serve. That use case justifies the columns.

**Aggregation rule:** report "X g across N of M tracked meals" — explicit about coverage, no false precision from null = 0 assumptions.

**Implication:** Added to v2 schema. No ingredient-level nutrition data — that's the post-v1 ingredient-level option (~200 ingredients × unit conversion overhead, deliberately deferred).

---

## Stage 5 — Decisions deferred to post-v1

For reference, things actively decided *against* v1 inclusion:

- Auto-calculated nutrition from ingredient data — too much data-entry overhead.
- Recipe import from URLs.
- Image-based recipe import — explicitly off the roadmap.
- Pantry/staples awareness on shopping list.
- In-app Claude integration (recipe development from inside the app).
- Ingredient substitutions.
- Multi-household / multi-tenant data isolation — schema ready, policies and UI deferred.
- Meal variants (Jane's-version vs Mike's-version of one dish).
- Plan templates / favourite rotations.

The schema is designed to *accept* these as additive changes, not requiring restructure.

---

## Stage 6 — Migration off Lovable (between F1 and F2)

F1 (Meal Library) shipped from Lovable. The decision to migrate came at the F1 retro, before F2 planning started. The migration itself is captured in `migration_log.md`; the decisions and their reasoning live here.

### Decision 15 — Cut over to local Claude Code + Vercel + self-owned Supabase

**Context:** Two things became clear during F1.

First, Lovable round-trips poorly with externally-made changes. Edits made in Lovable's IDE are fine; edits made anywhere else confuse it. That's a structural mismatch with the import-heavy work in F2, where Claude-driven file edits are the point.

Second, the Supabase project was sitting inside Lovable Cloud — discovered mid-cutover when we tried to point local dev at "the" Supabase URL and it wasn't where we thought. Lovable Cloud is fine until the day you want to leave it; on that day, it's an extra migration step.

**Options considered:**
- **Stay in Lovable.** Continue with the original "switch when complexity hits a wall" trigger. Defensible but kicks the question down the road; F2's import flow is exactly the kind of schema-aware, multi-file work Lovable is weakest at.
- **Local Claude Code, keep Lovable hosting.** Edit locally, push to GitHub, let Lovable redeploy. The round-tripping problem doesn't go away — Lovable still tries to manage the codebase it doesn't own.
- **Local Claude Code, Vercel hosting, self-owned Supabase.** Clean break. GitHub becomes the source of truth; Vercel auto-deploys; Supabase lives in Mike's own account. Lovable falls out of the picture entirely.

**Choice:** Option 3.

**Implication:** Decision 1's "Lovable as starting tool" is now historical. Decision 2's "Lovable's Knowledge feature carries a condensed schema summary" no longer applies — Claude Code reads project knowledge directly, and the standing brief now lives in the renamed `lovable_project_knowledge_post_migration.md` (filename kept for lineage; contents reframed for any AI editor reading it).

---

### Issue 6 — RLS without table grants returned "permission denied"

**Symptom:** F1's library page failed for both unauthenticated and authenticated users with `permission denied for table meal`.

**Cause:** RLS policies were created but the underlying table privileges (`GRANT SELECT ... TO anon, authenticated`) were not. Postgres requires both. The v2 install script created the policies but not the grants.

**Fix:** Added Section 14 to the install script (grant block for anon and authenticated). First baked into `recipe_db_install_v2_post_f1.sql`, then extended for F2 in `recipe_db_install_v3.sql`.

**Implication:** RLS and role grants are paired concerns. Future RLS changes need a paired grants review.

---

### Issue 7 — Lovable Cloud Supabase, not where we thought it was

**Symptom:** Mid-cutover, attempting to wire the local dev environment to "the" Supabase project surfaced that there was no separate Supabase project — the database lived inside Lovable Cloud.

**Cause:** Lovable provisions Supabase implicitly on the user's behalf, behind a Lovable-managed layer. Easy to forget when you've been thinking "Supabase = my Supabase account".

**Fix:** Created a fresh Supabase project under Mike's own account, ran the v2_post_f1 install script against it, exported and imported the F1 data, repointed local dev and Vercel env vars. The old Lovable Cloud database is left intact but unused.

**Implication:** Worth knowing in advance for anyone else doing this cutover. The Supabase-in-Lovable-Cloud arrangement is invisible until you try to leave.

---

### Decision 16 — Documentation naming convention going forward

**Decision:** Doc files use a `_post_<milestone>` suffix to mark revisions. Original file kept as historical artefact; new file is the working copy.

**Examples in use:**
- `requirements.md` → `requirements_post_f1.md` → `requirements_post_migration.md`
- `planning_log.md` → `planning_log_post_migration.md` (this file)
- `lovable_project_knowledge.md` → `lovable_project_knowledge_post_f1.md` → `lovable_project_knowledge_post_migration.md` (filename keeps "lovable" for lineage; contents reframed)

**Reasoning:** Keeps the lineage visible in the file listing. Cheaper than maintaining diffs by hand.

**Implication:** When the next milestone lands (F2 close-out), the next set of `_post_f2` files supersede these. Older versions stay in project knowledge as historical record.

---

## Carry-forward to schema v2

Things flagged during planning that became schema work in v2:

- Add `household` + `household_id` columns across writable tables.
- Add `app_writer` table.
- Rewrite RLS to match per-table public-read decisions.
- Seed the rest of `dietary_restriction` (gluten, nuts, eggs, soy, shellfish, peanuts, sesame).
- Add structured steps (`meal_step`, `component_step`) — flagged when example recipes were reviewed and the single `method TEXT` blob proved inadequate.
- Add ingredient master (`ingredient`, `ingredient_category`, `ingredient_alias`) — required for shopping-list aggregation and import flow.
- Add `external_ref` slug on meal and component for import idempotency.
- Add `nutritional_tag` lookup + join tables, replacing the boolean `omega3_strong`.
- Add macro columns on meal and component.
- Add `import_log` table for audit trail.

These all landed in `recipe_db_install_v2.sql`. See the schema build log for the rewrite specifics. Subsequent grant work for F1 and F2 landed in `recipe_db_install_v3.sql`.

---

## Carry-forward into F2

Open items going into F2 planning:

- Composition of the import flow: parser, ingredient-matching UI, audit trail wiring. Mostly Claude Code work now.
- Whether to bake the F1 round-tripping fixes (the routing fixes from `build_log_post_f1.md`, issues 6 and 7) into Claude Code's understanding of the codebase before F2 starts.
- Production smoke-test cadence — whether to manually verify Vercel after each merge or trust local dev.
- An ingredient-master "warm-up" pass before the import flow: get the seeded staples reviewed, fill in obvious gaps from the breakfast/lunch/dinner docs, lock canonical names.
