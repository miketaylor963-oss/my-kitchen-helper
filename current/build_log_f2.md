# Build Log — F2: Ingredient master + import flow

Per-slice notes from building F2. Format mirrors `archive/build_log_post_f1.md`. Decisions of structural significance live in `current/planning_log.md`; this file is closer to the metal — what was built, what surprised, what to remember next slice.

## Slice 2A.1 — Ingredient master, read path

**Status:** complete, deployed, smoke-tested 25/05/2026.

**Built:**
- Top-level "Admin" nav entry + home-page card.
- Route `/admin/ingredients` listing all 227 seeded ingredients.
- Server-side `ilike` search across `ingredient.canonical_name` and `ingredient_alias.alias` (alias match returns the canonical row).
- Two single-select filter dropdowns, AND'd: `ingredient_category`, `dietary_category`. Each with an "All" default.
- Columns: canonical_name, default_unit (blank if NULL), category name, dietary_category name.
- Sort: `ingredient_category.sort_order` then `canonical_name` alphabetic. Null category sorts last via `coalesce(sort_order, 999)`.

**Verification (Playwright):** all 227 rows render, alphabetic-within-category sort verified on first three rows, alias search ("aubergines" → "aubergine") works, category filter scopes to 55 produce rows, dietary filter scopes to 159 vegan rows.

**What landed cleanly:**
- F1's `/meals` route source was the right template. Mirrored its server-function data-fetching pattern; swapped the rendering layer to a table.
- Search + both filters compose in a single server function with no awkwardness.

**Notes for next slice:**
- "Admin / Ingredients" breadcrumb-style label above the h1 emerged from the build. Keep it as the pattern as more admin pages land.
- Null-category sort fallback (999) works but is currently dead code — every seeded ingredient has a category. Revisit if uncategorised ingredients appear.
- Table-style row layout rather than F1's card grid was the right call for flat reference data.

**Carry-forward to 2A.2:**
- Detail view at `/admin/ingredients/[id]`: canonical row + alias list.
- Edit form behind auth: canonical_name, default_unit, category_id, dietary_category_id, notes.
- Decision needed at prompt time: edit on the same page or push to a separate `/edit` route.

** Slice 2A.2 — Ingredient detail page (read-only)
Closed: 2026-05-25. Commits: 4fcd23e, b32c635.
Built:

admin.ingredients.tsx — minimal <Outlet /> layout
admin.ingredients.index.tsx — list (renamed from admin.ingredients.tsx, name cells now link to detail)
admin.ingredients.$id.tsx — detail page: breadcrumb, h1, four field rows (default_unit, category, dietary_category, notes — with "—" for null), aliases section, not-found state

Decision: Carry-forward 2A.2 was split. This slice is read-only. Edit (auth-gated form) moved to 2A.3. Alias add/remove deferred to 2A.4+.
Routing pattern: Initial implementation as two files (.tsx list + .$id.tsx detail) caused the detail to render as a nested child of the list. Restructured to three files matching F2 convention (now pinned in standing brief §14). F1's meals routes use a different pattern; reconciled when next touched.
workerd added to dependencies. Was missing from local node_modules, blocking the dev server. Committed to package.json so fresh clones get it. First commit (4fcd23e) only updated package-lock.json; Cloudflare build failed on frozen-lockfile. Second commit (b32c635) added the synced bun.lock. Standing brief §13 now spells out the both-lockfiles rule.
Playwright still ad-hoc via npx, not a committed dev dep. Same as 2A.1. Park for a tidy slice — possibly bundled with a wider environment-setup pass alongside .gitattributes for line endings.
Verification: Playwright cold-start, 8 steps green. Production smoke test on Workers URL passed after initial browser-cache stumble (chunk filenames changed; incognito confirmed the deployment was correct).

## Slice 2A.3 — Ingredient create and edit

**Status:** complete, deployed, smoke-tested 25/05/2026. Commits: `8ce62e2` (routing restructure), `9455e7d` (form addition).

**Built:**
- `IngredientForm` component at `src/components/ingredient-form.tsx`: fields for `canonical_name` (required), `default_unit`, `category_id`, `dietary_category_id`, `notes`. Shared between create and edit via an `initial` prop.
- Create page at `/admin/ingredients/new`. Edit page at `/admin/ingredients/$id/edit`.
- UI-only auth gate: writers see the form; non-writers see a sign-in or no-access panel (no redirect).
- `23505` constraint violation on `canonical_name` surfaces as "An ingredient with this name already exists." Non-23505 errors expose the raw Postgres message. On success, navigates to the detail page.
- `admin.ingredients.$id.tsx` restructured from detail view to a minimal `<Outlet />` layout; detail content moved to `admin.ingredients.$id.index.tsx`; edit sits at `admin.ingredients.$id.edit.tsx` as a sibling — the five-file pattern.

**Notes:**
- Diff-vs-approved guard (added to the 2A.3 prompt) caught an affordance gap on first use: CC's first proposed diff added Edit and New buttons that weren't in the spec's file list but were required to walk the smoke test path. CC flagged them rather than folding them in silently.
- Sort order still wrong at slice close-out — carried forward to 2A.4.
- Docs updated before build was confirmed green (process slip, no practical cost).

## Slice 2A.4 — Ingredient list sort fix + alias add/remove

**Status:** complete, deployed, smoke-tested 26/05/2026. Commit: `d446533`.

**Built:**
- **Sort fix** (`admin.ingredients.index.tsx`): added `.order("canonical_name")` to the list query before `await`. Dropped the client-side `useMemo` sort (which sorted by `ingredient_category.sort_order` then name — the v1 default per §3.11 is name-only alphabetical). Removed unused `useMemo` import.
- **`AliasSection` component** (`admin.ingredients.$id.index.tsx`): writer-gated add input + per-alias remove button. Query updated to fetch `ingredient_alias(id, alias)` (was `alias` only — `id` needed for React keying and the delete call). `IngredientDetail` type updated throughout.
- Add: inserts into `ingredient_alias`, clears input on success, surfaces `23505` as "This alias already exists.", exposes raw Postgres message otherwise — consistent with `IngredientForm`.
- Remove: deletes by `id`. No confirmation dialog.
- Both mutations call `queryClient.invalidateQueries` on `["admin-ingredient", id]` to re-fetch the full detail including the updated alias list.
- Single `busy` flag across add and remove — disables all affordances while a mutation is in-flight.

**Smoke test (7 items, all green):** alphabetical sort on list; logged-out alias list visible, no buttons; logged-in writer sees add input + X buttons; add works; remove works; duplicate alias → "This alias already exists."; whitespace-only input leaves button disabled (client-side trim guard).

## Slice 2A.5 — Safe-delete on ingredient detail page

**Status:** complete, deployed, smoke-tested (unauth items) 26/05/2026. Commit: `1837f5f`. Auth items handed to Mike.

**Built:**
- **`DeleteSection` component** (`admin.ingredients.$id.index.tsx`): writer-gated Delete ingredient button at the bottom of the detail page, below `AliasSection`, separated by a `border-t`.
- **Pre-check** (runs on Delete-button click, not on page load): three parallel Supabase queries against `meal_ingredient`, `component_ingredient`, and `shopping_list_item`, each joined to their parent name via PostgREST embedded resource syntax (`meal:meal_id(id, name)` etc.). Each query carries `.order("name", { foreignTable: "…" })` so display order is alphabetical and stable across repeat clicks. JS deduplication via `Map` keyed on id (preserves DB insertion order, which is the sorted order after the `.order()` call).
- **Dialog — two states** using `AlertDialog` (controlled via `open` state; plain `Button` elements in the footer rather than `AlertDialogAction`/`AlertDialogCancel`, so async delete controls open/close):
  - *Blocked*: header "Cannot delete '…'. It's used by:"; grouped sections (meals, components, shopping list items) shown only if non-empty; count + names with singular/plural; shopping list items show list names in parentheses. Single Close button, no Delete affordance.
  - *Confirm*: header "Delete '…'?"; body "Aliases will be removed. This cannot be undone." Cancel + Delete buttons.
- **Delete action**: `supabase.from("ingredient").delete().eq("id", …)`. Aliases cascade via existing `ingredient_alias.ingredient_id ON DELETE CASCADE` (verified in `recipe_db_install.sql` Section 4 before relying on it). On success: invalidates `["admin-ingredients"]` (prefix match covers all filter variants of the list query) then navigates to `/admin/ingredients`. On failure: closes dialog, surfaces "Could not delete — refresh and try again." inline on the detail page.
- **Error handling symmetry**: pre-check failure uses generic "Could not check references — refresh and try again." (not raw Supabase message), matching the delete-failure message style.

**Notes:**
- `shopping_list_item` is a writer-only table (authenticated read + write per RLS §5). The pre-check only runs when the Delete button is visible — which is writer-only — so the authenticated session is guaranteed when those queries fire.
- `AlertDialogDescription` is omitted in the blocked state (the title acts as the description); present in the confirm state for accessibility.
- List invalidation uses the partial key `["admin-ingredients"]` rather than the full `["admin-ingredients", { search, categoryId, dietaryId }]` — TanStack Query's partial-key invalidation hits all cached variants automatically.

**Smoke test:**
- Items 1–2 (unauthenticated, Playwright cold-start on production): **both green**.
  - [1] List page alphabetical sort — first 10 rows: apple, arborio rice, aubergine… — confirmed sorted.
  - [2] Detail page — Delete ingredient button not present for unauthenticated visitor — confirmed absent.
- Items 3–5 (authenticated, human-in-browser): **all green** (Mike, 26/05/2026).
  - [3] Signed in as writer — Delete ingredient button visible. ✓
  - [4] Referenced ingredient — not testable yet: adding ingredients to a meal or component is a future slice. Deferred; will re-run when that path exists.
  - [5] Unreferenced ingredient with aliases and without — confirmation dialog ("Aliases will be removed. This cannot be undone."), delete succeeds, redirects to ingredient list, row gone. ✓

## Slice 2B.1 — Validate-only import

**Status:** complete, deployed, smoke-tested 2026-05-28. Commits: `9e4f73a` (route + validator), `d145c22` (fixture fix).

**Built:**
- Validator service at `src/lib/import/validate.ts`: pure function over `(parsed JSON, LookupSets) → ValidationResult`. Covers all three import shapes (recipe, recipe+derived, component). Rules enforced: unknown top-level keys, import_type enum, required fields, external_ref regex, ingredient id regex + uniqueness, `{NNNN}` placeholder resolution (strict regex — near-miss forms are literal text), cross-shape constraints, derived-component reference checks (ingredient_ids vs parent ids, step_indices vs parent step range, within-payload ref uniqueness, parent ref collision), lookup-code resolution against live DB (cuisine, dietary_category, dietary_restrictions, nutritional_tags, meal_types, meal_formats, component_layers with relational framework/layer/family check), same classification checks applied to each derived_components[] entry. Advisory ingredient-consistency check (rule 204) deferred to 2B.2.
- Route at `src/routes/admin.import.tsx` at `/admin/import`. Lookup sets fetched on mount via useQuery (7 parallel Supabase queries including nested framework/layer/family). Parse failure and validation failure distinguished. Valid input → annotated summary (cuisine, dietary category, restrictions, tags, ingredient/step counts, derived component list). Invalid input → per-field error list with path and message. Result clears on textarea edit.
- No writes of any kind. Route renders for everyone (unauthenticated).

**Smoke test (36 fixtures, all Playwright cold-start on production, unauth):**
- 24 edge-case fixtures: 18 pass + 6 reject — all green.
- 12 web-sourced fixtures: all green after one fixture fix (see below).
- Human-auth items: null this slice (no auth-gated behaviour).

**Finding: classic-houmous cuisine code bug.**
The fixture used `"cuisine": "lebanese"` which is not a seeded cuisine code (`middle_eastern` is the correct seeded value). Validator correctly rejected it. Fixture updated to `middle_eastern`. This is a fixture-prep conversion error, not a validator or spec gap.

**Advisory deferral reconciliation:**
`advisory-consistency-trip` manifest row updated from "pass (advisory)" to "pass (advisory deferred to 2B.2)" — the validator doesn't implement rule 204 this slice, so no advisory is raised. The manifest now reflects what the validator actually does.

**Notes:**
- The `canValidate` guard requires both lookups loaded AND non-empty textarea. Smoke script needed a seeded `{}` in the textarea to wait for the Validate button to enable — not a bug, just a UX characteristic worth knowing for future test scripts.
- Pre-existing TypeScript errors in `admin.ingredients.$id.index.tsx` (lines 61–63, Supabase type inference on nested select) were present before this slice. New files are type-clean.

**Carry-forward to 2B.2:**
- Ingredient matching service: exact canonical → exact alias → pg_trgm fuzzy.
- Per-ingredient preview rows with candidate(s) and match type.
- Advisory ingredient-consistency check (rule 204) implemented now that matching is in place.
- Blocked-state delete smoke (2A.5 Finding 1) still reserved for 2B.3.

## Slice 2B.1.1 — Admin nav restructure

**Status:** complete, deployed, smoke-tested 2026-05-29. Commits: `38ed2c2` (main work), `36908a2` (flyout fix).

**Built:**
- `src/lib/nav.ts` — `mainSections` and `adminSections` arrays. Single source of truth; consumed by home page, admin landing, and GlobalNav.
- `src/routes/admin.index.tsx` — `/admin/` landing: h1 "Admin", card grid of `adminSections`.
- `src/components/global-nav.tsx` — global header in `__root.tsx`. Desktop ≥ md: brand left, nav links right; Admin label links to `/admin` (prefix-match active), adjacent chevron is the `DropdownMenuTrigger` (shadcn DropdownMenu, `modal={false}`). Mobile < md: hamburger opens a shadcn Sheet drawer; Admin is a clickable section header with Ingredients and Import indented below (`pl-7` vs `pl-3`), no collapse. Active-state convention: `text-foreground font-medium`; inactive: `text-muted-foreground hover:text-foreground`.
- `__root.tsx` — `<GlobalNav />` inserted after `<AuthStrip />`.
- `index.tsx` — local `<header>` removed; local `sections` replaced with `mainSections` import; Admin card points to `/admin`; h2 → h1.

**Finding:** `DropdownMenuItem asChild + Link` navigated but left the flyout open — cause not isolated. Fixed by replacing with `onSelect={() => navigate({ to: s.to })}` using `useNavigate()`. Pattern for future: `onSelect + navigate()` for Radix menus + client-side router; not `asChild + <Link>`.

**Smoke test:** 57 checks, all green, Playwright cold-start on production 2026-05-29.

## Slice 2B.2 — Ingredient matching, read-only

**Status:** complete, deployed, smoke-tested 2026-05-29. Commit: `ea8d79a`.

**Built:**
- `src/lib/import/matching.ts` — service: `matchIngredients(data)` makes parallel `supabase.rpc('match_ingredient')` calls over the parsed JSON's ingredient rows, applies per-row deduplication (exact wins over fuzzy on same ingredient_id; highest-precedence match kept per ingredient), resolves to `exact / ambiguous / fuzzy / none` outcomes.
- `src/lib/import/matching.ts` — advisory: `evaluateConsistencyAdvisory()` implements rule 204; fires when declared `dietary_category` rank < max ingredient rank across all exact-matched rows. Takes two maps (see Decision 51).
- `src/routes/admin.import.tsx` — dietary_category query extended to `select("id, code, rank")`; two new maps built (`dietaryCategoryRanks`, `dietaryCategoryCodeById`); three new state vars (`parsedData`, `matchingOutcome`, `isMatching`); "Match ingredients" button after green validation panel; per-ingredient preview panel (`exact` / `ambiguous` / `fuzzy` / `none` rows); amber advisory banner above the panel when rule 204 fires.
- `current/recipe_db_install.sql` §11 — `match_ingredient` Postgres function: exact canonical + alias, fuzzy canonical + alias (top 5 each, threshold 0.3, `LANGUAGE sql STABLE`).

**Smoke (unauthenticated, 15/15 green):** validate → Match button appears; match runs and renders per-ingredient rows with row ids; exact canonical names visible (`extra virgin olive oil`, `ground cumin`, etc. from the houmous fixture); fuzzy scores visible for prep-noted ingredients (`lemon, juiced`, `garlic clove, peeled`); no-match confirmed for the houmous fixture's `"ice-cold water"` ingredient (similarity to `"water"` falls below 0.3); advisory banner fires for `advisory-consistency-trip-fires` (declared `vegan`, strictest ingredient `vegetarian` shown); textarea edit clears panel and banner; re-validate clears matching.

**Human auth:** null this slice. Matching preview is read-only; route is unauthenticated.

**Key decisions and findings:**
- Decision 51: advisory function takes two maps (`dietaryCategoryRanks` code→rank, `dietaryCategoryCodeById` id→code). Adding the code column to the RPC return would duplicate data already in the dietary_category lookup — two-map approach keeps the SQL function lean.
- `"ice-cold water"` from the houmous fixture produces no match — first real-fixture datum on the threshold's precision-over-recall behaviour. 2B.3 to accumulate more observations before tuning.
- Manifest reconciliation (advisory fixtures): both rows matched reality exactly, no edit needed.

**Carry-forward to 2B.3:** see planning log 2B.2 carry-forward block.

## Slice 2B.3 — Disambiguation + commit

**Status:** complete, deployed, smoke-tested 2026-05-30. Commits: `db78045` (main slice), `29eaa7c` (placeholder fix).

**Built:**
- `src/lib/import/commit.ts` (new): `commitImport()` calls `commit_import` RPC; discriminates `23505` on `meal_external_ref_key` vs `ingredient_canonical_name_key` positively; unknown `23505` falls through to `kind: "error"`.
- `current/recipe_db_install.sql` §11: `commit_import` Postgres function — single transaction writing `import_log`, `meal`, `ingredient` (create_new choices), `meal_ingredient`, `meal_step`, `meal_restriction`, `meal_nutritional_tag`, `meal_meal_type`, `meal_meal_format`. Returns new `meal.id`. Builds `id_map` (local JSON id → `meal_ingredient.id`) and rewrites `{NNNN}` in step content before storing.
- `src/routes/admin.import.tsx`: interactive matching panel — `ExactRow` (✓ + Override combobox, default-collapsed), `AmbiguousRow` (radio over candidates), `FuzzyRow` (radio: candidates + override combobox + create-new mini-form), `NoneRow` (override combobox or create-new mini-form). `IngredientCombobox` (Popover + Command), `CreateNewForm` (controlled, no internal state), `CommitArea` with writer gate and blocking banners. `ChoiceState` widened with partial states so radios stay selected while inner value populates.
- `src/routes/meals.$mealId.index.tsx`: `formatIngredient` + `resolvePlaceholders` helpers; `Steps` now resolves `{meal_ingredient.id}` placeholders at render time.

**Smoke:**
- Unauth (8/8, Playwright, production, 2026-05-30): all green. Fixtures: `marinated-teriyaki-eggplant.json` (recipe-only), `north-african-spiced-shepherds-pie.json` (derived_components), `minimal-component.json` (component).
- Auth (Mike, browser, production, 2026-05-30):
  - Item 5: `classic-houmous.json`. Exact rows ✓, fuzzy rows disambiguated, `ice-cold water` created as new ingredient. Commit succeeded. ✓
  - Item 6 (initial): failed — literal `{0010}` placeholders in step content. Placeholder fix applied (commit `29eaa7c`), SQL re-installed, stale meal deleted.
  - Item 6 (re-run): step placeholders resolved correctly (e.g. "Rinse 150 g green or brown lentils, dried"). Ingredient list and group labels correct. ✓
  - Item 7: re-import detection — "An import with this external_ref already exists. Re-import / update lands in F2C." No new meal row. ✓
  - Item 8: blocked-delete dialog rendered for ingredient used by imported meal. Meal name listed, no Delete affordance. 2A.5 Finding 1 carry-forward closed. ✓

**Findings:**
- Placeholder bug root cause: two-part. SQL stored local ids in step content; renderer had no substitution path. Both fixed. See planning log 2B.3 finding.
- Navigation and auth-return issues surfaced in smoke but held back from this slice (Mike, deliberate). Three issues logged in planning log: import back-link wrong destination, ingredients back-link skips admin index, magic-link loses page context and form state. Carry-forward to tidy slice.
- `error.details` shape for `duplicate_ingredient_name` 23505 path not directly observed this slice.
- Fuzzy threshold (0.3): `ice-cold water` produced no match again — second observation, same fixture. Still insufficient data to recommend a change.

**(b2) milestone progress:** `classic-houmous.json` imported end-to-end — first fixture to land via the importer. Remaining recipe-shape `web_sourced` fixtures and the stripped shepherd's pie still pending before (b2) closes.
