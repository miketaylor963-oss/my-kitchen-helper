# Recipe & Meal Planning App — Requirements (Draft v0.5)

## 1. Purpose & Scope

A personal app for browsing a meal library, composing meals from reusable components, planning the week's meals across diners, and generating shopping lists.

**In scope (v1):** meal library, component library, composition builder, ingredients, meal planning (with portion scaling), shopping list, cooked log, recipe/component import from Claude.

**Out of scope (v1):** auto-nutrition (omega-3 ratio, macros — handled in Claude during recipe development), recipe import from URLs, image-based recipe import, pantry/staples awareness, in-app Claude integration. Revisit post-v1.

**Framing:** learning project, not commercial-grade. Minimal coding, AI-assisted, vertical feature slices.

---

## 2. Users & Access

- **Write access:** restricted to a small set of named users — initially Mike and Jane, extensible later. Each writer has a profile capturing dietary category and any restrictions, and is selectable as a "diner" in the meal plan.
- **Read access:** unrestricted. Anyone with the URL can browse the library, plans, and cooked log.
- **Longer-term framing:** the app may be shown as a portfolio piece for AI-assisted building, and potentially opened up as a general-purpose app for others. Design choices should not preclude that — but multi-household / multi-tenant is explicitly *not* a v1 concern.
- Jane is pescatarian; Mike is omnivore. Both share a health framing (omega 3:6 ratio, grass-fed/pasture-raised preferences).

---

## 3. Functional Requirements

### 3.1 Meal Library
- Browse, search, and filter all meals.
- Three meal **statuses**: `idea` (just a name/concept), `recipe` (full ingredients + method), `composition` (assembled from components via a framework).
- Filter dimensions: cuisine, format, framework, dietary category, dietary restrictions ("contains" tags), nutritional tags (e.g. omega-3 strong), source.
- Each meal links to: components (if a composition), ingredients (if a recipe), cooked-log history, ratings.

### 3.2 Component Library
- Components are first-class entities — independently browsable, editable, reusable across many compositions.
- Each component is **registered against one or more framework layers** (e.g. "sesame spinach" is a *veg/salad component* for bento and a *vegetable layer* for dinner).
- Components are grouped into **families** for UI clustering within a layer (e.g. "mash family" inside the dinner *topping* layer).
- Components carry their own ingredients, method, dietary tags, and nutritional flags.

### 3.3 Composition Builder
- Build a composition by selecting a **framework**, then filling each layer slot with one or more components.
- Six seeded frameworks at launch:
  1. Component-based dinner (base / topping / vegetable layer / finisher)
  2. Bento (anchor protein / carb / veg-or-salad components / small extras)
  3. Breakfast bowl
  4. Mason jar salad
  5. Smørrebrød
  6. Mezze
- Per-layer rules: required vs optional, min/max component count (e.g. bento expects ~2 veg/salad components, dinner expects 1 base).
- Layer-aware component picker (only show components registered to the current layer; default-sort by family).

### 3.4 Ingredients
- Master ingredient list with canonical name, default unit, category (for shopping-list grouping — produce, dairy-alt, fish, etc.).
- Ingredients attach to recipes and to components, with quantity + unit.
- **Base serving count** stored on each meal (and component) — the portion scaling in §3.5.1 multiplies against this.
- Consider: substitution links (e.g. "oat milk" substitutes for "milk").

### 3.5 Meal Planning
- Weekly calendar view (and probably a longer-horizon view).
- **Slots:** breakfast, lunch, dinner. No snacks or other slots.
- Assign a meal to a **date**, a **slot**, and a **diner or diners**.
- Support the case where Mike and Jane eat different meals on the same day in the same slot (e.g. Mike has a beef sandwich, Jane has a smoked mackerel salad — both at Tuesday lunch).
- Support shared meals (one meal, both diners).
- Quick-add from library; drag/drop or click-to-assign.
- **Default plan template:** a fresh week comes pre-populated with empty breakfast/lunch/dinner slots for both diners; the user fills them in.

#### 3.5.1 Portion Scaling
Each planned meal carries a portion count. Default is 2 (Mike + Jane). The four use cases driving this:
1. Meal for one (Mike or Jane only) → portion count 1.
2. Meal for both (default) → portion count 2.
3. Visitors → portion count 2 + N. A visitor is modelled as a count, not a profile.
4. Leftovers (cook today, eat again tomorrow) → portion count 2 × number of days. See §3.5.2.

Portion count drives ingredient quantities in the shopping list, scaled from the meal's base serving count.

#### 3.5.2 Leftovers (future)
Leftovers as a first-class concept — flag a cook event as covering N days, auto-populate the corresponding plan slots, avoid double-counting in the shopping list — is **out of v1 scope**. For v1, the user handles this manually: schedule the same meal on day 1 and day 2 at full portions, then deduplicate by eye. Worth revisiting once the basic planner is working.

#### 3.5.3 Away-from-home flag (future)
Marking a slot as "eating out" (no meal needed, no shopping required) is out of v1 scope. Same revisit point.

### 3.6 Shopping List
- Generated from the planned meals over a chosen date range.
- Aggregates ingredients across all planned meals, **scaled by each meal's portion count** (sum quantities where units match; list separately where they don't).
- **All ingredients included by default** — no store-cupboard skipping in v1.
- **Derived items** and **manual items** are stored separately so that regenerating the list (after adding/removing a meal) does not blow away manual additions.
- Items grouped by ingredient category (produce, fish, pantry, etc.).
- Check-off state persists.

#### 3.6.1 Store-cupboard / Staples (future)
A later addition. Users mark certain ingredients as staples (oils, salt, dried beans, lentils, tinned fish, tinned tomatoes, rice, etc.) with current stock state. The shopping list then excludes staples that are in stock, and the same staples register feeds a "what can I make with…?" query — useful enough on its own to justify the work.

### 3.7 Cooked Log
- Record that a meal was actually cooked (date, diner(s), optional notes).
- Rating per cooking event.
- View per-meal cook history and average rating.
- Feeds into library sort/filter ("things we've rated 4+", "haven't cooked in 3 months").

### 3.8 Recipe / Component Import from Claude
The primary content-creation pathway. Three modes:

1. **Import an existing recipe or component** developed in a Claude chat into the app's library.
2. **Develop a meal idea into a full recipe or component** inside Claude, then import. The app holds the idea (status: `idea`); Claude does the development; the result lands back as a `recipe` or `composition`.
3. **In-app Claude call (future).** Trigger development from inside the app — pick an idea, hit "develop", get a recipe back without leaving the UI. Out of v1, but the import format should not preclude it.

**Import mechanism (v1):** structured paste. Claude outputs a defined JSON (or similar) schema covering meal metadata, ingredients with quantities and units, method, framework + layer assignment if a component, dietary tags, format, cuisine, nutritional flags. The app validates and ingests it.

**Ingredient matching:** human-in-the-loop. The import flow proposes matches against the master ingredient list (exact + fuzzy), and the user confirms, edits, or creates a new ingredient. No silent auto-matching.

**Implication for the data model:** the import schema becomes a contract. It needs to be designed alongside the DB schema, not after, so that the lookup tables (cuisines, dietary tags, etc.) are referenced consistently from both sides. The schema design will be done by analysing a couple of real recipes already developed in Claude.

**Status (F2):** Recipe-shape import (modes 1 and 2) operational. JSON paste → validate → match ingredients (human-in-the-loop) → commit via `commit_import` RPC. Re-import / update (Decision 47) and in-app Claude call (mode 3) remain outstanding.

### 3.9 Writer Management (Admin)
A minimal admin screen for managing write access. Authenticated writers only.

- View the list of current writers (name, email, linked person if set).
- Invite a new user by email — triggers Supabase's built-in invite flow, which emails a magic link. No public sign-up form exposed.
- On accepting the invite, the operator creates the `app_writer` row (and optionally links to a `person` row). This can be a manual SQL step for v1; a UI step is a nice-to-have.
- Revoke access: delete the `app_writer` row. The `auth.users` row is left intact (handled via Supabase dashboard if needed).

This replaces the current manual-SQL-only workflow for adding writers. Jane's access is the immediate use case.

**Build slot:** after Shopping List, before LLM features.

### 3.10 Recipe Import from URLs (future)
Pasting a URL from a public, copyright-free recipe site and having the app parse it. Useful but not v1. Image-based import (photos of recipe cards or cookbook pages) is **explicitly off the roadmap**.

### 3.11 Ingredient master — deferred admin operations
Some admin operations on the ingredient master are deferred from v1 because they're genuinely complicated or not yet load-bearing. Captured here so they don't get quietly forgotten.

- **Merge.** Two ingredients that should be one ("salt" vs "fine salt") will eventually appear. Merging moves all `meal_ingredient.ingredient_id` references from source to target, moves aliases, deletes the source. Transactional, audit-trail-relevant, irreversible. Until merge exists, the only recovery for duplicates is careful create-time validation.
- **Soft delete / archive flag.** Only relevant if the v1 "prevent delete if referenced" rule becomes annoying in practice. Adds a state machine that propagates into every query and shopping-list aggregation, so worth avoiding unless clearly needed.
- **Bulk operations.** Bulk edit (e.g. re-categorise N ingredients at once), bulk re-category, bulk alias add. Useful at scale but not at the current 200-ish ingredient count.
- **Safe-delete with referential pre-check.** Shipped in 2A.5. Delete button (writer-only) runs a pre-check against `meal_ingredient`, `component_ingredient`, and `shopping_list_item` before opening a dialog. Blocked state lists references grouped by type; unblocked state shows a standard confirm + delete flow. Aliases cascade via the existing FK.
- **Column-selectable sort.** Alphabetical by `canonical_name` shipped in 2A.4 as the v1 default. Column-selectable sort (name, category, default_unit, dietary category) is the stretch version, still deferred.

---

## 4. Data / Domain Requirements

### 4.1 Dietary Categories (ranked hierarchy)
A meal's category is the *least restrictive eater* who can eat it. Used for group-suitability queries ("what can both of us eat tonight?").
- Vegan → Vegetarian → Pescatarian → Meat
- A pescatarian meal is suitable for Jane and Mike; a meat meal is suitable only for Mike.

### 4.2 Dietary Restrictions — "Contains" axis
- Tags describe what a meal *contains* (dairy, gluten, nuts, shellfish, eggs, soy, etc.), not what it's "free from".
- Filtering: user profile lists restrictions to avoid; library hides or flags meals containing them.

### 4.3 Meal Formats
Independent of framework. Describes how the meal is transported/eaten:
- No-reheat (cold or room temp)
- Microwave (cook ahead, reheat at desk)
- Thermos (hot, no microwave needed)
- (Plus the "eaten at home" default for dinners.)
A meal can carry multiple formats where it suits more than one.

### 4.4 Cuisines
- Consolidated to single values (British, Scandinavian, Italian, Japanese, Levantine, etc.) — no regional splits.

### 4.5 Nutritional Tags
- Omega-3 strong (the ★ marker in the source docs).
- Likely others over time (high-protein, low-carb, etc.) — design for extensibility.

---

## 5. Non-Functional Requirements

### 5.1 Tech Stack
- **Editor / build agent:** Claude Code running locally against the project repo. Cursor or another editor is fine for hand-edits; the AI workflow assumes Claude Code.
- **Frontend framework:** TanStack Start (full-stack React framework with file-based routing, server functions, and SSR) on Vite, with Tailwind v4.
- **Database & Auth:** Supabase Postgres in Mike's own Supabase account. ~36 tables after the v2 schema rewrite.
- **Schema installation:** done directly via Supabase SQL editor, in dependency order. The canonical install file is `current/recipe_db_install.sql` (single paste, includes role grants).
- **Hosting:** Cloudflare Workers via Workers Builds (Git-connected, auto-deploys on push to `main`). Free tier.
- **Version control:** GitHub repo `miketaylor963-oss/my-kitchen-helper` (public). Push from local after each working chunk.
- **Postgres extensions:** `pg_trgm` for fuzzy ingredient matching at import time.

**Tooling history.** F1 (Meal Library) was built in Lovable. Between F1 and F2 the project moved off Lovable to local Claude Code — Lovable's round-tripping and schema-confusion behaviour made it the wrong fit for the import-heavy work coming next. The initial deploy target after the migration was Vercel, but Vercel proved unable to serve TanStack Start's SSR output without adapter work the installed framework version doesn't ship. Cloudflare Workers is the current target. See planning log Stages 6 and 8 for details. Standing brief §12 and §13 cover the active stack and deploy/env workflow.

### 5.2 Build Order
Strictly vertical slices (DB → UI per feature):
1. Meals *(complete — built in Lovable)*
2. Ingredient master + import flow *(F2, in Claude Code)*
3. Components
4. Composition builder
5. Meal plan
6. Shopping list
7. Cooked log
8. Writer management (admin)
9. LLM features (post-v1)

### 5.3 Testing
- Real data (the existing breakfast/lunch/dinner libraries from project docs) from day one; no mock data.

### 5.4 Auth & Access Control
- **Authentication:** required for write operations (creating/editing meals, components, plans, cooked log entries, shopping list manual items, etc.).
- **No authentication** required for read operations — library, plans, and cooked log are publicly browsable.
- **Allowed writers** are managed via the `app_writer` table. Adding a writer uses Supabase's invite-by-email flow (see §3.9) — not a self-serve signup. Revoking access deletes the `app_writer` row.
- **Supabase RLS:** read policies open on library and plan tables; write policies restricted to authenticated users. The `app_writer` check is an application-layer gate on top of RLS.

### 5.5 Platform
- Responsive for mobile and desktop. Both are first-class.
- Shopping list and meal-plan-while-shopping flows should be especially mobile-friendly.
- Composition builder and library curation can lean desktop where there's a tradeoff.

---

## 6. Portfolio-Ready Foundations

Decisions made now because they're cheap up-front and expensive to retrofit. Everything else portfolio-related (landing page, demo dataset, case study write-up, custom domain) can wait.

### 6.1 Ownership column on writable tables
Add a `household_id` (or equivalent owner reference) to every writable table — meals, components, ingredients, meal plan entries, cooked log, shopping list, etc. v1 has one household; the column is functionally unused. Cost now: one column per table. Cost later: migrating ~36 tables and rewriting every query. Keeps the door open to multi-household without committing to it. *Landed in v2 schema.*

### 6.2 Writers as a database table
Define an `app_writer` table from day one rather than hardcoding the writer list in code or RLS policies. Flipping to invite-based access later becomes a row insert, not a code change. *Landed in v2 schema.*

### 6.3 Public read — what's actually public
Per-table reads, locked in for v2 RLS:
- **Library** (meals, components, ingredients, frameworks, lookup tables): public read. This is the portfolio asset.
- **Plan tables** (meal_plan, meal_plan_entry, cooked_log, person): public read.
- **Writer-only**: shopping_list, import_log, household, app_writer.

### 6.4 Repo and naming hygiene
- Repo: `miketaylor963-oss/my-kitchen-helper`. Public.
- Deployed at `https://my-kitchen-helper.mike-taylor963.workers.dev/`.
- Commit messages: descriptive, present-tense, one logical change per commit. Push after each working chunk.
- README explains what the app is and how to run it locally.
- Secrets (Supabase URL and anon key) live in `.env.local` (gitignored) locally, and in the Cloudflare Workers dashboard for production (Build and Runtime variables — see standing brief §13). Never in the repo.

### 6.5 Build journal
Keep notes as you build: decisions made, what worked, what didn't, prompts that landed cleanly, prompts that produced rework. The story of building this with AI *is* the portfolio asset. Trivial to keep going; near-impossible to reconstruct after the fact. The canonical log is `current/planning_log.md`. Per-feature build logs live in `current/` while a feature is active and move to `archive/` at close-out; F1's `build_log_post_f1.md`, the `schema_build_log.md`, and `migration_log.md` are already in `archive/`.

`current/enhancements.md` — deferred ideas with explicit "becomes worth fixing when" triggers. Reviewed at feature close-out.

---

## 7. Open Questions

- **Import schema design.** Resolved at v2 — see `recipe_import_spec.md` and `recipe_import_template.json`.
- **Plan template flexibility.** Defer until the basic planner is in use.
- **Production smoke-test cadence.** Resolved during F2B planning — see planning log Decision 48. Every slice's smoke test runs against the live production URL after green build, with the split between unauth (CC + Playwright) and auth (human) items stated explicitly in the slice prompt.

---

## 8. Success Criteria (v1)

The app earns its keep if, after launch:
- The full existing meal library (breakfast, lunch, dinner docs) is captured in the app and searchable.
- A week's meals can be planned in under 10 minutes from a phone.
- The generated shopping list is good enough to be the *only* list taken to the shop.
- Cooked log is being filled in regularly enough to be useful for future planning.
