# Build Log — Post-2C.4 Re-import Sweep

Slice: Post-2C.4 full fixture re-import sweep.
Goal: Close Decision 57 item 3 — all twelve recipe-shape `web_sourced` fixtures re-imported via upsert with source-data conventions corrected and slugs confirmed against existing rows.

---

## Post-2C.4 re-import sweep

**Status:** complete. All twelve fixtures committed. Decision 57 item 3 closed.

### Pre-flight confirmation

**Fixture `external_ref` values confirmed (from post-2C.4 converter-project JSONs):**

| Fixture file | `external_ref` | Cuisine |
|---|---|---|
| `aubergine_parmigiana.json` | `aubergine-parmigiana-cloake` | `italian` |
| `banana_bread.json` | `banana-bread` | null |
| `black_bean_patties.json` | `black-bean-patties-portobello-mushrooms` | null |
| `butter_bean_mushroom_walnut_loaf.json` | `butter-bean-mushroom-walnut-loaf` | null |
| `classic_houmous.json` | `classic-houmous` | null |
| `harissa_lentil_chickpea_shepherds_pie.json` | `harissa-lentil-chickpea-shepherds-pie` | `moroccan` |
| `lemon_cheesecake.json` | `lemon-cheesecake` | null |
| `marinated_teriyaki_aubergine.json` | `marinated-teriyaki-eggplant` | `japanese` |
| `north_african_shepherds_pie-stripped.json` | `north-african-spiced-shepherds-pie-stripped` | `moroccan` |
| `ramen.json` | `ramen-hairy-bikers` | `japanese` |
| `vegetarian_pancake_pie.json` | `vegetarian-pancake-pie` | null |
| `bread_pudding.json` | `bread-pudding` | `british` |

**Cuisine codes in sweep:** `italian`, `japanese`, `moroccan`, `british`. All four confirmed valid via `SELECT code FROM cuisine` pre-flight check (2026-06-03). Full vocabulary: british, chinese, french, indian, italian, japanese, korean, mediterranean, mexican, middle_eastern, moroccan, persian, scandinavian, spanish, thai, vietnamese.

**Previously-deferred slug fixes now applied (confirmed via `external_ref` check):**

| Fixture | 2C.3 fresh slug (wrong) | Post-2C.4 slug (correct) |
|---|---|---|
| black bean patties | `black-bean-patties-portobello` | `black-bean-patties-portobello-mushrooms` ✅ |
| north african pie | `north-african-spiced-shepherds-pie` | `north-african-spiced-shepherds-pie-stripped` ✅ |
| ramen | `vegetarian-ramen` | `ramen-hairy-bikers` ✅ |
| teriyaki aubergine | `marinated-teriyaki-aubergine` | `marinated-teriyaki-eggplant` ✅ |

**Aubergine parmigiana slug — discrepancy against slice brief:**

The slice brief states the (b2) row was inserted under `aubergine-parmigiana` (no Cloake suffix), predicting a slug mismatch requiring a manual SQL update before import. However, both the old committed fixture file (`test_fixtures/web_sourced/aubergine-parmigiana.json`, HEAD) and the 2C.3 build log entry ("the existing (b2) row had `aubergine-parmigiana-cloake`") confirm that the (b2) row has `external_ref: aubergine-parmigiana-cloake`. The post-2C.4 fixture also has `external_ref: aubergine-parmigiana-cloake`.

**Aubergine parmigiana slug confirmed via pre-flight SQL (2026-06-03):** `SELECT id, external_ref FROM meal WHERE external_ref LIKE 'aubergine%'` → single row, `id=8`, `external_ref: aubergine-parmigiana-cloake`. Slugs match — import proceeds as straight upsert-replace, no SQL update needed. Slice brief's prediction of a mismatch was incorrect; the (b2) fixture file always carried the Cloake suffix.

### Fixtures

#### 1. Aubergine parmigiana (existing row: (b2))

**File:** `aubergine_parmigiana.json` — `external_ref: aubergine-parmigiana-cloake`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly ("This will update the existing recipe 'Aubergine Parmigiana'"). Replace confirmed; commit succeeded.

**`meal.id` stable:** id=8. ✅

**Match breakdown:** 12 exact (9 direct + 1 alias + 2 strip), 0 ambiguous, 4 fuzzy, 0 none. Total 16.

**Strip annotations:** `mozzarella, thinly sliced` → `mozzarella (stripped: ", thinly sliced")`; `Parmesan, grated` → `parmesan (stripped: ", grated")`.

**Alias match:** `aubergines` → `aubergine (via alias "aubergines")`.

**Fuzzy picks:**
- `oil` → `olive oil` (0.44). Five oil candidates presented; olive oil selected. Same observation as 2C.3 informational block.
- `garlic cloves, crushed` → `garlic clove` (0.80).
- `salt` → `fine salt` (0.50). `salami` (0.33) again present as false-positive candidate — fourth observation across sweep history.
- `basil leaves` → `fresh basil` (0.32).

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict expected (declared `vegetarian`; all ingredients vegetarian-compatible). Known gate bug not exercised here.

**Notable:** `oil` as a bare ingredient name continues to produce a wide fuzzy field with no confident candidate. Same fixture-prep pattern as 2C.3 aubergine parmigiana informational block — fixture uses `oil` as a generic, master has five specific oil canonicals.

---

#### 2. Banana bread (existing row: 2C.3, row 9)

**File:** `banana_bread.json` — `external_ref: banana-bread`

**Outcome:** committed via upsert-replace.

**`meal.id` stable:** id=9. ✅

**Match breakdown:** 9 exact (7 direct + 2 strip), 0 ambiguous, 0 fuzzy, 1 none. Total 10.

**Strip annotations:** `butter, softened` → `butter (stripped: ", softened")`; `large eggs, beaten` → `large eggs (stripped: ", beaten")`.

**None ingredients:** `very ripe bananas, mashed` → chose existing `banana`. Same as 2C.3 — leading selection criterion (`very ripe`) plus plural prevented match against master canonical.

**Fuzzy picks:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict expected (declared `vegetarian`; no meat or fish ingredients).

**Notable:** Post-2C.4 version adds `{0002} butter` (for greasing, method-only per duplicate-ingredient convention) not present in the 2C.3 fixture. Direct exact match. 10 ingredients vs 2C.3's 9; all other ingredients and match outcomes follow 2C.3 pattern. Also adds `water` (from method, 2–3 tsp) and `dried banana chips` (decoration) — both were in 2C.3 as direct exacts and match the same way here.

---

#### 3. Black bean patties (existing row: (b2))

**File:** `black_bean_patties.json` — `external_ref: black-bean-patties-portobello-mushrooms`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=10. ✅

**Match breakdown:** 17 exact (13 direct + 4 strip), 0 ambiguous, 3 fuzzy, 0 none. Total 20.

**Strip annotations:** `red onion, finely diced` → `red onion`; `red pepper, finely diced` → `red pepper`; `fresh coriander, roughly chopped` → `fresh coriander`; `lime, juiced` → `lime`.

**Fuzzy picks:**
- `black beans, drained and rinsed` → `tinned black beans` (0.38). Multi-prep trailing form (`, drained and rinsed`) does not strip; fuzzy at 0.38. Low score reflects name mismatch (`black beans` vs `tinned black beans`). Fixture-prep convention note: ingredient name should be `tinned black beans` when the instruction is to drain and rinse from a tin — see Carry-forward.
- `garlic cloves, minced` → `garlic clove` (0.80). Appears in both patties and mushrooms groups (rows {0003} and {0017}) — duplicate-row convention exercised correctly. `, minced` is a single-verb trailing form and should strip to `garlic cloves`; stripped form did not promote to exact, suggesting no alias `garlic cloves` → `garlic clove` exists. Pluralisation gap — same pattern as 2C.3 findings.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict expected (declared `vegan`; all ingredients vegan-compatible). Gate bug also in play (3 fuzzy rows prevent `allExact`).

**Notable:** Duplicate-row convention for `garlic cloves, minced` and `soy sauce`/`olive oil` (all appearing across both groups) rounds the fixture correctly with 20 rows and no validator errors.

---

#### 4. Butter bean mushroom walnut loaf (existing row: (b2))

**File:** `butter_bean_mushroom_walnut_loaf.json` — `external_ref: butter-bean-mushroom-walnut-loaf`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=11. ✅

**Match breakdown:** 11 exact (6 direct + 4 strip + 1 alias), 0 ambiguous, 4 fuzzy, 0 none. Total 15.

**Strip annotations:** `chestnut mushrooms, finely chopped` → `chestnut mushrooms`; `onion, finely diced` → `onion`; `walnuts, roughly chopped` → `walnuts`; `dried rosemary, crushed` → `dried rosemary`.

**Alias match:** `oats` → `rolled oats (via alias "oats")`.

**Fuzzy picks:**
- `butter beans, drained and rinsed` → `tinned butter beans` (0.40). Same pattern as `black beans, drained and rinsed` in fixture 3 — multi-prep trailing form does not strip; use `tinned X` directly. Second instance confirming the fixture-prep carry-forward.
- `garlic cloves, minced` → `garlic clove` (0.80). Same pluralisation gap as fixture 3.
- `eggs, beaten` → `egg` (0.50). Strip fires on `, beaten` → `eggs` (plural); no exact match for `eggs` (no alias covering plural → singular for plain `egg`). Contrast with `large eggs, beaten` in fixture 2 which stripped to `large eggs` (a canonical). Plain `eggs` falls fuzzy at 0.50.
- `salt` → `fine salt` (0.50). `salami` (0.33) false-positive — sixth observation.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict expected (declared `vegetarian`; `tamari` is the strictest ingredient at vegetarian-tier). Gate bug also in play (4 fuzzy rows).

**Notable:** `omega3_strong` tag accepted cleanly (walnuts). `soy` restriction correctly sourced from `tamari`.

---

#### 5. Classic houmous (existing row: (b2)/(2C.2), row 5)

**File:** `classic_houmous.json` — `external_ref: classic-houmous`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=5. ✅ Third upsert onto this row (b2 insert → 2C.2 smoke → this sweep); id stable across all three.

**Match breakdown:** 7 exact (5 direct + 2 strip), 0 ambiguous, 2 fuzzy, 0 none. Total 9.

**Strip annotations:** `lemon, juiced` → `lemon`; `garlic clove, peeled` → `garlic clove`.

**Fuzzy picks:**
- `chickpeas, drained` → `tinned chickpeas` (0.59). Strip fires on `, drained` → `chickpeas` (plural); no exact match for `chickpeas` (canonical is `tinned chickpeas`). Fuzzy at 0.59 — better score than the multi-prep form `chickpeas, drained and rinsed` (0.36 in 2C.3 harissa pie) because the stripped form `chickpeas` is closer to `tinned chickpeas`. `chicken breast` (0.32) false-positive. Fixture-prep convention: use `tinned chickpeas` directly.
- `ice-cold water` → `water` (0.40). Persistent fuzzy — same as 2C.2 smoke and 2C.3.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegan`; all ingredients vegan-compatible). Gate bug in play (2 fuzzy rows).

**Notable:** Post-2C.4 version adds a second `extra virgin olive oil` row ({0009}, for topping/drizzle) not present in the 2C.2 smoke fixture (8 ingredients → 9). Direct exact match. `meal.id=5` stable across three upserts confirms upsert-replace path reliably preserves row identity.

---

#### 6. Harissa lentil chickpea shepherd's pie (existing row: 2C.3, row 12)

**File:** `harissa_lentil_chickpea_shepherds_pie.json` — `external_ref: harissa-lentil-chickpea-shepherds-pie`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly (existing row name shown: "Harissa Lentil & Chickpea Shepherd's Pie with Air-Fried Courgette and Mushroom"). Replace confirmed; commit succeeded. Meal name updated by upsert to shorter form "Harissa Lentil & Chickpea Shepherd's Pie".

**`meal.id` stable:** id=12. ✅

**Match breakdown:** 16 exact (13 direct + 3 strip), 0 ambiguous, 10 fuzzy, 0 none. Total 26.

**Strip annotations:** `chestnut mushrooms, quartered` → `chestnut mushrooms`; `onion, finely chopped` → `onion`; `fresh parsley, chopped` → `fresh parsley`.

**Fuzzy picks (all first-candidate):**
- `floury potatoes, peeled and chunked` → `floury potatoes` (0.48). Multi-prep trailing form.
- `sweet potatoes, peeled and chunked` → `sweet potato` (0.36). Multi-prep trailing form; pluralisation gap also in play.
- `salt` → `fine salt` (0.50). `salami` (0.33) false-positive — seventh observation. Post-2C.4 fixture has one `salt` row vs 2C.3's two (one fewer ingredient: 26 vs 27 total).
- `courgettes, cut into 1.5cm dice` → `courgette` (0.37, via alias `courgettes`). Alias-via-fuzzy issue persists: alias found but match renders at 0.37 fuzzy rather than promoting to exact. Same as 2C.3.
- `garlic cloves, finely chopped` → `garlic clove` (0.80). Pluralisation gap — strip fires on `, finely chopped` → `garlic cloves`; no exact for plural.
- `rose harissa` → `rose harissa paste` (0.68). Fixture uses short form; canonical includes "paste". Convention fix: use `rose harissa paste`.
- `tinned chopped tomatoes` → `tinned tomatoes` (0.68). Mid-name modifier mismatch — same as 2C.3.
- `red split lentils, rinsed` → `red lentils` (0.67). Strip fires on `, rinsed` → `red split lentils`; canonical is `red lentils`. Convention fix: use `red lentils` directly.
- `miso paste` → `white miso paste` (0.69). Under-specified vs canonical; convention fix: use `white miso paste`.
- `chickpeas, drained and rinsed` → `tinned chickpeas` (0.36). Multi-prep trailing form — same pattern as fixtures 3, 4, and 5.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegan`; all ingredients vegan-compatible). Gate bug in play (10 fuzzy rows).

**Notable:** Match distribution (16 exact / 10 fuzzy / 0 none) vs 2C.3 (16 exact / 11 fuzzy / 0 none) — one fewer `salt` row in the post-2C.4 fixture accounts for the difference. All other patterns identical to 2C.3.

---

#### 7. Lemon cheesecake (existing row: 2C.3, row 13)

**File:** `lemon_cheesecake.json` — `external_ref: lemon-cheesecake`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=13. ✅

**Match breakdown:** 5 exact (4 direct + 1 strip), 0 ambiguous, 0 fuzzy, 1 none. Total 6.

**Strip annotations:** `digestive biscuits, crushed` → `digestive biscuits`.

**None ingredients:** `lemons, rind grated and juiced` → chose existing `lemon`. Multi-prep trailing form (`, rind grated and juiced`) does not strip. 2C.3 fixture had the same ingredient as `lemons, grated rind and juiced` (slightly different word order, same result). Both fall to none.

**Fuzzy picks:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegetarian`; all ingredients vegetarian-compatible). Gate bug not in play (0 fuzzy rows, but the none row prevents `allExact`).

**Notable:** `base_servings: null` committed cleanly — third confirmation across the sweep (2C.3 lemon cheesecake, bread pudding above, this fixture). Match distribution identical to 2C.3 (5 exact / 0 fuzzy / 1 none).

---

#### 8. Marinated teriyaki aubergine (existing row: (b2))

**File:** `marinated_teriyaki_aubergine.json` — `external_ref: marinated-teriyaki-eggplant`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly (existing row shown as "Marinated Teriyaki Eggplant"). Replace confirmed; commit succeeded. Meal name updated to "Marinated Teriyaki Aubergine" (British English); slug `marinated-teriyaki-eggplant` preserved per canonical slug convention.

**`meal.id` stable:** id=14. ✅

**Match breakdown:** 6 exact (4 direct + 1 alias + 1 strip), 0 ambiguous, 4 fuzzy, 0 none. Total 10.

**Strip annotations:** `spring onion, finely sliced` → `spring onion`.

**Alias match:** `aubergines` → `aubergine (via alias "aubergines")`.

**Fuzzy picks (all first-candidate):**
- `rice wine vinegar` → `rice vinegar` (0.76). Mid-name modifier (`wine`); canonical is `rice vinegar`. Convention fix: use `rice vinegar`.
- `brown sugar` → `soft brown sugar` (0.75). Canonical has "soft" prefix absent from fixture. Convention fix: use `soft brown sugar`.
- `fresh root ginger, grated` → `fresh ginger` (0.72). Strip fires on `, grated` → `fresh root ginger`; canonical is `fresh ginger` (no `root`). Mid-name modifier mismatch — same pattern flagged in 2C.3 findings.
- `garlic cloves, minced` → `garlic clove` (0.80). Same pluralisation gap as fixtures 3, 4, 6.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegan`; all ingredients vegan-compatible). Gate bug in play (4 fuzzy rows).

**Notable:** Canonical slug convention confirmed in production — slug `marinated-teriyaki-eggplant` unchanged despite name updating to British English. First upsert onto this row (b2 insert only previously).

---

#### 9. North African spiced shepherd's pie — stripped (existing row: (b2))

**File:** `north_african_shepherds_pie-stripped.json` — `external_ref: north-african-spiced-shepherds-pie-stripped`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=18. ✅

**Match breakdown:** 11 exact (8 direct + 2 strip + 1 alias+strip), 0 ambiguous, 8 fuzzy, 0 none. Total 19.

**Strip annotations:** `leek, sliced` → `leek`; `lemon, juiced` → `lemon`.

**Alias+strip match:** `mushrooms, roughly chopped` → `chestnut mushrooms (via alias "mushrooms")(stripped: ", roughly chopped")`. Strip fires on `, roughly chopped`, then alias `mushrooms` → `chestnut mushrooms`. Match correct per master alias; recipe uses generic "mushrooms" so mapping to chestnut is the alias's declared intent.

**Fuzzy picks:**
- `celery stalks, diced` → `celery stalk` (0.80). Strip fires on `, diced` → `celery stalks`; pluralisation gap.
- `carrots, diced` → `carrot` (0.67). Strip fires on `, diced` → `carrots`; pluralisation gap. `diced lamb` (0.32) false-positive.
- `garlic cloves, minced` → `garlic clove` (0.80). Pluralisation gap — fourth distinct fixture with this pattern.
- `green or brown lentils, dried` → `green lentils` (0.48). Tied with `brown lentils` (0.48); picked `green lentils` (listed first in ingredient name). "X or Y" alternative form in fixture — should use a single canonical per inline-alternatives convention, with the alternative noted in ingredient `notes`. Fixture-prep carry-forward.
- `white beans, drained` → `tinned white beans` (0.63). Single-prep trailing form (`, drained`) strips to `white beans`; canonical is `tinned white beans`. Third `tinned X` convention instance (after black beans and butter beans).
- `miso paste` → `white miso paste` (0.69). Same under-specification as fixture 6.
- `floury potatoes, peeled and chopped` → `floury potatoes` (0.48). Multi-prep trailing form — same pattern as fixtures 6, 8.
- `salt` → `fine salt` (0.50). `salami` (0.33) false-positive — eighth observation.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegan`; all ingredients vegan-compatible). Gate bug in play (8 fuzzy rows).

**Notable:** `rose harissa paste` → exact match. Contrast with fixture 6 (`rose harissa` without "paste" → fuzzy 0.68). Post-2C.4 convention fix applied correctly here — using full canonical form produces an exact match. `external_ref: north-african-spiced-shepherds-pie-stripped` correctly matched the (b2) row after the 2C.3 slug mismatch fix.

---

#### 10. Ramen — Hairy Bikers (existing row: 2C.3, row 15)

**File:** `ramen.json` — `external_ref: ramen-hairy-bikers`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=15. ✅

**Match breakdown:** 13 exact (12 direct + 1 strip), 0 ambiguous, 9 fuzzy, 2 none. Total 24.

**Strip annotations:** `onion, coarsely sliced` → `onion`.

**Fuzzy picks (all first-candidate):**
- `dried shiitake mushrooms` → `shiitake mushrooms` (0.76). "dried" prefix not in canonical — same mid-name modifier pattern as previous fixtures.
- `garlic cloves, thinly sliced` → `garlic clove` (0.80). Pluralisation gap — strip fires on `, thinly sliced` → `garlic cloves`; no exact for plural.
- `fresh root ginger, thinly sliced` → `fresh ginger` (0.72). Strip fires on `, thinly sliced` → `fresh root ginger`; mid-name modifier (`root`). Same as fixture 8.
- `miso paste` (×2, broth and soup groups) → `white miso paste` (0.69) each. Duplicate-row convention exercised correctly.
- `spring onions, whites sliced on the diagonal` → `spring onion` (0.32). Complex trailing clause — does not strip; low-score fuzzy but correct ingredient.
- `spring onion greens, very finely sliced` → `spring onion` (0.34). Same canonical as above — whites and greens split into two rows mapping to one canonical. Correct for recipe intent; expected match behaviour.
- `tamago eggs, halved` → `tamago` (0.58). Strip fires on `, halved` → `tamago eggs`; fuzzy at 0.58 against canonical `tamago`. Fixture-prep convention: use `tamago` directly.
- `coriander` → `fresh coriander` (0.63). Bare `coriander` is ambiguous; `ground coriander` (0.59) also in candidates. Context (garnish) makes `fresh coriander` correct. Fixture-prep convention: use `fresh coriander` explicitly.

**None ingredients:**
- `carrot, cut into diagonal slices` → chose existing `carrot`. Multi-prep trailing clause (`, cut into diagonal slices`) does not strip; no fuzzy match surfaced a candidate. Same resolution as 2C.3's `large carrot, cut into 0.5cm diagonal slices`.
- `nori sushi seaweed, roughly torn` → chose existing `nori sheets`. Identical to 2C.3 — same ingredient, same resolution.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegetarian`; `tamago` is vegetarian-tier — consistent). Gate bug in play (9 fuzzy rows).

**Notable:** Post-2C.4 fixture simplified `ramen noodle blocks` → `noodles` (exact match), reducing none count from 2C.3's 3 → 2. `miso paste` and `soy sauce` each appear twice across groups — duplicate-row convention correct. Declared `vegetarian` with `tamago` (vegetarian-tier) — no banner conflict, and no forced contrivance as in 2C.3's deliberate vegan/tamago test.

---

#### 11. Vegetarian pancake pie (existing row: (b2))

**File:** `vegetarian_pancake_pie.json` — `external_ref: vegetarian-pancake-pie`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=17. ✅

**Match breakdown:** 9 exact (5 direct + 2 strip + 1 alias + 1 alias+strip), 0 ambiguous, 4 fuzzy, 1 none, 1 new. Total 15.

**Strip annotations:** `onion, finely chopped` → `onion`; `cheddar, grated` → `cheddar`.

**Alias match:** `milk` → `whole milk (via alias "milk")`.

**Alias+strip match:** `mushrooms, sliced` → `chestnut mushrooms (via alias "mushrooms")(stripped: ", sliced")`. Second instance of alias+strip combo (after fixture 9's `mushrooms, roughly chopped`).

**Fuzzy picks (all first-candidate):**
- `garlic cloves, minced` → `garlic clove` (0.80). Fifth distinct fixture with this pattern.
- `fresh spinach, washed` → `spinach` (0.57). Strip fires on `, washed` → `fresh spinach`; canonical is `spinach` (no "fresh" prefix). Convention fix: use `spinach` directly.
- `salt` → `fine salt` (0.50). `salami` (0.33) false-positive — ninth observation.
- `grated nutmeg` → `nutmeg` (0.50). Same leading-prep-verb regression as bread pudding (fixture 12). Second instance in this sweep — converter regressed `nutmeg, grated` → `grated nutmeg` on both fixtures.

**None ingredients:** `free-range eggs` → chose existing `egg`. "free-range" is a sourcing/quality qualifier — leading-strip rule does not fire (not a size adjective), and no alias exists. Convention fix: use `egg` (or `large eggs`) without the qualifier.

**New ingredients created:** `fresh chives` (category: Fresh herbs, dietary: Vegan). First new ingredient created in this sweep. `23505 duplicate_ingredient_name` path not triggered (ingredient genuinely new).

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. No conflict (declared `vegetarian`; all ingredients vegetarian-compatible). Gate bug in play (4 fuzzy rows).

**Notable:** `base_servings: null` committed cleanly — fourth confirmation this sweep. `fresh chives` is a valid missing master entry; creation appropriate.

---

#### 12. Bread pudding (existing row: 2C.3, row 7)

**File:** `bread_pudding.json` — `external_ref: bread-pudding`

**Outcome:** committed via upsert-replace. Upsert advisory fired correctly. Replace confirmed; commit succeeded.

**`meal.id` stable:** id=7. ✅

**Match breakdown:** 8 exact (7 direct + 1 alias), 0 ambiguous, 3 fuzzy, 0 none. Total 11.

**Alias match:** `milk` → `whole milk (via alias "milk")`.

**Fuzzy picks:**
- `suet` → `vegetarian suet` (0.31). Only candidate. Recipe declares `dietary_category: meat` (implying beef suet), but master only has `vegetarian suet`. Weak match at 0.31; content accuracy concern logged in Carry-forward — this ingredient mapping is incorrect if beef suet is intended.
- `salt` → `fine salt` (0.50). `salami` (0.33) false-positive again — fifth observation across sweep history.
- `grated nutmeg` → `nutmeg` (0.50). Leading prep-verb form — strip rule does not fire (only size adjectives strip from the front). **Regression vs 2C.3:** the 2C.3 fixture had `nutmeg, grated` (trailing form), which stripped to an exact match. The post-2C.4 re-conversion reverted to `grated nutmeg`. Result: one exact lost, one fuzzy gained vs 2C.3 (9 exact / 2 fuzzy → 8 exact / 3 fuzzy). See Carry-forward.

**None ingredients:** none.

**New ingredients created:** none.

**23505 paths fired:** none.

**Advisory banner (dietary):** not fired. Declared `meat`; strictest ingredient is `vegetarian suet` (vegetarian-tier). Banner warns when declared is *less* restrictive than ingredients, not more — no conflict in that direction. Gate bug also in play (3 fuzzy rows).

**Notable:** `base_servings: null` committed cleanly on upsert path (second confirmation after lemon cheesecake in 2C.3). `dietary_category: meat` accepted by validator without issue. The `suet` → `vegetarian suet` mismatch is a content gap, not an importer bug.

---

### Sweep — cumulative data

**12 fixtures, 181 ingredient rows.**

| Outcome | Count | % |
|---|---|---|
| Exact (direct) | 91 | 50% |
| Exact (via strip) | 25 | 14% |
| Exact (via alias) | 4 | 2% |
| Exact (via alias + strip) | 4 | 2% |
| **Total exact** | **124** | **69%** |
| Fuzzy | 51 | 28% |
| None (chose existing) | 5 | 3% |
| New ingredient created | 1 | <1% |
| **Total** | **181** | |

**2C.3 baseline (76 rows, 5 fixtures):** 61% exact / 30% fuzzy / 9% none.

**Per-fixture summary:**

| # | Fixture | Ingredients | Exact | Fuzzy | None | New | meal.id |
|---|---|---|---|---|---|---|---|
| 1 | Aubergine parmigiana | 16 | 12 | 4 | 0 | 0 | 8 |
| 2 | Banana bread | 10 | 9 | 0 | 1 | 0 | 9 |
| 3 | Black bean patties | 20 | 17 | 3 | 0 | 0 | 10 |
| 4 | Butter bean loaf | 15 | 11 | 4 | 0 | 0 | 11 |
| 5 | Classic houmous | 9 | 7 | 2 | 0 | 0 | 5 |
| 6 | Harissa pie | 26 | 16 | 10 | 0 | 0 | 12 |
| 7 | Lemon cheesecake | 6 | 5 | 0 | 1 | 0 | 13 |
| 8 | Teriyaki aubergine | 10 | 6 | 4 | 0 | 0 | 14 |
| 9 | North african pie | 19 | 11 | 8 | 0 | 0 | 18 |
| 10 | Ramen | 24 | 13 | 9 | 2 | 0 | 15 |
| 11 | Vegetarian pancake pie | 15 | 9 | 4 | 1 | 1 | 17 |
| 12 | Bread pudding | 11 | 8 | 3 | 0 | 0 | 7 |
| **Total** | | **181** | **124** | **51** | **5** | **1** | |

**Cumulative fuzzy ingredient list (threshold-tuning data, additive to 2C.3):**

*High-confidence fuzzies (≥0.70) — strip-list or alias extension would convert to exact:*
- `garlic cloves, [prep]` → `garlic clove` (0.80) — appeared in fixtures 1, 3, 4, 6, 9, 10. Pluralisation gap; strip fires but no alias for plural.
- `celery stalks, diced` → `celery stalk` (0.80) — pluralisation gap.
- `dried shiitake mushrooms` → `shiitake mushrooms` (0.76) — "dried" prefix not in canonical.
- `rice wine vinegar` → `rice vinegar` (0.76) — mid-name modifier ("wine").
- `brown sugar` → `soft brown sugar` (0.75) — canonical has "soft" prefix.
- `fresh root ginger, [prep]` → `fresh ginger` (0.72) — "root" mid-name modifier; appeared in fixtures 8, 10.
- `tinned chopped tomatoes` → `tinned tomatoes` (0.68) — mid-name modifier ("chopped").
- `rose harissa` → `rose harissa paste` (0.68) — fixture 6 (fixture 9 correctly used full canonical, resulting in exact).
- `miso paste` → `white miso paste` (0.69) — under-specified; appeared in fixtures 6, 9, 10.
- `red split lentils, rinsed` → `red lentils` (0.67) — "split" mid-name modifier.
- `carrots, diced` → `carrot` (0.67) — pluralisation gap.
- `white beans, drained` → `tinned white beans` (0.63) — tinned-X convention.
- `coriander` → `fresh coriander` (0.63) — under-specified; `ground coriander` (0.59) also in candidates.
- `tamago eggs, halved` → `tamago` (0.58) — "eggs, halved" suffix; canonical is `tamago`.
- `chickpeas, drained` → `tinned chickpeas` (0.59) — tinned-X convention (strip fires, but canonical uses "tinned" prefix).
- `fresh spinach, washed` → `spinach` (0.57) — "fresh" prefix absent from canonical.

*Mid-range fuzzies (0.40–0.59) — fixture-prep fixes would help:*
- `eggs, beaten` → `egg` (0.50) — strip fires → `eggs`; no plural-singular alias.
- `salt` → `fine salt` (0.50) — bare `salt` vs canonical `fine salt`; appeared in 6 fixtures.
- `grated nutmeg` → `nutmeg` (0.50) — leading prep-verb form; appeared in fixtures 11, 12.
- `butter beans, drained and rinsed` → `tinned butter beans` (0.40) — tinned-X convention.
- `ice-cold water` → `water` (0.40) — persistent; appeared in fixtures 5 and earlier sweeps.

*Lower fuzzies (0.30–0.39):*
- `black beans, drained and rinsed` → `tinned black beans` (0.38) — tinned-X convention.
- `courgettes, cut into 1.5cm dice` → `courgette` (0.37, via alias) — alias-via-fuzzy promotion issue.
- `sweet potatoes, peeled and chunked` → `sweet potato` (0.36) — multi-prep trailing form + pluralisation.
- `spring onion greens, very finely sliced` → `spring onion` (0.34) — complex trailing clause.
- `spring onions, whites sliced on the diagonal` → `spring onion` (0.32) — complex trailing clause.
- `basil leaves` → `fresh basil` (0.32) — mid-name modifier.
- `suet` → `vegetarian suet` (0.31) — content accuracy concern.
- `oil` → `olive oil` (0.44) — bare generic name; wide false-positive field.
- `green or brown lentils, dried` → `green lentils` (0.48) — X-or-Y alternative form; tied with `brown lentils`.
- `floury potatoes, peeled and [prep]` → `floury potatoes` (0.48) — multi-prep trailing form; appeared in fixtures 6, 9.

**Cumulative none ingredient list:**
1. `very ripe bananas, mashed` → `banana` (fixture 2) — leading selection criterion + plural.
2. `lemons, rind grated and juiced` → `lemon` (fixture 7) — multi-prep compound trailing form.
3. `carrot, cut into diagonal slices` → `carrot` (fixture 10) — complex trailing clause.
4. `nori sushi seaweed, roughly torn` → `nori sheets` (fixture 10) — over-specified name.
5. `free-range eggs` → `egg` (fixture 11) — quality/sourcing qualifier, not a prep verb.

**New ingredients created:** `fresh chives` (fixture 11) — category: Fresh herbs, dietary: Vegan.

**Recurring false positives observed:**
- `salami` (0.33) as fuzzy candidate for `salt` — nine observations across fixtures 1, 3, 4, 5, 6, 8, 9, 10, 11.
- `diced lamb` (0.32) for `carrots, diced` — fixture 9.
- `chicken breast` (0.32) for `chickpeas, drained` — fixture 5.

---

### Findings

#### Match distribution

**69% exact / 28% fuzzy / 3% none** across 181 ingredient rows and 12 fixtures. Improvement over 2C.3 baseline (61% / 30% / 9%) on all three axes. The none bucket improvement (9% → 3%) is the largest gain — driven by the post-2C.4 converter project better applying the inline-alternatives convention and reducing over-specified ingredient names. The exact-rate gain (61% → 69%) reflects correct use of full canonical forms in several fixtures (e.g. `rose harissa paste` in fixture 9, producing an exact where 2C.3's `rose harissa` was fuzzy at 0.68).

The fuzzy bucket is relatively stable (30% → 28%) because most remaining fuzzies reflect structural patterns (pluralisation gap, multi-prep trailing forms, mid-name modifiers) that the converter prompt does not fully address. These are carry-forwards for the strip-list extension and alias system.

#### Cuisine code validation

All four codes in scope (`italian`, `japanese`, `moroccan`, `british`) accepted by validator without issues. No mid-sweep fixture corrections required for cuisine. Pre-flight confirmation effective.

#### Advisory banner (dietary)

Did not fire on any of the twelve fixtures. Expected-broken per the known `allExact` gate bug — only fixtures with all rows resolving as `exact` trigger the dietary-conflict evaluation, and every fixture in this sweep had at least one fuzzy or none row. No exceptions observed.

Bread pudding is the only fixture where a conflict *could* theoretically arise from the declared-vs-ingredient direction (declared `meat`, matched ingredient `vegetarian suet` which is vegetarian-tier). However, the banner is designed to warn when declared is *less* restrictive than ingredients — a `meat` declaration with vegetarian ingredients is the opposite direction and would not trigger the banner even if the gate were fixed.

#### `meal.id` stability

All twelve meal.ids confirmed stable across upsert-replace:

| meal.id | Recipe | Upsert count in sweep |
|---|---|---|
| 5 | Classic houmous | 1 (third total, incl. 2C.2 smoke) |
| 7 | Bread pudding | 1 (second total) |
| 8 | Aubergine parmigiana | 1 (first upsert) |
| 9 | Banana bread | 1 (second total) |
| 10 | Black bean patties | 1 (first upsert) |
| 11 | Butter bean loaf | 1 (first upsert) |
| 12 | Harissa pie | 1 (second total) |
| 13 | Lemon cheesecake | 1 (second total) |
| 14 | Teriyaki aubergine | 1 (first upsert) |
| 15 | Ramen | 1 (second total) |
| 17 | Vegetarian pancake pie | 1 (first upsert) |
| 18 | North african pie — stripped | 1 (first upsert) |

The upsert-replace path (`commit_import` with `on_conflict='update'`) reliably preserves row identity across all twelve operations. The three-upsert sequence on row 5 (houmous) confirms stability across repeated updates.

#### Slug convention

All twelve slugs matched their existing production rows cleanly. The five 2C.3 slug-mismatched fixtures (aubergine parmigiana, black bean patties, north african pie, ramen, teriyaki aubergine) are now correctly aligned via the post-2C.4 converter project. No SQL pre-work was required for this sweep — the slice brief's prediction of a slug mismatch on aubergine parmigiana was incorrect (the (b2) row always had `aubergine-parmigiana-cloake`).

#### Notable sweep-specific observations

- **Name update via upsert confirmed:** harissa pie row updated from "Harissa Lentil & Chickpea Shepherd's Pie with Air-Fried Courgette and Mushroom" → shorter form; teriyaki aubergine updated from "Marinated Teriyaki Eggplant" → "Marinated Teriyaki Aubergine". Slugs unchanged. Upsert replaces all meal-row fields including name.
- **`grated nutmeg` converter regression:** two fixtures (bread pudding, vegetarian pancake pie) use the leading-prep-verb form `grated nutmeg` rather than the 2C.3-established trailing form `nutmeg, grated`. Both produce fuzzy at 0.50 instead of the 2C.3 exact-via-strip. Converter prompt reinforcement needed.
- **`tinned X` convention now has four confirming instances:** black beans, butter beans, chickpeas, white beans. All resolve via fuzzy at 0.36–0.63. Using the canonical `tinned X` form directly would convert all four to exact.
- **`alias + strip` combination confirmed working:** `mushrooms, roughly chopped` (fixture 9) and `mushrooms, sliced` (fixture 11) both resolve via alias "mushrooms" → `chestnut mushrooms` with strip firing on the trailing prep clause.
- **`salami` false-positive for `salt`:** nine observations across eleven of twelve fixtures. Persistent; no new information beyond confirming pattern.
- **`fresh chives` created:** only new master ingredient in the sweep. Appropriate — `fresh chives` is a genuine gap in the herb vocabulary.

#### Decision 57 item 3

**CLOSED.** All twelve recipe-shape `web_sourced` fixtures imported via upsert-replace with source-data conventions corrected and slugs confirmed against existing rows. ✅

---

### Carry-forward

Items generated by this sweep for future slices. None block the current slice close-out.

**Converter prompt / fixture-prep conventions (converter project territory):**
- **`tinned X` for drained tinned ingredients.** Use `tinned black beans`, `tinned butter beans`, `tinned chickpeas`, `tinned white beans` directly — not `X, drained [and rinsed]`. Four confirming instances this sweep; the pattern is now established as a convention gap.
- **`nutmeg, grated` not `grated nutmeg`.** Two fixtures reverted to the leading-prep-verb form that was correctly trailing in 2C.3. Reinforce in converter prompt: leading strip applies to size adjectives only; prep verbs go trailing.
- **`garlic clove` singular.** Use `garlic clove` (singular) not `garlic cloves`. Appeared in five fixtures as a persistent pluralisation fuzzy at 0.80. Alias addition to master would also fix this.
- **Specify canonical forms where known:** `white miso paste` not `miso paste`; `rice vinegar` not `rice wine vinegar`; `soft brown sugar` not `brown sugar`; `red lentils` not `red split lentils`; `fresh coriander` not bare `coriander`; `rose harissa paste` (already correct in fixture 9 — carry this forward as confirmed convention).
- **Strip quality/sourcing qualifiers.** `free-range eggs` falls to none; master canonicals don't track sourcing. Strip `free-range`, `organic`, `grass-fed` at conversion time.
- **X-or-Y alternative forms.** Use one canonical; note the alternative in ingredient `notes`. `green or brown lentils, dried` produced a tied 0.48 fuzzy pair.
- **`fresh spinach` → `spinach`.** Master canonical is `spinach` without "fresh" prefix; strip at conversion.

**Importer / system gaps (already filed for importer-fix slice — no change):**
- Advisory banner gate (`allExact` check, `matching.ts:241`) — evaluate against resolved candidates regardless of outcome kind.
- `updated_at` not refreshed on upsert-replace — needs ON UPDATE trigger in schema.
- Alias-via-fuzzy promotion — `courgettes` alias resolves at 0.37 fuzzy; should promote to exact.

**Master vocabulary gaps:**
- `garlic cloves` plural alias → `garlic clove`. Would collapse the most common fuzzy in the sweep.
- `suet` (beef) as a canonical distinct from `vegetarian suet`. Bread pudding declares `meat` dietary category (implying beef suet) but the only master entry is `vegetarian suet`. Content accuracy gap — either add `suet` canonical or document the match as intentionally approximate.
- `tinned X` forms for any still-missing tinned ingredients (audit at next fixture content sweep).

**Threshold tuning:**
- Hold at 0.30. The lowest genuinely useful fuzzies in this sweep were `suet` → `vegetarian suet` (0.31) and `basil leaves` → `fresh basil` (0.32). Raising the threshold to 0.35 would lose these and offer marginal false-positive improvement (the `salami`/`diced lamb`/`chicken breast` false-positives at 0.31–0.33 are noise but not harmful to the workflow). Apply the `tinned X` and `garlic clove` convention fixes first — they will move several current fuzzy rows to exact and improve the residual's signal-to-noise ratio before any threshold change is warranted.

---

## Importer-fix slice

**Date:** 2026-06-21. Three independent fixes bundled.

---

### Issue 1 — Advisory banner gate fix

**Bug:** `evaluateConsistencyAdvisory` (`src/lib/import/matching.ts`) checked `allExact` before evaluating dietary consistency. Any recipe with at least one fuzzy or none row returned `silent/not_all_resolved` and the banner never fired. In practice every real fixture had at least one fuzzy row, so the banner was permanently suppressed.

**Fix:** `allExact` gate removed. Per-row candidate extraction:
- `exact` → use `outcome.candidate`
- `fuzzy` → use `outcome.candidates[0]` (sorted desc by score in `resolveOutcome`)
- `ambiguous` / `none` → skip row (no single best candidate)

Null `dietary_category_id` on a resolved row now skips that row rather than aborting evaluation. New `"no_resolved_rows"` silent reason added for when all rows produce no usable candidate. `"not_all_resolved"` and `"missing_dietary_category_id"` are now unreachable but retained in the type union — UI never branches on silent reasons. `throw new Error("unreachable")` removed.

**Test coverage:** vitest added as devDependency (`vitest.config.ts`, `npm test`). Four cases in `src/lib/import/matching.test.ts`, all passing:
1. All-exact conflict → fires (regression)
2. Fuzzy row conflict (via `candidates[0]`) → fires
3. Ambiguous row skipped; remaining exact row fires
4. All rows none/ambiguous → `silent/no_resolved_rows`

---

### Issue 2 — `updated_at` ON UPDATE trigger gap

Four tables have `DEFAULT NOW()` on insert but no ON UPDATE trigger:

| Table | Severity |
|---|---|
| `meal` | Active — upsert-replace re-inserts the row |
| `ingredient` | Low |
| `component` | Low |
| `meal_plan` | Low |

`updated_at` not read anywhere in application code (grepped `src/`; column appears only in auto-generated `types.ts`). Bug is silent currently but will matter for future "last modified" display or ordering.

**Action:** Mike to apply ON UPDATE trigger for all four tables via Supabase SQL editor. No application code change required.

---

### Issue 3 — Alias-via-fuzzy investigation (`courgettes`)

**Finding:** `courgettes` alias confirmed in DB (`ingredient_alias` id=19, `ingredient_id`=68). Postgres `match_ingredient` function is correct.

Root cause: fixture ingredient name `courgettes, cut into 1.5cm dice` — trailing clause contains tokens `cut`, `into`, `1.5cm`, `dice`, none present in `prep_verbs` or `modifying_adverbs`. Trailing-comma-clause strip does not fire. Full unstripped name is queried; `similarity('courgettes', 'courgettes, cut into 1.5cm dice') ≈ 0.37` → fuzzy_alias 0.37 rather than exact_alias.

Fix belongs in strip-list extension slice (multi-token prep forms). No code change this slice.

---

### Smoke

Fixture: Marinated Teriyaki Aubergine (id=14, declared `vegan`). 4 fuzzy rows — `rice wine vinegar` (0.76 → rice vinegar), `brown sugar` (0.75 → soft brown sugar), `fresh root ginger, grated` (0.72 → fresh ginger), `garlic cloves, minced` (0.80 → garlic clove). All candidates are vegan.

Advisory result: `silent/consistent`. Correct — pre-fix this returned `silent/not_all_resolved`. The fix evaluates all rows, finds all matched ingredients vegan, suppresses the banner for the right reason.

**CLOSED.** ✅
