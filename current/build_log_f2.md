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
