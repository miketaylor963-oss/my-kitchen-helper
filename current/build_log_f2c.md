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

---

## Slice 2C.2 — Upsert RPC + UI flow

**Status:** complete. Build confirmed green 2026-05-31. Commit: `3c7e6db`.

### Built

- **`current/recipe_db_install.sql` §11 — `commit_import` extended.** Added `on_conflict TEXT DEFAULT 'fail'` as third parameter. Block 4 (meal insert) now branches: `'fail'` path is the existing INSERT unchanged; `'update'` path SELECTs the existing `meal.id`, UPDATEs the meal row in place, DELETEs from all six child tables (`meal_ingredient`, `meal_step`, `meal_restriction`, `meal_nutritional_tag`, `meal_meal_type`, `meal_meal_format`), then falls through to the existing blocks 5–10 which re-populate from scratch. `import_log` rows are not deleted — prior rows remain as audit trail. Unknown `on_conflict` value raises EXCEPTION. `CREATE OR REPLACE` applied to live Supabase by Mike post-push.

- **`src/lib/import/validate.ts` — `ValidationResult` extended.** Success branch gains `existing_meal: { id: number; name: string } | null`. The pure `validate()` function returns `existing_meal: null` (no DB access). DB lookup deferred to the route handler.

- **`src/routes/admin.import.tsx` — async `handleValidate` + upsert advisory UI.** `handleValidate` made async. After structural validation passes, a single `supabase.from("meal").select("id, name").eq("external_ref", ref).maybeSingle()` lookup populates `result.existing_meal` before `setOutcome`. Added `replaceConfirmed` state (default `false`), reset in `handleTextChange` and `handleMatch`. New `UpsertAdvisoryBanner` component renders at the top of the matching section when `existingMeal !== null && matchingResult` — blue/informational tone, two buttons: **Replace existing** (sets `replaceConfirmed = true`, button toggles to "✓ Replace confirmed") and **Cancel** (clears `matchingOutcome`, `choices`, `replaceConfirmed`, `commitOutcome`). `CommitArea` gains `replaceRequired` prop; Commit disabled when `replaceRequired` is true; inline "Confirm Replace above to enable commit." message below the button when blocked by advisory. `duplicate_external_ref` fallback message reworded to race-condition framing.

- **`src/lib/import/commit.ts` — `onConflict` parameter.** `commitImport` gains `onConflict: "fail" | "update" = "fail"`. Passed as `on_conflict` in the RPC call. Route passes `replaceConfirmed ? "update" : "fail"`.

- **`current/enhancements.md` — matching memory entry.** Appended under Import / matching with "becomes worth building when" trigger per Decision 53.

### Smoke

**Unauth (Playwright, production, 2026-05-31):**
- `/admin/import` while signed out → redirect to `/admin`. Pass.

**Auth (Mike, browser, production, 2026-05-31):**

1. Classic Houmous validate: advisory banner renders at top of matching section — "This will update the existing recipe 'Classic Houmous'. Choose Replace to overwrite, or Cancel to abandon this import." Matching rows below (6 exact, 2 fuzzy: chickpeas, ice-cold water), strip annotations intact. Commit disabled. Pass.
2. Cancel: matching state cleared, returns to green validation panel with "Match ingredients" button active, JSON still populated. Pass.
3. Re-validate → advisory → Replace existing (toggles to "✓ Replace confirmed") → resolve chickpeas and ice-cold water → Commit: success, navigates to meal detail. Pass.
4. SQL checks (production):
   - `meal` row: `id=5`, `external_ref='classic-houmous'`, `name='Classic Houmous'`, `import_id=21`. `id=5` stable (unchanged from original import). Pass.
   - `import_log` rows for `classic-houmous`: ids 4 and 21 — audit trail preserved across upsert. Pass.
   - `meal_ingredient` count: `SELECT COUNT(*) FROM meal_ingredient WHERE meal_id = 5` → **8**. DELETEs fired cleanly; re-INSERT produced exactly the expected rows, not a pile-on. Pass.
5. First-import regression (`min-placeholder-density.json`, Lemon-Roasted Cauliflower, 7 ingredients, 3 steps): no advisory banner (first-import path). `on_conflict='fail'` default active. New strip observed: `capers, rinsed` → `capers (stripped: ", rinsed")`. Manual choices: `cauliflower, broken into florets` → cauliflower (fuzzy); `lemon, sliced into rounds` → lemon (no match, override); `flat-leaf parsley, chopped` → fresh parsley (fuzzy); `sea salt flakes` → flaky sea salt (fuzzy, 0.71). Commit succeeded, meal detail accessible. Pass.
6. `duplicate-ingredient-name-trip.json`: Create New → `canonical_name = onion` → Commit → error "An ingredient called 'onion' already exists." Pass. Note: Mike used `onion` as the collision canonical rather than `olive oil` from the 2C.1 smoke — both are valid pre-existing canonicals and the collision fires either way, but the regression trail now references two different collision targets for this fixture. Not a problem; noted for consistency.

### Findings

#### `meal.id` stability confirmed

`id=5` unchanged across the upsert. The UPDATE + child-DELETE + re-INSERT path in `commit_import` preserves the parent row identity. Any FK references to `meal.id` (e.g. `meal_cooked_log`, `meal_plan_entry`) would survive a re-import — though none exist yet for houmous.

#### `import_log` audit trail confirmed

Two rows for `classic-houmous` (ids 4 and 21): the original 2B.3 import and the 2C.2 re-import. `meal.import_id` points to the newest row (21); prior rows survive undeleted.

#### `meal_ingredient` count confirmed at 8

`SELECT COUNT(*) FROM meal_ingredient WHERE meal_id = 5` returned 8. Confirms the six unconditional DELETEs in the update branch ran correctly and the re-populate produced a clean set of child rows, not an accumulated pile from multiple imports.

#### New strip annotation in item 5

`capers, rinsed` → `capers (stripped: ", rinsed")` — "rinsed" is in `prep_verbs`. Third strip annotation observed across slice smoke tests (after `lemon, juiced` and `garlic clove, peeled` from 2C.1). No false-match concern: `capers` is the correct canonical.

#### Item 5 strip misses — expected

`cauliflower, broken into florets` and `lemon, sliced into rounds` did not strip. "broken", "into", "florets", "rounds" are not in `prep_verbs` or `modifying_adverbs`. Both required manual choices. Consistent with spec.

#### No UI surprises

Advisory banner, replace/cancel flow, commit gate, and the "✓ Replace confirmed" toggle all behaved as specified. Race-condition path (`duplicate_external_ref` 23505) not exercised by smoke — expected, since the upsert path intercepts before the DB constraint fires.

---

## Slice 2C.3 — Recipe re-import sweep

**Status:** complete with partial coverage. Build confirmed green 2026-06-02. Five of twelve recipe-shape fixtures landed via upsert; one inserted-then-deleted (slug mismatch); five deferred to a post-2C.4 re-import slice pending canonical slug convention.

### Built

No application code in this slice. The slice landed four rounds of mid-slice spec amendments (round 1: `base_servings` nullable + validator fix + convention layer; round 2: concurrency rule + post-cook rest clarification + duplicate-rows convention + base_servings discipline; round 3: in-session passive waits regardless of position; round 4: method-only optional ingredients) and exercised the upsert path against five re-converted fixtures.

### Sweep — per-fixture data

#### 1. Lemon cheesecake (row 13)

**Outcome:** committed via upsert path (Replace confirmed).
**Match breakdown:** 5 exact, 0 ambiguous, 0 fuzzy, 1 none. Total 6.
**None ingredients:** `lemons, grated rind and juiced` → chose existing `lemon`.
**New ingredients created:** none.
**23505 paths fired:** none.
**Advisory banner:** not fired (would not have been triggered by content; declared `vegetarian`, no rank conflict).
**Notable:** First `base_servings: null` confirmation on the upsert path — committed cleanly. Multi-prep trailing form (`, grated rind and juiced`) not handled by current strip-list; fell through to none.

#### 2. Aubergine parmigiana (row 24, inserted then deleted)

**Outcome:** inserted as a new row rather than upserting onto row 8 (existing). Root cause: slug mismatch. The fresh re-conversion produced `external_ref: aubergine-parmigiana`; the existing (b2) row had `aubergine-parmigiana-cloake` preserving the Felicity Cloake attribution. Upsert path correctly fell through to insert when the key didn't match. Row 24 was deleted post-sweep; row 8 retained as canonical. Slug mismatch root cause logged; canonical slug convention deferred to 2C.4.
**Match breakdown (informational, on the new row):** 11 exact, 0 ambiguous, 4 fuzzy, 0 none. Total 16.
**Fuzzy picks:** `garlic cloves, crushed` → `garlic clove` (0.80); `salt` → `fine salt` (0.50, observed first instance of `salami` 0.33 false-positive in candidates); `oil` → `olive oil` (0.44, fixture-side "Oil, to fry" with five oil candidates, none confident); `basil leaves` → `fresh basil` (0.32).
**None ingredients:** none.
**New ingredients created:** none.
**23505 paths fired:** none.
**Advisory banner:** not fired.

#### 3. Bread pudding (row 7)

**Outcome:** committed via upsert path (Replace confirmed).
**Match breakdown:** 9 exact (including 1 alias `milk` → `whole milk`, 1 strip `nutmeg, grated` → `nutmeg`), 0 ambiguous, 2 fuzzy, 0 none. Total 11.
**Fuzzy picks:** `suet` → `vegetarian suet` (0.31, low score on a semantic match); `salt` → `fine salt` (0.50, `salami` 0.33 observed second time).
**None ingredients:** none.
**New ingredients created:** none.
**23505 paths fired:** none.
**Advisory banner:** not fired (declared `vegetarian`, no rank conflict).
**Notable:** Second `base_servings: null` confirmation — committed cleanly. Functional amounts (`amount: null`) rendered correctly on the recipe view.

#### 4. Harissa pie (row 12)

**Outcome:** committed via upsert path (Replace confirmed).
**Match breakdown:** 16 exact (8 direct + 4 via strip + duplicates that round-tripped cleanly), 0 ambiguous, 11 fuzzy, 0 none. Total 27.
**Fuzzy picks:** `floury potatoes, peeled and chunked` → `floury potatoes` (0.48); `sweet potatoes, peeled and chunked` → `sweet potato` (0.36); `salt` (×2) → `fine salt` (0.50, third and fourth `salami` 0.33 observation); `courgettes, cut into 1.5cm dice` → `courgette` (0.37, with alias annotation `courgettes`); `garlic cloves, finely chopped` → `garlic clove` (0.80); `rose harissa` → `rose harissa paste` (0.68); `tinned chopped tomatoes` → `tinned tomatoes` (0.68); `red split lentils` → `red lentils` (0.67); `miso paste` → `white miso paste` (0.69); `chickpeas, drained and rinsed` → `tinned chickpeas` (0.36).
**None ingredients:** none.
**New ingredients created:** none.
**23505 paths fired:** none.
**Advisory banner:** not fired (declared `vegan`, all ingredients vegan-ranked).
**Notable:** 41% fuzzy rate — the heaviest fuzzy load of the sweep. Almost all driven by multi-prep trailing forms (`, peeled and chunked`, `, drained and rinsed`) or mid-name modifier shifts (`tinned chopped tomatoes` ↔ `tinned tomatoes`). Duplicate-row convention round-tripped correctly: cumin and paprika each present in two groups, salt in two groups, all resolved independently. `courgettes, cut into 1.5cm dice` matched via alias but rendered as fuzzy at 0.37 — the alias path produced a match but didn't promote to exact. Worth flagging.

#### 5. Ramen (row 15)

**Outcome:** committed via upsert path (Replace confirmed). Slug fix required: fresh re-conversion produced `vegetarian-ramen`; manually corrected to `ramen-hairy-bikers` (the existing row's slug) before import. Confirmed slug-match → upsert-replace behaviour.
**Contrivance applied:** `dietary_category` flipped from `vegetarian` to `vegan` to test the advisory banner trigger (`tamago` ingredient is vegetarian-ranked; would conflict with declared vegan). Reverted to `vegetarian` post-commit via SQL.
**Match breakdown:** 11 exact (8 direct + 1 strip), 0 ambiguous, 9 fuzzy, 3 none. Total 23.
**Fuzzy picks:** `dried shiitake mushrooms` → `shiitake mushrooms` (0.76); `garlic cloves, thinly sliced` → `garlic clove` (0.80); `fresh root ginger, thinly sliced` → `fresh ginger` (0.72); `miso paste` (×2) → `white miso paste` (0.69); `spring onions` → `spring onion` (0.80); `tamago eggs, halved` → `tamago` (0.58).
**None ingredients:** `large carrot, cut into 0.5cm diagonal slices` → chose existing `carrot`; `ramen noodle blocks` → chose existing `noodles`; `nori sushi seaweed, roughly torn` → chose existing `nori sheets`.
**New ingredients created:** none.
**23505 paths fired:** none.
**Advisory banner:** **NOT fired, despite genuine rank conflict.** Declared `vegan`, `tamago` resolved to a vegetarian-ranked master ingredient (confirmed by Mike). Banner should have fired; did not. Root cause identified — see Findings.
**Notable:** Three "none" rows all reflected fixture-side over-specification against a less-specific master canonical. Slug-fix-then-upsert worked correctly. Banner gap confirmed via deliberate trigger.

#### 6. Banana bread (row 9)

**Outcome:** committed via upsert path (Replace confirmed).
**Match breakdown:** 8 exact (6 direct + 2 strip — `butter, softened` → `butter`, `large eggs, beaten` → `large eggs`), 0 ambiguous, 0 fuzzy, 1 none. Total 9.
**None ingredients:** `very ripe bananas, mashed` → chose existing `banana`.
**New ingredients created:** none.
**23505 paths fired:** none.
**Advisory banner:** not fired (`allExact` gate prevented evaluation due to one none row).
**Notable:** Cleanest fixture of the sweep — 89% exact, no fuzzy load. The one none case is the same pattern as ramen's three: leading descriptor (`very ripe`) plus pluralisation prevented match against shorter master canonical (`banana`). Master had `banana` but matcher couldn't surface it from `very ripe bananas, mashed`.

### Sweep — cumulative data

- **Total ingredient rows assessed:** 92 (across six imports — five committed, one inserted-then-deleted).
- **Match distribution (committed imports only, 76 rows):** 46 exact (61%), 0 ambiguous, 23 fuzzy (30%), 7 none (9%).
- **No 23505 paths fired across the sweep.** Already exercised in 2C.1 smoke item 3.
- **No new ingredients created across the sweep.** Every fuzzy and none row resolved against an existing master ingredient.
- **Advisory banner observations:** banner did not fire on any fixture, including the deliberate ramen contrivance. Root cause confirmed in code.

### Findings

#### Strip-list extension candidates (multi-pattern)

The sweep produced compelling data on strip-list gaps, building on the (b2) cumulative findings:

- **Multi-prep trailing forms.** `, peeled and chunked`, `, drained and rinsed`, `, thinly sliced`, `, cut into Xcm dice`, `, roughly torn`, `, finely chopped` (when on plural noun), `, grated rind and juiced`. Observed in ~9 rows across the sweep. Single-verb trailing forms (`, mashed`, `, beaten`, `, softened`, `, quartered`, `, chopped`, `, crushed`) strip correctly via the current strip-list.
- **Pluralisation.** `spring onions` ↔ `spring onion`, `bananas` ↔ `banana`, `chickpeas` ↔ `chickpea`, `aubergines` ↔ `aubergine` (handled by alias for some; not all). Observed in ~5 rows. Singular ↔ plural collapse would be a small, high-yield extension.
- **Leading descriptors.** `very ripe`, `large` (when not part of a canonical form like `large eggs`), `small`, `extra-firm`. Observed in 2 rows. Carve-out needed: `large eggs` and `small potatoes` are canonical shopping-list distinctions.
- **Mid-name modifier mismatches.** `tinned chopped tomatoes` ↔ `tinned tomatoes`, `red split lentils` ↔ `red lentils`, `rose harissa` ↔ `rose harissa paste`, `miso paste` ↔ `white miso paste`, `dried shiitake mushrooms` ↔ `shiitake mushrooms`, `fresh root ginger` ↔ `fresh ginger`. Observed in ~7 rows. Strip-list doesn't directly address this; the issue is fixture-side under- or over-specification against the master canonical. Possible addresses: alias system expansion, or fixture-prep convention guidance (see Carry-forward).

Filed as recommendations for the strip-list extension slice — code changes deferred per (b2) carry-forward.

#### Threshold-tuning data — strip first, threshold second

Fuzzy bucket structure across the sweep:

| Score band | Pattern | Real-match count | Noise count |
|---|---|---|---|
| 0.80 | Pluralisation + light trailing | 3 | 0 |
| 0.65–0.75 | Mid-name modifier shift | 7 | 0 |
| 0.45–0.65 | Heavier mismatch but real | 6 | 0 |
| 0.30–0.45 | Heavy descriptors + plural | 6 | ~5 (`salami` ×4 for `salt`, `puy lentils`, `chipotle paste`) |

A threshold raise to 0.40 would cut most noise but would also lose `sweet potato` (0.36), `courgette` (0.37), `chickpeas, drained and rinsed` → `tinned chickpeas` (0.36), `basil leaves` → `fresh basil` (0.32). Strip-list extension would move several of those into exact territory, leaving a cleaner residual bucket for threshold tuning. **Confirms (b2) Decision-46's sequencing: strip-list first, threshold second, against post-strip residuals.**

#### Advisory banner (rule 204) — confirmed broken

The deliberate ramen contrivance produced the first observed instance of the rank conflict in production-like conditions: declared `dietary_category: vegan` with `tamago` ingredient (master classification: vegetarian, confirmed via the ingredients table). Banner did not fire; recipe committed without warning.

Root cause located: `evaluateConsistencyAdvisory` in `src/lib/import/matching.ts:241` reads:

```ts
const allExact = matching.rows.every((r) => r.outcome.kind === "exact");
if (!allExact) return { kind: "silent", reason: "not_all_resolved" };
```

The check gates on every row resolving as `exact`. Fuzzy-with-picked-candidate and none-with-chose-existing both have a resolved `candidate.dietary_category_id` available, but their `outcome.kind` is `fuzzy` or `none`, not `exact`. The advisory check sees `not_all_resolved` and stays silent. Ramen's 9 fuzzy + 3 none rows triggered this gate even though every row was resolved by the operator.

**Why (b2) didn't catch this:** every (b2) fixture had at least some fuzzy or none rows, so the advisory never ran. The carry-forward marked it as "untested" rather than "broken" because there was never enough data to distinguish. The 2C.3 contrivance produced the data; the (b2) framing was wrong.

Fix likely small: evaluate against resolved candidates regardless of outcome kind, skipping only create-new and unresolved rows. Filed for an importer-fix slice.

#### `updated_at` not refreshed on upsert-replace — confirmed broken across all five committed rows

All five upserted rows (7, 9, 12, 13, 15) show `updated_at` equal to `created_at`, despite confirmed content updates and refreshed `import_id` values. Root cause: schema declares `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` but defines no `ON UPDATE` trigger. The commit path doesn't set `updated_at` explicitly. Result: `updated_at` retains its insert-time value permanently.

Fix likely small: DB trigger to refresh `updated_at` on UPDATE for each table with the column. Applied via the next schema install / migration. Filed for an importer-fix slice.

#### Slug-mismatch handling — working as designed, but reveals convention gap

Aubergine parmigiana's slug mismatch (`aubergine-parmigiana` fresh vs `aubergine-parmigiana-cloake` existing) produced a fresh insert rather than an upsert-replace. UI correctly did not display the "This will update..." message (no key match found), and the commit path correctly inserted a new row. **System behaviour is correct.** The gap is in the fixture-prep / converter side: fresh re-conversions don't preserve original slugs, because the converter only sees the PDF and has no visibility into prior slug choices.

Five fresh re-conversion fixtures show slug mismatches against existing rows:

| Fresh slug | Existing slug |
|---|---|
| `aubergine-parmigiana` | `aubergine-parmigiana-cloake` |
| `black-bean-patties-portobello` | `black-bean-patties-portobello-mushrooms` |
| `north-african-spiced-shepherds-pie` | `north-african-spiced-shepherds-pie-stripped` |
| `vegetarian-ramen` | `ramen-hairy-bikers` |
| `marinated-teriyaki-aubergine` | `marinated-teriyaki-eggplant` |

Five other fresh re-conversions matched the existing slug by coincidence (author-free, suffix-free names).

**Model contribution:** (b2) used Opus 4.7; updates used Sonnet 4.6. Opus tended to add author or disambiguator suffixes (`-cloake`, `-hairy-bikers`, `-portobello-mushrooms`); Sonnet stripped them. British English conversion (eggplant → aubergine) also shifted slugs even when the existing row already used the British form.

Resolution: canonical slug convention to be established in 2C.4 as part of the converter prompt rework, then a re-import slice applies it to the five unlanded fixtures.

#### Cuisine and master vocabulary observations (build-log, no action this slice)

- Cuisine codes flagged repeatedly as unconfirmed against database vocabulary: `italian`, `middle_eastern`, `mediterranean`. Each resolved correctly (italian = 5, middle_eastern = 10, etc.) but the converter has no schema visibility to confirm in advance. Master-vocabulary territory, not spec or converter prompt.
- Dietary restriction granularity: `nuts` vs distinct tree-nut codes; `gluten` for oat milk via cross-contamination risk. Converter consistently inferred conservatively. No spec change.

#### Stale slice-prompt wording

The 2C.3 slice prompt's Step 4 description includes language inherited from (b2) on the 23505 path: *"2B.3 did not exercise this path and the fallback `name: 'unknown'` is still untested."* This was resolved in 2C.1 smoke item 3 (`duplicate-ingredient-name-trip.json`, name extraction returning the specific canonical). The slice prompt should have been updated at 2C.1 close-out. Logged as a discipline observation — minor — for slice-prompt freshness review at future feature close-outs.

### Carry-forward

For 2C.4:
- **Canonical slug convention.** The converter prompt rework must produce deterministic slugs that don't drift across re-conversions. Suggested rule shape: base slug from name (kebab-cased, lowercase, British English); optional author-or-source suffix when the recipe is closely associated with one; optional disambiguator suffix for library-internal distinctions. Operator-amendable at fixture-prep time. Documented in the converter prompt, not the spec (slugs are identifiers, not data).
- **Discipline patterns for the converter prompt rework.** Two failure modes surfaced during fresh re-conversions: (1) convention applied without checking whether the precondition holds (concurrency rule triggered on sequential recipes); (2) convention extended by analogy mid-conversion (in-session chill rule extended to soaks before the spec was updated). Worth specific prompt language addressing both.
- **Standard converter prompt with batch / interactive modes.** The spec's conversion-time prompt assumes an operator is present to confirm derivations; the batch-mode fresh-chat workflow has no operator. This is the original 2C.4 trigger.
- **Fresh re-conversion of the five slug-mismatched fixtures**, against the twice-amended-plus-4-rounds spec, using the canonical slug convention. Run after 2C.4 lands; happens externally in fresh chats.

For a post-2C.4 re-import slice:
- Re-import the five slug-fixed fixtures via upsert. Closes the F2C content milestone coverage gap.

For an importer-fix slice:
- **Advisory banner (rule 204) gate fix.** Edit `src/lib/import/matching.ts:241` to evaluate against resolved candidates regardless of outcome kind. Skip only create-new and unresolved rows.
- **`updated_at` trigger.** Add `ON UPDATE` triggers (or equivalent) to maintain `updated_at` on `meal` and any other tables with the column. Applied via schema install / migration.
- **`courgettes` alias case rendered as fuzzy not exact.** The alias system found `courgettes` → `courgette` but the row rendered at 0.37 fuzzy with the alias annotation. Investigate whether alias-via-fuzzy is intended behaviour, or whether alias matches should promote to exact.

For the strip-list extension slice (already filed via b2 carry-forward; this slice adds concrete data):
- Multi-prep trailing forms (~9 observed cases).
- Pluralisation rule with carve-outs for canonical-plural forms (~5 cases).
- Leading descriptor stripping with carve-outs for canonical-prefix forms like `large eggs` (~2 cases).
- Mid-name modifier handling — possibly alias-system territory rather than strip-list (~7 cases).

For F2C close-out at 2C.4:
- Planning log F2C close-out block.
- Move `current/build_log_f2c.md` → `archive/`.
- Standing brief §3.8 and §10 F2C acknowledgement; requirements §3.8 F2C acknowledgement.
- Verify Decision 57's done definition is met (or document remaining gap to be closed by the post-2C.4 re-import slice).
