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
