# Build Log — F2C: Recipe re-import (upsert)

Per-slice notes from building F2C. Same format as `archive/build_log_f2.md`. Decisions of structural significance live in `current/planning_log.md`; this file is closer to the metal — what was built, what surprised, what to remember next slice.

---

## Slice 2C.1 — Cleanups

**Status:** complete. Build confirmed green 2026-05-31. Commit: `5fc6ad5`.

### Built

- **`src/lib/import/commit.ts` — name-extraction fix.** Replaced the `detail.match(/\(([^)]+)\) already exists/)` regex (always `null` for RPC 23505s, per F2 close-out finding) with a lookup against the `ingredientChoices` map's `create_new` entries. Three cases: single `create_new` → use its `canonical_name` directly; multiple `create_new` → async `supabase.from("ingredient").select(...).in(...)` check to identify which ones already exist in the master, join with `, `; zero `create_new` (race condition) → return `name: null`. `CommitOutcome`'s `duplicate_ingredient_name` variant updated to `name: string | null` (see Findings).

- **`src/routes/admin.import.tsx` — stale string update.** `CommitArea`'s `hasDerivedComponents` block heading changed from `"Derived component import lands in F2C"` to `"Derived component import lands in F3"` per Decision 50. `CommitErrorPanel` updated to branch on `outcome.name !== null`: named message when name is known, generic fallback when null.

- **`src/lib/import/strip_list.ts` — new module.** Exports `StripList` interface and `getStripList()` returning the v1 curated vocabulary (18 prep verbs, 5 modifying adverbs, 3 size adjectives). Function-and-interface shape per Decision 54; groups are separate arrays, not flattened, so the variant-generation algorithm can apply different position rules per group.

- **`src/lib/import/matching.ts` — prep-adjective stripping.** New `generateVariants(name, stripList)` generates up to 4 variants per ingredient name: original; strip trailing comma-clause (fires when all post-comma tokens are in `prep_verbs ∪ modifying_adverbs`); strip leading size adjective (fires when the first word is in `size_adjectives`); strip both (apply leading strip to the trailing-stripped result). Variants are deduplicated with original first. `matchIngredients` now runs `match_ingredient` against all variants in parallel; prefers exact/ambiguous from original first, then stripped variants in order (original-first is a tiebreaker within the exact bucket — a fuzzy on original still loses to an exact on a stripped variant); if no exact found, merges fuzzy candidates from all variants, deduplicating by `ingredient_id` and keeping the highest `similarity_score`. `IngredientMatch` gains an optional `matched_variant?: string` field, set when the winning exact match came from a stripped variant.

- **`src/routes/admin.import.tsx` — strip annotation in ExactRow.** New `stripAnnotation(rowName, matchedVariant)` helper computes the stripped label: if `matchedVariant` is a prefix of `rowName` → `(stripped: ", minced")`; if suffix → `(stripped: "large ")`; otherwise → `(matched as "garlic cloves")` for the strip-both case. Annotation rendered alongside the canonical name when `matchedVariant` is set and the operator has not overridden. `MatchRow` passes `match.matched_variant` to `ExactRow`.

- **`current/enhancements.md` — user-editable strip-list paragraph** appended to the prep-adjective stripping entry per Decision 54.

### Smoke

`@playwright/test` added as devDependency in this slice (commit `5ef57c4`, both lockfiles synced), removing the npx cold-start dependency for future smoke runs.

**Unauth (Playwright, production, 2026-05-31):**
- `/admin/import` while signed out → redirect to `/admin`. Pass.

**Auth (Mike, browser, production, 2026-05-31):**
1. Classic Houmous (`classic-houmous.json`, 8 ingredients): 6 exact — 2 with strip annotation (`lemon, juiced → lemon (stripped: ", juiced")`; `garlic clove, peeled → garlic clove (stripped: ", peeled")`), 4 without — 2 fuzzy (chickpeas, ice-cold water). Annotation visible and correctly positioned; override path unaffected. Pass.
2. Bread Pudding (`bread-pudding.json`, 11 ingredients): 8 exact — 7 without annotation, 1 via alias (`milk → whole milk (via alias "milk")`); 3 fuzzy (suet, salt, grated nutmeg). No strip annotations fired. Panel renders identically to pre-stripping for fixtures with no strippable suffix forms. Pass.
3. Dupe-name trip (`duplicate-ingredient-name-trip.json`): Create New → `canonical_name = olive oil` → Commit → error message reads `An ingredient called "olive oil" already exists.` Not "unknown". Pass.

### Findings

#### Strip count from smoke

2 strips fired across the smoke fixtures, both trailing comma-clause on prep_verbs:
- `lemon, juiced` → `lemon` (Classic Houmous)
- `garlic clove, peeled` → `garlic clove` (Classic Houmous)

No leading-size-adjective or strip-both cases in the smoke fixtures.

#### Name-extraction fix: `name: string | null` shape

The zero-`create_new` race-condition case was initially planned as `name: ""` (empty string sentinel). Revised to `name: string | null` on the `duplicate_ingredient_name` variant of `CommitOutcome` before implementation. Reasoning: `null` carries unambiguous TypeScript semantics ("intentionally absent value"); empty string does not. The UI branches on `outcome.name !== null` rather than on string emptiness — the contract is explicit in the type, not implicit in the value.

#### `grated nutmeg` — leading prep_verb not stripped

Bread Pudding smoke: `grated nutmeg` landed fuzzy (0.50 against `nutmeg`). Expected: the leading-strip rule applies only to `size_adjectives` (large, medium, small), not `prep_verbs`. "grated" is in `prep_verbs`, so no strip fires. This is correct — "grated parmesan", "grated coconut" are canonical name forms where a leading prep_verb should not be stripped. Fixture-prep convention for 2C.3: recipes using leading prep_verb forms (`grated nutmeg`, `chopped parsley`) should be converted to trailing-clause forms (`nutmeg, grated`; `parsley, chopped`) at re-import time so the strip rule fires.

#### Strip-list collision investigation

The (b2) cumulative ingredient list was reviewed against strip-list variants to identify cases where stripping could produce an exact match on a canonical that is not what the recipe intends.

**Canonical-modifier safety (`dried`, `fresh`, `tinned`, `ground`, `whole`):** The strip-list contains only process verbs and adverbs (`chopped`, `minced`, `juiced`, `finely`, `roughly`, etc.) and size adjectives (`large`, `medium`, `small`). None of the canonical-identity modifiers appear in the strip list. The trailing-clause rule fires only when every post-comma token is in `prep_verbs ∪ modifying_adverbs`, so `oregano, dried` would not strip (since `dried` is not in either group). No canonical-modifier false-match is possible with the current strip-list. This was the primary safety concern the spec flagged; it is not present.

**Two watch-list cases for 2C.3 observation:**
- `mushrooms, sliced` → strips to `mushrooms`. If the master has `mushrooms` as a canonical alongside specific forms (`chestnut mushrooms`, `shiitake mushrooms`), this strip could match generic `mushrooms` when the recipe intended a specific variety. Not confirmed as a false match — depends on master state — flagged for observation.
- `ginger, grated` → strips to `ginger`. If the master has `ginger` as a canonical alongside `fresh ginger` and `pickled ginger`, the strip could match the wrong canonical. Same caveat — observation only.

This finding closes out the close-out prompt's strip-list collision item. No further carry-forward to the F2C close-out is needed beyond watching these two cases during the 2C.3 sweep.
