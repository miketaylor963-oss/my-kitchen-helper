# Planning Log

A record of decisions, revisions, and issues across the life of the project. Covers tool choice, domain modelling, the schema v1/v2 work, the F1 build's tooling lessons, the cutover from Lovable to local Claude Code + Vercel, and F2 planning.

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

## Stage 7 — F2 planning

F1 (Meal Library) shipped from Lovable, then the codebase migrated to local Claude Code + Vercel + self-owned Supabase (Stage 6). F2 planning started against the clean post-migration state.

The four open items from "Carry-forward into F2" framed the agenda. Three resolved cleanly; one (Claude Code prompt patterns) was explicitly deferred until 2A is underway.

### Decision 17 — Ingredient-master warm-up done in chat before any 2A code

**Context:** v3's seeded ingredient list was 55 entries — drawn entirely from the four example recipes already converted (houmous, shepherd's pie, butter bean loaf, black bean patties). The breakfast/lunch/dinner source docs name a much wider vocabulary that the warm-up was always meant to cover.

**Choice:** Work through the gaps category by category in chat, confirming canonical names, default units, dietary categories, aliases. No app UI involved — pure hand work between Mike and Claude, then output as SQL.

**Output:** 227 canonical ingredients + 26 aliases, up from 55 + 4. Two SQL files produced:
- `recipe_db_install_v3_ingredients_warmup.sql` — additive, safe to run against the live v3 database (every insert is `ON CONFLICT DO NOTHING`).
- `recipe_db_install_v3_1.sql` — full canonical install script for from-scratch installs, with the warm-up folded into Section 12 in place.

**Reasoning:** First-import auto-match rate goes up sharply when the canonical vocabulary already covers the household's actual eating patterns. The cost is one chat session; the alternative is the importer's create-new flow firing on ~80% of lines during the first dozen imports.

**Implication:** v3.1 supersedes v3 as the canonical install script. v3 stays in archive for lineage. The schema is unchanged between v3 and v3.1 — only Section 12 seed content differs.

---

### Decision 18 — F2 split into three slices, not two

**Context:** Original plan was two slices: ingredient master + importer combined (2A), then deferred items (2B). Standalone ingredient master CRUD was treated as an inline component of the importer.

**Revised choice:** Three slices.
- **Slice 2A: Standalone ingredient master CRUD page.** Browse, search, filter by category/dietary, view detail, edit, add, alias management, prevent-delete-if-referenced.
- **Slice 2B: Recipe importer.** Paste → validate against contract → match → preview → commit. Reuses Slice 2A's patterns. Recipe-only at this stage; components defer to F3.
- **Slice 2C: Deferred items.** Re-import handling, derived components from recipes, anything surfaced during 2B that wasn't worth blocking on.

**Reasoning:** Slice 2A first means (a) the operator can tidy the 227-row warm-up vocabulary before any importer code runs against it, (b) the importer's "create new ingredient" branch becomes a reuse of an existing CRUD pattern rather than bespoke inline code that gets thrown away later, (c) the vertical slice is genuinely simpler — one entity, no parser, no contract validation, no matching algorithm.

**Implication:** F2 is bigger than originally scoped but lands in three smaller pieces rather than two large ones. Slice 2A is the cleanest possible "first feature on the new stack" — single table, no integration with other features, demonstrably useful on its own.

---

### Decision 19 — Recipes only for F2; components wait for F3

**Decision:** Slice 2B targets `import_type: "recipe"` only. The importer's `import_type: "component"` branch stays unimplemented until F3.

**Reasoning:** Components carry more complexity (registration against framework layers, families, the question of "is this component a meal in its own right"). The composition builder is the natural home for that complexity. Mixing it into F2 inflates scope without a corresponding payoff — recipes are what the household actually cooks day-to-day, and getting them in the library is the higher-leverage F2 outcome.

**Implication:** The JSON import contract stays component-aware (the spec retains the `import_type` field and the component-shape fields). The importer ignores those paths for now. F3 picks them up when components land.

---

### Decision 20 — Content milestone defines "F2 done"

**Decision:** F2 is complete when:
1. All four hand-converted JSONs (houmous, shepherd's pie, butter bean loaf, black bean patties) land cleanly in the library.
2. A set of synthesised edge-case JSONs (no `timer_seconds`, no `notes`, ingredient groups, single-serving, large-batch, 20+ ingredients, unicode in names, etc) all land cleanly.
3. Five web-sourced recipes — sourced as PDFs by Mike, converted to JSON by Claude in a fresh chat — land cleanly.

**Reasoning:** A technical milestone ("the pipeline works") would let a fragile importer pass. The content milestone forces variety: pre-cleaned templates work, synthesised edge cases test the contract's robustness, web-sourced PDFs test the conversion step *and* exercise the matching UI against vocabulary the warm-up didn't seed.

**Two failure modes that come out of the content milestone:**
- *Conversion fails or fudges.* The PDF-to-JSON step (a Claude chat) produces output that doesn't match the template — wrong field names, missing required fields, unresolvable `ingredient_id` references. Signals the template needs clearer guidance or better examples.
- *Conversion succeeds, importer struggles.* Template-valid JSON lands but the matching UI shows lots of red. Signals the importer UX needs work, or warm-up vocabulary gaps.

Both signals are useful; worth logging which one fires when running the test set.

**Implication:** Slice 2A and Slice 2B both have their own "done" definitions:
- *2A done:* CRUD page in production, 227 seeded ingredients browseable, edit/add/alias work end-to-end, prevent-delete-if-referenced enforced.
- *2B done:* the three-source test set above all land.

---

### Decision 21 — Soft delete vs hard delete: prevent delete if referenced

**Context:** Once a recipe references an ingredient via `meal_ingredient.ingredient_id`, deleting that ingredient orphans the reference. Options were prevent (cleanest, most annoying), soft delete with an `is_archived` flag (most flexible), cascade delete (dangerous).

**Choice:** Prevent deletion if referenced. Database-level enforcement via the existing FK constraint; UI surfaces the constraint as a clean error rather than letting the operator try.

**Reasoning:** Soft delete adds a state machine (active/archived) that propagates into every query, search, and shopping-list aggregation. Cascade delete is unsafe. Prevent-if-referenced is the simplest enforceable rule and matches the actual workflow — if you genuinely need to remove a referenced ingredient, you go and clean up the references first.

**Implication:** Slice 2A delete UI shows a clear "in use by N recipes, cannot delete" message when the constraint blocks. Optional follow-up (slice 2C or later): a UI affordance to list the referencing recipes so the operator can decide what to do.

---

### Decision 22 — Merge operation deferred, requirements doc to be updated

**Context:** Two ingredients that should be one ("salt" vs "fine salt", "tomato puree" vs "tomato purée") will eventually appear. The fix is a merge — move all `meal_ingredient.ingredient_id` references from source to target, move all aliases, delete the source.

**Choice:** Defer. Genuinely complicated (transactional, audit-trail-relevant, irreversible) and not blocking for F2. Until merge exists, the only recovery for duplicates is prevention at create-time.

**Implication:** Add to the requirements deferred-items list at F2 close-out. Worth surfacing now so it isn't quietly forgotten.

---

### Decision 23 — JSON conversion happens in fresh chats per stage

**Decision:** PDF → JSON conversion for the web-sourced test recipes happens in a *fresh* chat, not in the chat that builds the importer. Similarly for any other stage that wants AI-assisted work (between 2A and 2B for the conversion pass; during 2B for actual importer build).

**Reasoning:** A fresh Claude with no warm template context tests the conversion path more honestly than this chat, which has been steeped in template details for hours. The point of the test is "what does the AI converter actually produce when it doesn't already know the template inside-out" — that requires a Claude that has to read the spec from the project knowledge / repo, not one that wrote it.

**Implication:** Fresh chats per stage become a habit, not a one-off. Each new chat starts by loading the standing brief + requirements from the GitHub repo (per Decision 25). Less risk of context drift across long sessions, and a cleaner test of whether the project's standing instructions are actually sufficient.

---

### Decision 24 — Web-sourced test recipes target shape variety, not volume

**Decision:** Aim for five web-sourced PDFs deliberately chosen for shape difference. Suggested mix:
- One short recipe (under 8 ingredients, 3–4 steps).
- One long recipe (15+ ingredients, multiple groups).
- One with sub-recipes ("for the marinade…", "for the sauce…").
- One non-British / non-Mediterranean (Korean or Indian — stresses ingredient vocabulary).
- One baking recipe (different unit conventions, weight-precise).

**Reasoning:** Five PDFs chosen for difference beats fifteen of the same shape. The point of the web-sourced set is to stress shapes the four existing JSONs don't already test.

**Implication:** Cookbook-style PDFs produce cleaner conversions than blog-style PDFs (blog recipes carry pre-recipe noise: 2000-word backstory, "Jump to Recipe" anchors, comments). Both are useful inputs — the blog-style ones additionally test conversion robustness against noisy source material.

---

### Decision 25 — GitHub as source-of-truth for project artefacts; folder structure replaces filename suffixes

**Context:** Claude.ai project knowledge is a flat file list — no subfolder support. After F1 and the migration, project knowledge had 27 files at root with `_post_f1` / `_post_migration` / `_v2` / `_v3` suffixes encoding lineage in filenames. The pattern has worked but degrades as features accumulate.

**Options considered:**
- **Continue with filename-suffix versioning.** Defensible — has worked through six stages. But suffix soup grows fastest exactly when context-switching is most expensive (start of a new feature, new chat).
- **Use GitHub as source-of-truth for the artefacts, alongside the existing GitHub-hosted app code.**

**Choice:** GitHub. Public repo. App code and planning artefacts share one source of truth.

**Folder structure:**
```
/
├── current/            ← active source-of-truth files
│   ├── standing_brief.md
│   ├── requirements.md
│   ├── recipe_db_install.sql (currently v3.1)
│   ├── recipe_import_spec.md
│   └── recipe_import_template.json
├── source_recipes/     ← docx source material for the library
├── library_recipes/    ← hand-converted JSONs for production import
├── test_fixtures/
│   ├── edge_cases/     ← synthesised JSONs for Slice 2B testing
│   └── web_sourced/    ← PDFs + converted JSONs
└── archive/            ← superseded versions, kept for lineage
```

**Loading mechanism:** A line in project instructions points fresh chats at the repo and asks for `web_fetch` against the raw URLs of `current/standing_brief.md` and `current/requirements.md` at chat start. Other files fetched as needed.

**Reasoning:** Real folders, real diffs (git log on `recipe_db_install.sql` replaces the v1/v2/v3 filename chain), one place for everything, fresh chats load cleanly via a one-line instruction rather than navigating suffix soup.

**Implication:**
- v3.1 becomes `current/recipe_db_install.sql`; v3 moves to archive.
- `lovable_project_knowledge_post_migration.md` becomes `current/standing_brief.md` (Lovable-free name for a Lovable-free document).
- `requirements_post_migration.md` becomes `current/requirements.md`.
- Older versions retain their suffix-laden names in `archive/` — names carry timeline information that renaming to v1/v2/v3 would lose.
- The warm-up SQL (`recipe_db_install_v3_ingredients_warmup.sql`) moves to archive once the live database has been brought to v3.1 state — it's served its purpose.
- GitHub repo setup happens as a standalone short chat between this one and Slice 2A. Slice 2A starts fresh against the clean structure.

---

### Decision 26 — Slice-done checklist in project instructions

**Decision:** A four-item checklist for "slice done" goes into project instructions, applying across all chats in the project.

**The checklist:**
1. Code shipped to production (Vercel deploy completes, manual smoke-test passes).
2. Slice's specific demo runs cleanly (e.g. for 2A: all 227 ingredients browseable; for 2B: the full test set lands).
3. Build log updated with decisions and issues from the slice.
4. Standing brief updated if anything material changed.

**Reasoning:** Item 4 is the one most easily skipped and most expensive to skip — silent drift between the brief and reality is what made the suffix-soup project-knowledge state worse over time. Forcing an explicit check at slice-end is the cheapest preventive measure.

**Implication:** Project instructions take one update at GitHub-setup time covering: the repo URL + load-on-startup line (Decision 25), the slice-done checklist (this decision), and a light version of the Claude Code prompt discipline (one-paragraph, refined later — see Decision 27).

---

### Decision 27 — Claude Code prompt patterns: defer and discover during 2A

**Context:** F1's `feature_01_meal_library_prompts.md` emerged from doing F1, not from planning it — patterns crystallised after running into things that didn't work. Pre-writing equivalent patterns for Claude Code carries the same risk inverted: planning patterns before knowing what fails.

**Choice:** Start 2A with a light one-paragraph standing-brief note on prompt discipline ("narrow scope, commit per working chunk, surface schema-touching questions, don't act on them") and let proper patterns emerge from actual 2A work. Write them up properly at 2A close-out when there's real material to draw on.

**Reasoning:** Defer-and-discover beats plan-and-hope when the tooling specifics aren't yet familiar. Claude Code is different enough from Lovable that pre-writing patterns risks being wrong in ways that can't be predicted from outside.

**Implication:** Light prompt-discipline paragraph goes into project instructions at GitHub-setup time. Full prompt-pattern document gets written at the F2 close-out as part of the Slice 2A build log retro.

---

### Decision 28 — Process commitments: smoke-test cadence and log continuity

**Decision:** Three small process commitments going into Slice 2A:
- **Smoke-test cadence.** Manual click-through in the deployed Vercel app after every deploy. Five minutes per deploy. Lightweight, but explicit — the question "did the thing I built actually reach production" gets a deliberate answer rather than an assumed one.
- **Build logs and planning logs continue.** Same format as F1 (`build_log_post_f1.md` as template). One planning log per feature, one build log per feature. Both live in `current/` alongside the standing brief and requirements.
- **Slice-done checklist enforced** (per Decision 26).

**Reasoning:** None of these is a new idea. The point of writing them down is so they're not quietly skipped during a busy build.

**Implication:** Nothing new to build; just commitments to keep.

---

## Carry-forward into Slice 2A

Open items going into Slice 2A:

- GitHub repo setup as a standalone short chat: create repo, structure folders (per Decision 25), upload existing artefacts into them, push v3.1 as `current/recipe_db_install.sql`, archive v3 and the warm-up add-on.
- Update project instructions: repo URL + load-on-startup line, slice-done checklist, light prompt-discipline paragraph.
- Slice 2A scope confirmed: browse / search / filter / view / edit / add / alias management / prevent-delete-if-referenced. Explicitly out: merge, soft delete, bulk operations, audit trail.

## Carry-forward to F2 close-out

Items flagged for capture when F2 is done:

- Add **merge operation** to the requirements deferred-items list (per Decision 22).
- Add **soft-delete / archive flag** consideration to the requirements deferred-items list — only relevant if prevent-delete-if-referenced becomes annoying in practice.
- Add **bulk operations on ingredients** (bulk edit, bulk re-categorise) to the deferred-items list.
- Write the **full Claude Code prompt patterns document** as the F2 close-out artefact, replacing the light paragraph in project instructions with a proper feature-prompts file (mirroring F1's `feature_01_meal_library_prompts_post_f1.md`).
- **Update the standing brief and requirements** to reflect the F2 ingredient master and recipe importer as built — including any decisions taken during 2A and 2B that don't appear here.
- **Move the warm-up add-on SQL to archive** once the live database is on v3.1 state.

---

## Stage 8 — F2 pre-work: deploy infrastructure correction

A new chat started for F2 work loaded the standing brief and requirements per Decision 25, then discovered the deployed app URL returned 404. Investigation surfaced a sequence of misconceptions about the stack and deploy target carried from the Lovable era. None of the actual F2 work landed in this stage — every hour went to deploy infrastructure. Captured here in full because the misconceptions were load-bearing and the gotchas may catch others taking similar routes.

---

### Decision 29 — Make the GitHub repo public

**Context:** Decision 25 established GitHub as source-of-truth and pointed fresh chats at raw URLs via the project instructions' load-on-startup step. At the start of Stage 8 the load-on-startup step failed: the repo was private, so `web_fetch` against the raw URLs returned 404 (private repos require authenticated requests, which `web_fetch` can't make). The standing brief and requirements weren't loadable without manual workarounds.

**Options considered:**
- **A. Make the repo public.** Restores the intended load-on-startup workflow. Means anything ever committed is permanently visible.
- **B. Keep private, upload key docs as Project knowledge files.** Workaround. Requires re-uploading after every change.

**Choice:** A. Repo flipped to public after auditing for committed secrets.

**Reasoning:** The credentials in `.env` (the only file remotely sensitive) decode to Supabase's anon publishable key — designed to be public, RLS does the protecting. The service role key is not and has never been in the repo. With the editing model now being Claude Code (each commit individually approved) plus Vercel/Cloudflare (read-only consumers of the repo), the "secrets get pushed silently" risk that justified caution earlier no longer applies. Public also makes the project usable as a portfolio piece later without re-flipping.

**Pre-flip hygiene:** Added `.env`, `.env.*`, `!.env.example` to `.gitignore`. Untracked `.env` from history via `git rm --cached`. Verified no service role keys or LLM API keys anywhere in the tree.

**Implication:** The load-on-startup workflow now works as designed. New gitignore conventions documented in the standing brief.

---

### Issue 8 — `.env` was tracked in history despite being a credentials file

**Symptom:** Pre-flip secret audit revealed `.env` had been committed at some point during the Lovable era. The current `.gitignore` covered `*.local` (catching `.env.local`) but not `.env` itself.

**Cause:** Lovable's initial scaffold didn't include `.env` in `.gitignore`. The file was committed once, then sat in the repo with its anon-key contents.

**Fix:** Sequence run by hand:
1. Added `.env`, `.env.*`, `!.env.example` to `.gitignore`.
2. `git rm --cached .env` to untrack without deleting the local copy.
3. `git pull --rebase` to reconcile with remote (which had diverged via a web-edit commit).
4. The rebase aborted because the historical state being replayed wanted to check `.env` back out, and the local working tree had a `.env` it wouldn't clobber. Moved `.env` outside the repo (`mv .env ../env-backup`), re-ran the rebase, restored `.env` afterwards.
5. Re-appended the gitignore lines (lost in the rebase) — one of the `echo` lines failed because Bash interpreted `!` as history expansion. Quoted with single quotes.
6. Committed and pushed clean.

**Implication:** Future projects start with `.env` in `.gitignore` from commit 1. The anon-key-only state of this `.env` meant nothing sensitive was actually exposed, but the cleanup pattern (`git rm --cached` + restore-outside-repo for the rebase) is worth knowing — it comes up any time you remove a tracked file that the working tree still needs.

---

### Issue 9 — Standing brief and requirements both described the wrong stack

**Symptom:** Standing brief §12 and requirements §5.1 described the stack as "React + Tailwind on Vite" with Vercel as the deploy target. The actual codebase is TanStack Start (a full-stack React framework with file-based routing, server functions, and SSR) + Tailwind v4 + Vite, originally targeting Cloudflare Workers via Lovable's bundled config plugin `@lovable.dev/vite-tanstack-config`.

**Cause:** Lovable shipped a more opinionated stack than the docs captured. The wrapper config hid that TanStack Start + Cloudflare were the real foundations — the user-facing `vite.config.ts` was a thin shim. "Migrated to Vercel" was assumed to mean working on Vercel; in fact no Vercel deploy had ever rendered the app.

**Fix:** Documented stack corrections rolled into Stage 8 close-out updates to the standing brief and requirements.

**Implication:** The "moved to Vercel" entry in prior chat memory was misleading. Decision 15's Vercel commitment is partially superseded — see Decision 32.

---

### Decision 30 — Cut the Lovable config wrapper

**Context:** `@lovable.dev/vite-tanstack-config` bundled `tanstackStart`, `viteReact`, `tailwindcss`, `tsconfigPaths`, the Cloudflare Vite plugin, dev-only Lovable instrumentation, and various opinionated defaults into a single importable. Working under it meant inheriting all of them and not being able to change any one independently.

**Choice:** Replace with direct imports of each plugin in `vite.config.ts`. Remove `@lovable.dev/vite-tanstack-config` from dependencies entirely.

**Reasoning:** Lovable is no longer the editing tool (per Decision 15). The wrapper added a layer of indirection with no remaining payoff. Direct config is the same number of lines, more readable, and lets individual plugins be swapped without touching a third-party shim.

**Implication:** `vite.config.ts` is now ~22 lines of plain Vite config. `src/server.ts`, `src/lib/error-capture.ts`, and `bunfig.toml` were also cut as Lovable-era artefacts. `src/lib/error-page.ts` retained — `src/start.ts` references it for branded SSR error rendering, which is platform-agnostic and useful.

---

### Issue 10 — Vercel can't serve TanStack Start (this version) without adapter work

**Symptom:** With the Lovable wrapper and Cloudflare plugin removed, Vercel deployments built successfully but every URL returned 404. `dist/client/` contained only an `assets/` folder — no `index.html`.

**Cause:** TanStack Start at v1.167.50 (the installed version) produces SSR-only output: `dist/client/` for client assets, `dist/server/server.js` for the runtime SSR handler. There's no pre-rendered HTML. Vercel can run Node functions, but only with a `vercel.json` and an entry shim mapping Vercel's Node function shape to whatever `dist/server/server.js` expects — adapter work the framework doesn't ship at this version. Newer TanStack Start versions include first-party platform presets via Nitro; this one doesn't.

**Fix:** Reverse course back to Cloudflare. See Decision 31.

**Implication:** Vercel is a viable target if the project later upgrades TanStack Start. Not today.

---

### Decision 31 — Restore Cloudflare deployment support without the Lovable wrapper

**Context:** Cloudflare is the framework's native target via `@cloudflare/vite-plugin`. The Lovable wrapper had been wiring this up under the hood; cutting it (per Decision 30) removed the Cloudflare plugin alongside the Lovable indirection.

**Choice:** Re-add `@cloudflare/vite-plugin` directly to `package.json`. Restore `wrangler.jsonc` and a minimal `src/server.ts` (a one-liner re-exporting TanStack Start's server entry — the previous elaborate error-wrapping is now handled platform-agnostically by `src/start.ts`'s middleware).

**Reasoning:** Path of least resistance to a working deploy. The framework already targets Cloudflare; restoring the plugin without the wrapper is a minimal change. The branded error handling moved into the framework's middleware layer during Decision 30's clean-up, so the original server.ts's custom h3-error-swallowing detection isn't needed anymore.

**Implication:** The repo carries Cloudflare-specific config again, cleanly. Sets up the choice of *which* Cloudflare product to deploy to — see Issue 11.

---

### Issue 11 — Cloudflare Pages doesn't understand TanStack Start's build output

**Symptom:** First Cloudflare attempt used Pages. Build succeeded; deploy uploaded 44 static files; production URL returned 404. Build logs showed: `A Wrangler configuration file was found but it does not appear to be valid. Did you mean to use wrangler.toml to configure Pages?` and `No functions dir at /functions found. Skipping.`

**Cause:** Cloudflare Pages expects a static-with-functions layout — either a `functions/` directory of route handlers, or a `wrangler.toml` with `pages_build_output_dir` pointing at a folder structured as `<dir>/_worker.js` plus assets. The `@cloudflare/vite-plugin`'s output (a Worker-shaped bundle in `dist/server/` plus assets in `dist/client/`) doesn't match either. Pages fell back to static-only mode, uploaded the client assets, and silently dropped the Worker.

**Fix:** Switch from Pages to Workers. See Decision 32.

**Implication:** Pages is the wrong product for SSR-via-Vite-plugin builds. It works for static sites and for simple Functions-based dynamic routes; not for full SSR frameworks where the build tooling produces Worker-shaped output.

---

### Decision 32 — Deploy to Cloudflare Workers via Workers Builds

**Context:** Three options after Pages was rejected:
- **A. Stay on Pages, add a `wrangler.toml` and restructure the build output to match Pages' expectations.** Possible but working against the grain — the framework's plugin doesn't ship Pages-shaped output and there's no clean way to coerce it without writing a post-build step.
- **B. Cloudflare Workers via manual `wrangler deploy` from CLI.** Works but loses Git-connected builds — every deploy would require a local terminal run.
- **C. Cloudflare Workers via Workers Builds.** Git-connected; same workflow as Pages but pointed at Workers rather than Pages. Deploy command is `npx wrangler deploy` rather than Pages' automatic upload.

**Choice:** C.

**Reasoning:** Cloudflare has been steering SSR frameworks toward Workers + Static Assets over Pages for the last 12-18 months. Workers Builds gives the same Git-push-to-deploy experience as Pages with native support for the bundle shape the framework's plugin produces. Cloudflare's dashboard pushed toward Workers during initial setup — consistent signal.

**Implication:** Supersedes the Vercel side of Decision 15. Deploy target is Cloudflare Workers; production URL is `https://my-kitchen-helper.mike-taylor963.workers.dev`. The Vercel project still exists but is dead — flagged for deletion at Stage 8 close-out.

---

### Issue 12 — Cloudflare Workers Builds hardcodes `bun install --frozen-lockfile`

**Symptom:** Every Cloudflare build failed before reaching the user's build command, with `bun install v1.2.15 ... lockfile had changes, but lockfile is frozen`.

**Cause:** Cloudflare Workers Builds runs a pre-install step before the user-specified build command. It auto-detects Bun and uses it when present, with `--frozen-lockfile`. The dashboard exposes no field to override the install command or the package manager. The `packageManager` field in `package.json` is ignored. Prefixing the build command with `npm install` has no effect because the pre-step fails first. The Lovable-era `bun.lock` had drifted out of sync with `package.json` after the wrapper removal in Decision 30.

**Fix:** Generate a fresh `bun.lock` locally (via `bun install`) and commit it. Cloudflare's frozen-lockfile install then succeeds — Bun installs the same `node_modules` from `package.json` that npm would, and the user build command (`npm install && npm run build`) runs cleanly after.

**Implication:** The repo now carries both `package-lock.json` and `bun.lock`. npm remains the local dev tool. Whenever dependencies change, `bun install` needs running locally before commit so the lockfiles stay in step. Documented in the standing brief as a deploy gotcha.

---

### Issue 13 — `.env` pointed at a Supabase project that no longer exists

**Symptom:** Once the build and deploy worked, the deployed app loaded but every Supabase request failed with `ERR_NAME_NOT_RESOLVED`. The hostname in `.env` (`rzndxshqrkofrnpybghq.supabase.co`) didn't resolve.

**Cause:** The committed `.env` values pointed at a Supabase project that was either never the live one or was deleted at some point in the Lovable handoff. The actual live Supabase project (where the schema was installed and F1 data lives) is at a different ref (`hpryimdnqsfegishuyfo`) and uses the newer `sb_publishable_*` key format rather than the legacy JWT format. Local dev had been using `.env.local` (gitignored, correct values), masking the problem during F1.

**Fix:** Updated `.env` to the live project's values. Updated Cloudflare Workers Build variables and Runtime variables to the same values. Triggered a rebuild.

**Implication:** Two corrections worth carrying forward. First: `.env` is now correct, but is not the authoritative source for production — the Cloudflare dashboard is. Second: the standing brief should document the env var workflow explicitly (build vs runtime variables, where each is needed, the fact that `VITE_*` vars are baked at build time and need to be set in Build settings to reach the client bundle).

---

### Issue 14 — Supabase auth URLs scoped to localhost only

**Symptom:** Magic link emails arrived correctly but the link redirected to `localhost`, which refused the connection from any non-local browser.

**Cause:** Supabase Auth's "Site URL" and "Redirect URLs" were configured for local dev only. The deployed Cloudflare URL was never added.

**Fix:** Set Site URL to the production Workers URL; added both the production URL and `http://localhost:5173/**` as allowed Redirect URLs (with wildcard paths) so local dev continues to work.

**Implication:** Adding a new environment (preview deploys, custom domain) means revisiting this setting. Documented as a checklist item in the standing brief.

---

### Decision 33 — Slice-done bookkeeping treats this as a complete slice on its own

**Context:** This stage produced no F2 feature code. But it's a substantial, decision-heavy piece of work that updates the stack description, deploy target, and environment configuration — all things that affect every slice after it.

**Choice:** Treat it as its own slice for close-out purposes. Run the four-item checklist from Decision 26 against it: deployment ✓ (the app is live), demo ✓ (F1's meals load against the live Supabase, magic link auth works), planning log updated (this entry), standing brief and requirements updated (Stage 8 close-out).

**Reasoning:** Folding this into Slice 2A's eventual close-out would obscure how much of "F2" was actually infrastructure correction. Calling it out explicitly keeps the record honest and makes it easier to spot if similar pre-work shows up before F3.

**Implication:** Slice 2A starts from a clean, documented baseline. No carry-forward debt from Stage 8 into 2A itself.

---

## Carry-forward to Slice 2A (revised)

The original carry-forward list from Stage 7 remains valid. Stage 8 additions:

- Slice 2A development assumes Cloudflare Workers as the deploy target. Local dev unchanged (`npm run dev`); production deploys via push to `main`.
- `bun.lock` requires refreshing locally whenever dependencies change. Workflow: `bun install`, commit the updated lockfile alongside `package-lock.json`.
- Env var changes for production go through the Cloudflare dashboard (both Build and Runtime sections). `.env` is local-dev only.
- The Vercel project is dead and needs deleting — non-blocking but worth doing during Slice 2A to avoid future confusion.

## Stage 9 — F2 build: ingredient master and import flow

The deferred actual feature work begins here. Stage 8 closed out the deploy infrastructure; this stage builds 2A (ingredient master) and 2B (recipe importer) as a sequence of narrow slices.

---

### Slice 2A.1 — Ingredient master, read path

**Built:** browse view at `/admin/ingredients` with search (canonical + aliases), `ingredient_category` and `dietary_category` filters, sorted by category sort_order then alphabetic. Details in `current/build_log_f2.md`.

#### Decision 34 — Split 2A into four sub-slices

**Context:** 2A as originally scoped (browse / search / filter / view / edit / add / alias / safe-delete) is too broad for a single Claude Code prompt under the project's narrow-prompt discipline.

**Choice:** Split into four:
- 2A.1 — read path *(this slice, complete)*.
- 2A.2 — detail view + edit form (auth-gated).
- 2A.3 — create + alias management.
- 2A.4 — safe-delete (prevent if referenced).

**Reasoning:** Each is independently demonstrable and small enough to prompt cleanly. The read path comes first because it needs no auth, has real seeded data to render, and surfaces routing/data-fetching patterns before the write path multiplies them.

#### Decision 35 — Admin section in nav for reference data and writer management

**Context:** Where does ingredient CRUD live in the nav? Top-level slots (Meals, Components, Meal Plans, Shopping Lists) are user-facing content. Ingredients are reference data — putting them at the top level dilutes the user-facing nav.

**Choice:** New top-level "Admin" entry. Reference data sits under it (ingredients first); future reference-data screens follow the same pattern. Writer Management (requirements §3.9) will also live here when built.

**Implication:** Route prefix `/admin/...`. Convention captured in the standing brief.

#### Decision 36 — Build log filename drops the `_post_<feature>` suffix

**Context:** F1's build log is `build_log_post_f1.md`. The `_post_` suffix encoded timeline info — "after F1 was complete". Decision 25's folder structure (`current/` vs `archive/`) already encodes that.

**Choice:** F2's build log is `current/build_log_f2.md`. No prefix. Moves to `archive/` at F2 close-out.

#### Decision 37 — Defer pg_trgm to 2B's importer

**Context:** The schema has trigram indexes on `ingredient.canonical_name` and `ingredient_alias.alias` (install SQL §11), built for fuzzy matching at import time.

**Choice:** Browse-view search uses plain `ilike`, not trigram. The 227 seeded ingredients don't benefit meaningfully from fuzzy match in the UI — a writer browsing the list knows what they're looking for.

**Reasoning:** Fuzzy matching earns its keep when the input is uncertain (importer proposing matches against unknown user-supplied text). Browsing the list is certain input. Anything more would be premature.

#### Finding — null-category sort fallback is dead code (for now)

The browse query sorts by `coalesce(ingredient_category.sort_order, 999)` to push null-category rows to the bottom. All 227 seeded ingredients have categories, so the fallback path isn't exercised. Documented in the build log; revisit if uncategorised ingredients ever appear in practice.

#### Issue 15 — Slice closed against local verification only; nothing reached production

**Symptom:** Slice 2A.1 was reported complete with a clean Playwright verification. At that point, none of it was on production. The repo's `src/routes/` had no admin route, `current/build_log_f2.md` didn't exist, and the live Workers URL was unchanged. The route was eventually pushed after a separate diagnostic step; the build log only landed during slice close-out.

**Cause:** Verification ran against `localhost:5173`. The done-list step that called for a production smoke test got skipped, and the slice was declared done before any commit landed on `main`. The build log creation (also on the done-list) was similarly missed.

**Fix:** Commit the work, refresh `bun.lock`, push, re-run the smoke test against the live URL. Create the build log as part of slice close-out.

**Implication:** "Done" requires evidence from production, not from `localhost`. From 2A.2 onwards, the done-list explicitly requires (a) a commit hash on `main`, (b) a green Cloudflare build, and (c) the smoke-test claim quoting the live URL — not a localhost port. Verification reports that quote `localhost:5173` are not slice-done evidence. The build log file must exist in the repo at slice-close time, not just locally.

### Slice 2A.2 — Ingredient detail view (read-only)

**Built:** detail page at /admin/ingredients/$id rendering canonical row (breadcrumb, h1, default_unit, category and dietary_category as joined names, notes — with "—" for nulls) and aliases section. List page name cells now link to the detail. Not-found state for missing ids. Details in current/build_log_f2.md.

#### Decision 38 — Split 2A.2 into read-detail and edit

**Context:** Carry-forward 2A.2 from Stage 9 bundled the read-detail view with an auth-gated edit form. Two distinct vertical concerns — different RLS surface, different auth state, different UI affordances — in one prompt.

**Choice:** Split. 2A.2 is read-only (this slice). 2A.3 becomes the edit form (auth-gated). Alias add/remove deferred again, to 2A.4+.

**Reasoning:** Prompt-discipline rule is one vertical slice at a time. Splitting keeps each prompt narrow and each smoke test crisp. The sub-slice numbering was already a four-way split (Decision 34); this just renumbers within that.

**Implication:** Original 2A.3 (create + alias management) and 2A.4 (safe-delete) shift to 2A.4 and 2A.5. Standing brief and requirements updated.

#### Decision 39 — Three-file routing pattern for list + detail pairs

**Context:** First implementation used two files: admin.ingredients.tsx (list) and admin.ingredients.$id.tsx (detail). TanStack Router's flat-file naming made admin.ingredients.tsx the parent route of admin.ingredients.$id.tsx because the filename prefix matched. The detail rendered nested inside the list, with no <Outlet />, so it never mounted.

**Choice:** Three files — admin.ingredients.tsx (minimal <Outlet /> layout), admin.ingredients.index.tsx (list), admin.ingredients.$id.tsx (detail). Detail and index become root-level siblings under the layout.

**Reasoning:** This is idiomatic for TanStack Router flat-file routing when a route group needs siblings. F1's meals uses a different (two-file) pattern with no parent layout; it works but is inconsistent. Reconciliation deferred to whenever meals routes are next substantially touched — no speculative refactor.

**Implication:** Convention captured in standing brief §15. Future list + detail pairs under /admin/... follow the three-file pattern from the start.

#### Decision 40 — Commit workerd as a dev dependency

**Context:** workerd was missing from node_modules and blocking the dev server on a fresh clone. Claude Code installed it locally to unblock; the question was whether to commit it.

**Choice:** Commit to package.json. Cloudflare's Workers runtime needs it; every developer cloning the repo will hit the same missing-dep wall without it.

**Implication:** Lockfile-sync rule (standing brief §13) became load-bearing. See Issue 16.

#### Issue 16 — Dependency added without syncing bun.lock; Cloudflare build failed

**Symptom:** Commit 4fcd23e added workerd to package.json and package-lock.json but not bun.lock. Cloudflare's bun install --frozen-lockfile rejected the build: "lockfile had changes, but lockfile is frozen".

**Cause:** The both-lockfiles workflow was in the standing brief (then §13) but as a paragraph, not a checklist. Claude Code added the dependency via npm install, which updated only the npm lockfile. The bun lockfile drift wasn't surfaced locally — frozen-lockfile only fires at the remote build.

**Fix:** Ran bun install to regenerate bun.lock against the current package.json, committed as b32c635, pushed. Cloudflare rebuilt green.

**Implication:** Standing brief §13 rewritten as a four-step checklist: npm install → bun install → git add both lockfiles → commit together. The frozen-lockfile error remains the only signal available; the rule is now phrased to be impossible to misread.

#### Issue 17 — Slice declared verified before being pushed to main

**Symptom:** Claude Code reported 2A.2 verified against localhost:5173. The user then noticed the live Workers URL was unchanged. The commit had been applied locally but never pushed; production was still on 2A.1.

**Cause:** Same root as Issue 15. Local verification was read as slice-done. The done-list's push-to-main step was assumed to have happened.

**Fix:** Pushed the commit, fixed the lockfile drift (Issue 16), waited for green build, smoke-tested on production.

**Implication:** Issue 15's fix language already requires production evidence for slice-done. Two consecutive slices have stumbled on the push step despite that. Project instructions need amending: future slice prompts should close with an explicit "push to main and wait for green build before declaring done" instruction, so the deploy step lives in the prompt itself rather than only in the project rules. Flagged for review.

### Slice 2A.3 — Ingredient create and edit

**Built:** create page at `/admin/ingredients/new` and edit page at `/admin/ingredients/$id/edit`, sharing a single `IngredientForm` component. Fields: `canonical_name` (required), `default_unit`, `category_id` (select from `ingredient_category` ordered by `sort_order`), `dietary_category_id` (select from `dietary_category` ordered by `rank`), `notes`. On save, navigates to the detail view. On cancel, navigates to detail if editing, list if creating. UNIQUE constraint violation (Postgres code `23505`) surfaces as "An ingredient with this name already exists." rather than the raw Postgres message. Both pages use the UI-only auth gate settled in this slice (see Decision 41). Commits: `8ce62e2` (routing restructure), `9455e7d` (form addition). Build green; smoke tested on production.

#### Decision 41 — UI-only auth gate, settled as the convention for write routes

**Context:** F1's `meals.new.tsx` and `meals.$mealId.edit.tsx` use a `useEffect`-based redirect to `/login` when the session is absent. The question for 2A.3 was whether to copy that pattern or settle something different.

**Choice:** UI-only gate. The page chrome always renders. Within the content area, writers see the form; non-writers see a panel. Two states: `!user` → "Sign in to edit" (link to `/login`); `user && !isWriter` → "You don't have writer access on this household." No redirect, no flash, no `useEffect`.

**Reasoning:** The redirect approach requires the session to resolve before anything renders — on slow connections the page is blank, and server-side rendering can't pre-populate the session state. The panel approach is immediately renderable and communicates the auth state clearly without relying on timing. It also avoids the question of where to redirect back to after login.

**Implication:** 2A.3's write routes follow the UI-only pattern. F1's meals routes still use the redirect — to be reconciled when meals routes are next substantially touched. The `beforeLoad`-based approach (server-side auth gating via TanStack Router's loader hooks) is the right long-term answer but is a cross-cutting change; deferred and documented in standing brief §15.

#### Decision 42 — Five-file routing pattern for list + detail + edit groups

**Context:** Adding `admin.ingredients.$id.edit.tsx` as a sibling of `admin.ingredients.$id.tsx` triggers the same parent-layout collision 2A.2 hit at the list level. The detail route (`$id.tsx`) becomes the parent of the edit route because their filename prefix matches.

**Choice:** Apply the three-file pattern one level deeper. `admin.ingredients.$id.tsx` becomes a minimal `<Outlet />` layout; the detail content moves to `admin.ingredients.$id.index.tsx`; the edit form sits at `admin.ingredients.$id.edit.tsx` as a sibling.

**Reasoning:** Same reasoning as Decision 39 — this is idiomatic TanStack Router flat-file routing for a route group that needs siblings. The pattern composes cleanly.

**Implication:** Convention updated in standing brief §15. Any future route group that needs list + detail + edit follows this five-file shape from the start. `admin.ingredients.new.tsx` is a sibling of `$id.tsx` under the `admin.ingredients` layout; static segments take precedence, so `/new` routes correctly before the dynamic `$id` segment.

#### Finding — Diff-vs-approved-diff guard caught an affordance gap on first use

The 2A.3 prompt included a new line: "if the final diff differs materially from what I approved, surface the difference before committing — don't fold it in silently." CC's first proposed diff added Edit and New buttons that weren't in the spec's file list — required to walk the smoke test path but missing from the prompt. CC flagged them in the proposed-diff summary rather than including them silently. Approved on the spot. Guard line earned its keep on first use; staying in future prompts.

#### Finding — Ingredient list sort order is wrong

Smoke testing revealed the ingredient list returns rows in effectively `id` ascending order. The sort applied in `admin.ingredients.index.tsx` sorts the client-side result array by `ingredient_category.sort_order` then `canonical_name`, but the Supabase query has no `order()` call, so the row set that arrives is in an arbitrary order that the client-side sort then acts on. For the current 227-row set this is mostly harmless, but it's not the intended v1 default (alphabetical by `canonical_name`). Deferred; added to requirements §3.11 as a deferred admin operation.

#### Finding — Docs updated before build green / smoke test (process slip)

CC began editing `standing_brief.md` immediately after pushing, before the Cloudflare build had completed and before production smoke testing. The slice-done checklist explicitly orders these: build green and smoke test first, then docs. No actual cost this slice (build was green, smoke test passed), but the order matters if either step fails — docs would describe a shipped state that's still in flux. Worth keeping the checklist order explicit in future slice prompts as a closing reminder, the same way Stage 9 flagged the push step.

### Slice 2A.4 — Ingredient list sort fix + alias add/remove

**Built:** two-concern slice. Sort fix: one `.order("canonical_name")` call on the ingredient list query; client-side category-then-name sort memo dropped. Alias write affordances: `AliasSection` component on the detail page, writer-gated (same `useIsWriter()` pattern as edit/new), add input + per-alias remove button, `invalidateQueries` on success. Commit `d446533`, smoke-tested on production 26/05/2026. Details in `current/build_log_f2.md`.

#### Finding — Sort fix was a one-liner once the bug was located

The list query built `q` incrementally (filters appended conditionally) and awaited it at the end with no `.order()` call. The client-side sort then acted on an arbitrarily-ordered result set rather than a sorted one. Fix: `.order("canonical_name")` before the `await`. The category-then-name client-side sort was dropped entirely — §3.11's v1 default is name-only alphabetical. The column-selectable sort (by category, dietary, unit) remains deferred.

#### Finding — Alias uniqueness is global, not per-ingredient

`ingredient_alias.alias` has a global UNIQUE constraint, not a per-ingredient composite. The `23505` error is the correct signal — "This alias already exists." means it exists anywhere in the table, not just on this ingredient. Consistent with how `canonical_name` uniqueness is handled in `IngredientForm`. Worth knowing before designing any future bulk-alias or merge UI.

#### Finding — Alias list needed `id` for correct keying and delete

The existing query fetched `ingredient_alias(alias)` — string-only. Adding write affordances required `id` for two reasons: stable React list keys (unaffected if alias text changes elsewhere), and the delete call (`.delete().eq("id", ...)` is safer than matching by text). Type updated to `{ id: number; alias: string }[]` throughout.

#### Finding — CC over-blocked itself on the smoke test

CC ran the production smoke test by fetching the page once with `WebFetch`, observed the empty client-side-rendered shell, and bailed to "needs a real browser" for all seven items. Half the path didn't need a real browser. Items 1 and 2 (alphabetical sort on `/admin/ingredients`, logged-out detail page showing the alias list with no buttons) are unauthenticated and entirely scriptable via Playwright cold-start — the same approach 2A.2's build log already records working. Items 3–7 are genuinely awkward to automate because magic-link OTP isn't scriptable without either intercepting the email or a pre-saved Playwright auth storage state, neither of which is set up.

The framing CC gave back ("client-side React app, needs a real browser") conflated the two cases. The actual gap: CC reached for `gh` for build status, got blocked (`gh: command not found`), and didn't try Playwright either.

**Open question — unresolved:** how to close this. Two options on the table:

- **Cheap convention.** State in every slice prompt which smoke-test items are unauthenticated (CC + Playwright) and which are authenticated (human). Zero setup cost; Playwright is already working ad-hoc per 2A.2.
- **Tidier fix.** Commit Playwright as a dev dep, persist an authenticated storage state for a writer session. CC can then run the full smoke test. This is the "tidy slice" 2A.2's build log already flagged, possibly bundled with `.gitattributes` for line endings — an environment-setup pass.

Leaving open for now. If the same friction bites again in 2A.5 or F2B, settle the convention. If it doesn't, the tidy slice can wait until it's load-bearing.

#### Marker — Diff-guard line stayed in, didn't fire

The diff-guard line ("if the final diff differs materially from what I approved, surface the difference before committing — don't fold it in silently") was carried forward from 2A.3 into the 2A.4 prompt. Final committed diff matched the approved diff; no surface needed. Recorded so future slices have a baseline for when the guard fires vs holds steady.

#### Marker — Close-out reminder did its job

The 2A.4 prompt closed with an explicit ordering: push, wait for green build, smoke test on production, then update docs. CC followed it — pushed, asked for confirmation that the build was green and the smoke test had passed, then opened the docs. No repeat of the 2A.3 process slip (docs edited before build green). Worth keeping the closing reminder in future slice prompts on the same basis as the diff-guard line.

#### Carry-forward to 2A.5

Safe-delete (prevent ingredient deletion if referenced by `meal_ingredient`) is the remaining 2A sub-slice. Originally 2A.4 (Decision 34), shifted to 2A.5 when 2A.2 was split (Decision 38) — that same decision moved alias add/remove into the 2A.4 slot, where it shipped this slice. Safe-delete has been at 2A.5 since. Schema enforcement via the existing FK constraint is already in place; the slice adds UI that surfaces the constraint error cleanly and — optionally — lists the referencing recipes.

### Slice 2A.5 — Safe-delete on ingredient detail page

**Status:** complete, deployed, smoke-tested 26/05/2026. Commit: `1837f5f`.

#### Finding 1 — Smoke test item 4 (blocked state) is not yet testable

**Symptom:** Smoke test item 4 (click Delete on a referenced ingredient → dialog lists references, no Delete action) could not be run. No ingredients have been added to a meal or component yet — that path doesn't exist until F2B lands.

**Implication:** The blocked-state dialog is code-complete but unverified against real data. Re-run item 4 as part of the first slice in F2B that wires an ingredient to a meal or component. Note in that slice's smoke test explicitly.

#### Finding 2 — AlertDialog controlled mode with plain buttons

**Decision:** The dialog uses `AlertDialog` from Radix in controlled mode (`open` / `onOpenChange`) with plain `Button` elements in the footer rather than `AlertDialogAction` / `AlertDialogCancel`. This prevents Radix from closing the dialog automatically on click — necessary because the delete path is async and needs to own the open/close transition itself.

**Implication:** Pattern for any future async-action confirmation dialog in this codebase: use `AlertDialog` in controlled mode, plain `Button` in the footer.

#### Finding 3 — Pre-check error message consistency

**Issue (caught in review):** The first draft of `handleDeleteClick` used `(err as Error).message` in the catch, exposing raw Supabase errors to the user — inconsistent with the delete-failure path, which already used a generic message. Corrected in review before the diff was applied.

**Implication:** Any future mutation that has both a pre-check and a mutation step should apply the same generic-message rule to both catch blocks at the same time, not as a separate pass.

#### Finding 4 — Docs started before human smoke tests complete (process slip)

**Symptom:** CC opened the docs after running its own unauth Playwright smoke tests, before Mike had run the auth items in the browser. Same fault mode as the 2A.3 slip, despite 2A.4 running clean. The 2A.5 prompt carried the standard "push → green build → smoke test → docs" close-out reminder, but with the smoke test split between CC (unauth) and Mike (auth), CC appears to have treated "my smoke tests done" as the trigger rather than "all smoke tests done." Caught in review; docs paused until human items were complete.

**Implication:** When the smoke test is split, the close-out reminder needs to name the split explicitly. Proposed wording for split-smoke slices: "push, wait for green build, run unauth smoke tests, wait for confirmation that human smoke tests have passed, then update docs." Standard reminder is fine for unsplit slices.

#### Carry-forward to F2B

F2A (ingredient master admin: browse, detail, create/edit, alias add/remove, safe-delete) is complete. The next F2 work is F2B — the ingredient import flow: JSON import, fuzzy matching, human-in-the-loop disambiguation, and the "create new ingredient" branch. Smoke test item 4 from 2A.5 (blocked-state dialog with real references) should be re-run in the first F2B slice that wires `ingredient_id` onto `meal_ingredient` or `component_ingredient` rows.

### F2B planning — recipe import flow

F2A closed with the ingredient master admin shipped. F2B is the import flow: paste a JSON template, validate, match ingredients against the canonical master with human-in-the-loop disambiguation, commit to `meal` + `meal_ingredient` + `meal_step` + the related lookup joins. Six decisions taken before any sub-slice prompt is drafted.

#### Decision 43 — F2B sub-split: fixture prep, then three build slices

**Context:** F2B is broader than any 2A sub-slice — JSON validation, ingredient matching, disambiguation UI, "create new ingredient" branch, multi-table transactional commit. Needs splitting before any CC prompt.

**Choice:** One fixture-prep step followed by three build slices.

- **Pre-2B.1 — Test fixture prep.** No CC prompt. Chat-based work: synthesised edge-case JSONs stressing template fields, plus 5-ish web-PDF conversions for shape variety. Committed to `current/import_test_fixtures/` as `recipes/`, `components/`, `edge_cases/`.
- **2B.1 — Validate-only.** `/admin/import`, paste textarea, validate button. Schema-shape check, lookup-code resolution against the live DB, `{NNNN}` placeholder validity. No matching, no writes. Validator covers all three shapes (recipe / recipe+derived / component) even though commit ships recipe-only — see Decision 45.
- **2B.2 — Ingredient matching, read-only.** Service: exact canonical → exact alias → `pg_trgm` fuzzy. Per-ingredient preview rows with candidate(s) and match type. Still no writes.
- **2B.3 — Disambiguation + commit.** Per-row accept / override-with-existing / create-new-inline. On submit (writer-only): single transaction writing `import_log` + `meal` + `meal_ingredient` + `meal_step` + the four `meal_*` joins. Recipe-only; derived components and re-import deferred to 2C per Decision 18.

**Reasoning:** The pipeline structure (parse → match → commit) is the cleanest seam. Each build slice has a demonstrable smoke surface, even .1 and .2 which don't write — they validate against fixture data the operator can see. The fixture-prep step is load-bearing because the validator's coverage and the matching's vocabulary gaps both need real input variety before they're considered done; it's not a CC slice because it's content work, not code work.

**Implication:** 2B.3 is the heaviest by far. If scope creep bites mid-prompt, split it on the same precedent as Decision 38 (the 2A.2 mid-flight split) rather than pre-emptively. Component import (`import_type: "component"`) stays deferred to F3 per Decision 19.

#### Decision 44 — Test fixture prep in fresh chats

**Context:** Fixture prep covers (a) synthesising edge-case JSONs and (b) sourcing PDFs from the web and converting them to template format. Both could happen in this planning chat or in fresh ones.

**Choice:** Both in fresh chats.

**Reasoning:** A fresh chat with no warm context is closer to what an unconfigured AI converter actually does with the template — which is exactly what the (b2) content milestone (Decision 46) is meant to test. The convenience of "I already know the template inside-out" works against the test. Same reasoning the original F2 planning chat applied when raising the question.

**Implication:** Two new chats kick off after this commit lands. PDFs sourced by Mike, converted by Claude in the fixture-prep chat. Edge-case synthesis done in its own chat against the spec only. Both failure modes (conversion fails/fudges vs importer would struggle) tracked separately when results are reviewed.

#### Decision 45 — Validator covers all three shapes structurally; commit ships recipe-only

**Context:** The import spec defines three shapes — recipe, recipe with derived components, component. 2B.3 only commits the first per Decision 19. The question is whether 2B.1's validator covers all three.

**Choice:** All three covered structurally. Discriminator-keyed rules, cross-reference checks (placeholder resolution, `derived_components.ingredient_ids` against parent ids, `step_indices` against parent step range), and lookup-code resolution all implemented in 2B.1.

**Reasoning:** The contract is the asset locked by 2B.1. A validator that only handles recipe-shape leaves 2C and F3 inheriting a partial validator, which either gets extended (re-touching .1's code, drift risk) or paralleled. Implementing the discriminator branch once is cheap relative to that.

**Implication:** 2B.1's fixture set includes at least one minimal component-shape JSON and at least one recipe-with-derived JSON (shepherd's pie qualifies) for validator coverage. 2B.3's commit refuses non-empty `derived_components` with an explicit "Derived component import lands in F2C; strip them and re-import to land the parent" message — block, not silent skip.

#### Decision 46 — F2 done in the (b2) shape

**Context:** The original F2 planning (Stage 7) framed F2 done as either (b1) the four hand-converted JSONs land cleanly, or (b2) those plus at least one fresh conversion from an unprocessed source. (b2) was the agreed milestone. The fixture-prep step makes (b2) concrete.

**Choice:** F2 done = all recipe-shape fixtures land cleanly in `/meals`, including the four originally hand-converted JSONs and at least one of the web-PDF conversions produced during fixture prep. Derived components and re-import explicitly out of F2 scope.

**Reasoning:** Tests conversion (PDF → template) + importer + matching together, which is the actual user pathway. (b1) alone tests only the importer against pre-cleaned input — too narrow.

**Implication:** Shepherd's pie's derived lentil base does not block F2 done — it's a 2C item. The parent recipe still lands in F2. Any web-PDF conversion that uncovers a spec gap during fixture prep gets the spec updated before 2B.1's prompt is drafted, so the validator is built against the corrected contract.

#### Decision 47 — Re-import: surface a blocked-state message, defer the upsert to 2C

**Context:** The spec says same `external_ref` means update, not duplicate. The DB has a UNIQUE constraint that will reject a second import with a raw Postgres `23505` error. Building real upsert is 2C work per Decision 18.

**Choice:** 2B.3 catches `23505` on `external_ref` at the service layer and surfaces it as "An import with this external_ref already exists. Re-import / update lands in F2C." No silent overwrite.

**Reasoning:** Letting the raw Postgres error bubble through is dishonest UX. Catching it with an explicit "this is a known deferred case" message keeps the boundary visible to the operator without committing to upsert semantics that 2C will need to design properly.

**Implication:** Cheap addition to 2B.3's commit path. Same pattern as the UNIQUE handling in `IngredientForm` (canonical_name) and `AliasSection` (alias) from 2A.3 and 2A.4 — consistency carries forward.

#### Decision 48 — Smoke-test convention: keep the existing split, settle the wording

**Context:** 2A.4's Finding flagged the unauth-vs-auth smoke-test split as an open question — cheap convention (state what's auth-gated per prompt) vs tidy slice (commit Playwright as a dev dep, persist an authenticated storage state). 2A.5 reproduced the same split. F2B is split-smoke throughout.

**Choice:** Cheap convention wins. Every slice prompt states which smoke-test items are unauth (CC + Playwright) and which are auth (human). The sharpened split-smoke close-out reminder from 2A.5's Finding 4 — "push, wait for green build, run unauth smoke tests, wait for confirmation that human smoke tests have passed, then update docs" — applies unconditionally from 2B.1 onwards. The tidy slice (Playwright auth storage state) stays parked.

**Reasoning:** Cheap convention has run twice (2A.4 ran clean, 2A.5 surfaced the docs-timing slip that the sharpened wording addresses). Tidy slice has setup cost — Playwright as dev dep, storage-state regeneration when sessions expire, `.gitattributes` for line endings — none of which is load-bearing yet. Worth deferring until either (a) the cheap convention bites again in a way the wording can't fix, or (b) a future slice needs auth-gated automation for reasons beyond smoke-testing.

**Implication:** Resolves the open question in requirements §7. The convention earns its way into the standing brief at F2 close-out if it survives 2B.1/.2/.3 cleanly; until then it lives in the planning log and the slice prompts.

#### Carry-forward to 2B.1

Before any CC prompt is drafted, Pre-2B.1 fixture prep runs in fresh chats — synthesised edge-case JSONs and 5-ish web-PDF conversions both committed to `current/import_test_fixtures/`. Spec gaps surfaced during prep get fixed before .1's prompt is written.

For the 2B.1 prompt itself when it's drafted:
- Diff-guard line, same wording as 2A.3 onwards.
- Sharpened split-smoke close-out reminder (Decision 48). 2B.1's smoke test is unauth-only (validation has no auth gate), so the human-auth wait is null — but the wording goes in for consistency and to keep the reflex.
- Blocked-state delete smoke (2A.5 Finding 1, re-run on a real `meal_ingredient` reference) reserved for 2B.3, not .1 or .2. .1 and .2 don't write to `meal_ingredient`.

---

### 2B.1 close-out decisions and issues

#### Decision 49 — Advisory consistency check deferred to 2B.2; manifest reconciled

**Context:** The import spec's advisory ingredient-consistency check (rule 204) depends on knowing each ingredient's master `dietary_category_id`, which requires ingredient→master matching. Matching is 2B.2 (Decision 43). The 2B.1 prompt confirmed this deferral, and the `advisory-consistency-trip` fixture was expected to produce "pass (advisory)" per the original manifest.

**Choice:** Advisory check not implemented in 2B.1. `advisory-consistency-trip` validates clean (structurally valid recipe, no advisory raised). Manifest row updated from "pass (advisory)" to "pass (advisory deferred to 2B.2)" to reflect what the validator actually does this slice.

**Reasoning:** The manifest expected an advisory the 2B.1 slice boundary doesn't permit — the deferral was known going in (Decision 43), but the manifest pre-dated the decision to trace it explicitly at close-out. Updating the manifest now keeps the smoke surface honest: a future operator running the fixture loop will see the correct expected outcome, not one that implies an advisory was raised and passed.

**Implication:** 2B.2 implements rule 204 and reconciles the `advisory-consistency-trip` manifest row again — from "pass (advisory deferred to 2B.2)" back to "pass (advisory)". The fixture itself is structurally valid and correct — no change needed to the JSON. This action is owned by the 2B.2 prompt's close-out steps.

#### Decision 50 — Top-level external_ref DB-uniqueness check kept out of the validator; remains at the commit path

**Context:** During 2B.1 prompt review, CC proposed adding a pre-commit DB-uniqueness check for the top-level `external_ref` to the validator, on the grounds that the spec (rule 187) says "unique in the database."

**Choice:** Not added. The validator does within-payload derived-ref uniqueness checks (no DB needed) but does no top-level `external_ref` DB lookup. Uniqueness stays enforced at 2B.3's commit path via the Postgres `23505` catch, per Decision 47.

**Reasoning:** Two grounds. First, Decision 47 already settled where uniqueness is enforced — and the spec itself says "same slug means update, not duplicate," so a duplicate isn't unambiguously a validation error. A pre-commit hard-reject would both duplicate the `23505` mechanism and pre-empt the re-import/upsert semantics F2C owns. Second, the "vacuous in 2B.1" premise CC offered didn't hold: `external_ref` uniqueness is a column constraint regardless of how rows got there, and the F1 library covers the same dishes as the `web_sourced` fixtures — a live collision would fail an expected-pass fixture in the smoke test.

**Implication:** 2B.3 owns the duplicate-handling UX (catch `23505`, surface "An import with this external_ref already exists. Re-import / update lands in F2C"). If 2B.3 wants a non-blocking "this ref already exists, will be a re-import" advisory at validate time, that's a 2B.3 call alongside the commit UX — not a 2B.1 retrofit. The 2B.3 prompt should cite this decision so the deferral reasoning isn't reconstructed from scratch.

#### Issue 2B.1-1 — classic-houmous fixture: cuisine code "lebanese" not seeded

**Context:** The smoke test found `classic-houmous.json` failing with `cuisine — Unknown code "lebanese"`. The seeded cuisine table has `middle_eastern` but not `lebanese`. The fixture was converted from a web PDF during Pre-2B.1 and the converter used a cuisine code that isn't in the seed.

**Resolution:** Fixture updated to `"cuisine": "middle_eastern"`. The validator was correct to reject `lebanese` — the seed is the authority (standing brief §1). This is a fixture-prep conversion error, not a spec gap or validator bug.

**Implication:** Smoke test passes 36/36 after the fix. No DB change needed. Worth a one-pass audit of the other 11 `web_sourced` fixtures against the live seed before 2B.2 starts using them for matching — a fixture using a non-seeded but valid-format code would pass 2B.1's validator (codes are checked) but could mis-train 2B.2's matching expectations on adjacent fields. The conversion process that produces fixtures should resolve every lookup code against the seed at conversion time, not from memory.

#### Issue 2B.1-2 — pre-existing TypeScript errors in admin.ingredients.$id.index.tsx

**Context:** During 2B.1 the build log noted pre-existing TypeScript errors on lines 61–63 of `src/routes/admin.ingredients.$id.index.tsx` (Supabase type inference on a nested select). The errors pre-date 2B.1 and 2B.1's new files are type-clean. Flagging now so they have an owner rather than rotting as a footnote.

**Resolution:** Not fixed this slice — out of 2B.1 scope. Logged here so the next slice that touches the F2A ingredient admin owns the fix, or so a future tidy slice can pick up the cluster.

**Implication:** Carry-forward to whichever slice next edits that file. The fix is likely a typed wrapper around the nested select rather than a schema change — but confirm before assuming. If no slice naturally touches the file in F2, schedule a focused tidy before F2 close-out.

#### Carry-forward to 2B.2

Before the 2B.2 prompt is drafted, run a one-pass audit of the 11 remaining `web_sourced` fixtures against the live seed — check every lookup code (cuisine, dietary_category, dietary_restrictions, nutritional_tags, meal_types, meal_formats) against the values actually in the DB. Issue 2B.1-1 showed that a fixture can pass the validator (code format correct) yet use a code that isn't seeded; that's benign for validation but could skew matching expectations if the fixture is used to calibrate 2B.2's matching output.

For the 2B.2 prompt itself when it's drafted:
- Diff-guard line, same wording as 2A.3 onwards.
- Split-smoke close-out reminder (Decision 48). 2B.2's smoke surface will include unauth items (matching preview is read-only); state the auth/unauth split explicitly, same as 2B.1.
- Build confirmation is manual. `gh` is not available (2A.5 finding). After push, stop and wait for confirmation in chat that the Cloudflare build has gone green before running smoke tests. Don't infer build state from anything else.
- Advisory consistency check (rule 204) is owned by 2B.2 and must be implemented this slice. At close-out, reconcile the `advisory-consistency-trip` manifest row from "pass (advisory deferred to 2B.2)" back to "pass (advisory)" — this is an explicit close-out step, not a tidy-up.
- Smoke script note: `canValidate` in the import page requires both lookups loaded AND a non-empty textarea. Any Playwright script that waits on the Validate button enabling must seed a placeholder value into the textarea first (e.g. `{}`) before the wait, otherwise the button never enables regardless of how long the script waits. Established in 2B.1's smoke run.
- TS errors in `admin.ingredients.$id.index.tsx` (Issue 2B.1-2): 2B.2's matching UI probably won't touch this file, so the fix is unlikely to land here. Carry forward to 2B.3 or schedule a focused tidy before F2 close-out. Restating so the issue has a visible trail beyond the close-out section.