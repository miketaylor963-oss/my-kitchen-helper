# Recipe & Component Import Template — Specification

The canonical JSON format for importing a `recipe` or `component` into the recipe and meal planning app. One template covers both; the `import_type` field discriminates. A single recipe import may also generate one or more derived component entries — see [Derived components](#derived-components).

This contract is the source of truth for both manual conversion of existing recipes and the import code that validates and ingests them.

---

## Top-level fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `import_type` | string | yes | `"recipe"` or `"component"`. Controls which of the type-specific blocks apply. |
| `external_ref` | string (slug) | yes | Stable identifier. Lowercase, hyphens, no spaces. Must be unique across all recipes/components. Used for idempotent re-imports — same slug means update, not duplicate. |
| `name` | string | yes | Display name. |
| `description` | string | no | One- or two-sentence summary. |
| `source` | string | no | Free text — where the recipe came from. E.g. `"Claude chat, March 2026"` or `"adapted from Ottolenghi, Plenty"`. |
| `notes` | string | no | Closing notes, tips, variations. Markdown allowed. |

## Classification — all optional but recommended

| Field | Type | Notes |
|---|---|---|
| `cuisine` | string \| null | Must match a `cuisine.code` in the database (`british`, `moroccan`, `japanese`, etc.). |
| `dietary_category` | string \| null | Must match a `dietary_category.code` (`vegan`, `vegetarian`, `pescatarian`, `meat`). Use the **least restrictive eater** rule — a vegan dish is classified `vegan`, not `vegetarian`, because vegans can also eat it. |
| `dietary_restrictions` | string[] | Codes from `dietary_restriction` describing what the dish **contains** (`dairy`, `gluten`, `eggs`, `nuts`, `peanuts`, `soy`, `shellfish`, `sesame`). Empty array if none. |
| `nutritional_tags` | string[] | Codes from `nutritional_tag` describing qualitative nutritional properties (`omega3_strong`). Empty array if none. The ★ marker in the source docs maps to `omega3_strong`; explicit prose equivalents ("fits the omega 3/6 strategy", "good source of omega-3") also qualify. |

## Macro data — all optional

Numeric nutritional values. Nullable — leave as `null` when not known. Populated by Claude during recipe development, or by the operator afterwards. Aggregation queries handle nulls explicitly ("known protein this week: X across N of M tracked meals").

| Field | Type | Notes |
|---|---|---|
| `protein_g` | number \| null | Grams of protein per serving (i.e. per `base_servings`-th of the recipe). |
| `carbs_g` | number \| null | Grams of carbohydrate per serving. |
| `gi_index` | integer \| null | Glycaemic index of the full meal. Meal-level, not derived from ingredients — the value matters in context (fat, protein, fibre slow absorption). |

## Recipe-only fields

Used when `import_type = "recipe"`. Empty arrays for components.

| Field | Type | Notes |
|---|---|---|
| `meal_types` | string[] | Codes from `meal_type` (`breakfast`, `lunch`, `dinner`, `snack`, `side`, `dessert`). A frittata might be `["breakfast", "lunch"]`. |
| `meal_formats` | string[] | Codes from `meal_format` (`no_reheat`, `microwave`, `thermos`). For home dinners, leave empty. |

## Component-only fields

Used when `import_type = "component"`. Empty array for recipes.

| Field | Type | Notes |
|---|---|---|
| `component_layers` | object[] | Which framework layers this component can fill. A single component can register against multiple layers across frameworks. |

Each `component_layers` entry:

```json
{
  "framework": "component_dinner",
  "layer": "base",
  "family": "mash"
}
```

`framework` must match a `framework.code`. `layer` must match a `framework_layer.code` within that framework. `family` is optional — if set, must match a `component_family.code` within that layer.

## Quantities and timing

| Field | Type | Notes |
|---|---|---|
| `base_servings` | integer \| null | Number of servings the ingredient quantities make. Shopping-list scaling multiplies against this. Leave `null` if the source doesn't state a yield — don't estimate. |
| `prep_time_minutes` | integer \| null | Hands-on time. Populate only when stated in the source — see conventions for what counts as stated. |
| `cook_time_minutes` | integer \| null | In-session unattended time: oven, hob, fryer, and short passive waits in the refrigerator or at room temperature (≤2 hours) — salt-sweats, marinades, chills, soaks, batter rests. Position in the method doesn't matter; before cooking, between cooks, and after all count, provided the wait is in-session and under 2 hours. Populate only when stated in the source — see conventions. Long out-of-session time goes in `notes`, not here. |

## Ingredients

Array of ingredient rows. Order matters — used as `sort_order` in the database.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Must match `^[0-9]{4}$` — 4-char zero-padded numeric (`0001`, `0002`). Unique within this recipe. Referenced by step placeholders and by derived components; the placeholder format depends on this, so it's enforced, not just conventional. |
| `name` | string | yes | Display name including any prep notes (`"red onion, finely diced"`, `"lemon, juiced"`). Master ingredient matching happens at import time, human-in-the-loop. |
| `amount` | number \| null | no | Numeric quantity. Null for "to taste", "to serve", "for frying", and similar functional amounts. For ranges ("1–2 tbsp", "2–3 tsp"), use the lower bound and note the range. |
| `unit` | string \| null | no | `g`, `ml`, `tbsp`, `tsp`, `cup`, etc. Null for whole/countable items — in that case fold the counting noun into `name` (`"garlic cloves"`, `"large eggs"`). |
| `group` | string \| null | no | Free-text group label (`"patty"`, `"mushrooms"`, `"mash"`). For ungrouped recipes leave null. Groups are also useful as derivation candidates — see [Derived components](#derived-components). |
| `notes` | string \| null | no | Per-ingredient notes (`"Maldon if possible"`, `"optional"`, `"to taste"`, range notes for range quantities, original imperial values for converted amounts). |

## Steps

Array of step rows. Order matters — used as `sort_order`. No step IDs needed.

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Short summary of the step (`"Soften the veg"`, `"Make the mash"`). Doubles as timer label in cooking-mode UI. |
| `content` | string | yes | Full instructions. Use `{0001}` placeholders to reference ingredient IDs — these render as the scaled quantity in the UI. |
| `timer_seconds` | integer \| null | no | Whenever the step involves waiting, cooking, baking, resting, simmering. Omit only for active hands-on steps with no waiting. |
| `group` | string \| null | no | Free-text group label, typically drawn from the ingredient group vocabulary (`"filling"`, `"mash"`, `"assembly"`). Step-only groups with no matching ingredient group are fine (`"plating"`, `"resting"`). Sections the cooking-mode UI and helps the conversion prompt's derivation heuristic. Leave null for ungrouped recipes. |

**Step-to-ingredient links are derived automatically** from `{NNNN}` placeholders in `content` at import time. The placeholder format is strict: exactly four digits inside braces, no whitespace, matching `\{[0-9]{4}\}`. Near-miss forms (`{1}`, `{0001 }`, `{ABCD}`, `{adjust}`) are treated as literal text, not placeholders, and do not resolve. No explicit `ingredient_refs` field needed. If an ingredient is used in a step but you don't want the quantity inline ("season to taste"), reference it as `{0018}` anyway — placeholder syntax is the canonical way to express "this step uses this ingredient".

## Conversion conventions

Conventions for converting human-written recipes into template form. None of these are validator rules — they're consistency conventions for converters so fixtures and imports stay comparable.

**Cuisine inference.** Assign `cuisine` when the dish is characteristically of one cuisine (style, ingredients, source culture all align). Leave `null` for hybrid dishes, neutral home baking with no strong cuisine identity, or where the source itself doesn't claim one. Don't force-fit — `null` is the right answer often enough.

**Source-supplied macros.** Carry source nutrition figures into `protein_g` / `carbs_g` / `gi_index` only if they describe the recipe as written, without accompaniments. If they include rice, bread, or other to-serve items, leave the fields `null` and put the source figures in `notes`.

**Inline alternatives.** When a recipe lists alternatives inline ("tamari or soy sauce", "ricotta or cottage cheese", "kombu or seaweed flakes"), take the first-named option as the canonical ingredient. Put the alternatives in `notes`. Classification (dietary category, restrictions) follows the canonical choice. Alternative ingredients are not first-class in the spec.

*The `name` field contains only the first-named option, not the "X or Y" phrase.* A recipe line "3 tbsp tamari or soy sauce" converts to `"name": "tamari", "notes": "or soy sauce"` — not `"name": "tamari or soy sauce"`. The `name` is what the importer matches against the master vocabulary; embedded alternatives push the row into fuzzy bucketing unnecessarily. This applies whether the alternatives are near-equivalent (`tamari or soy sauce`, `fresh parsley or coriander`) or genuinely different ingredients the recipe writer offers as substitutions (`sherry vinegar or red wine vinegar`, `Chinese lettuce or cabbage`) — pick one, note the other.

**Whole-recipe branching.** Where a recipe presents a whole-recipe alternative version (e.g. a vegan version of a vegetarian dish achieved by substituting eggs with tofu and dairy with plant equivalents), convert only the canonical (as-written) version. Classification follows the canonical version. Describe the alternative in the top-level `notes`. The twin-recipe pattern — one canonical, one alternative-version, linked — is a future enhancement; until then this convention captures the canonical case only.

**Combined seasonings.** Recipe writers commonly write `salt and black pepper` (or `salt and pepper`) as a single ingredient line. Split these into two rows at conversion time — one for salt, one for black pepper — each with its own quantity (`"to taste"` is fine: `"amount": null` with `"notes": "to taste"`). A single combined row matches only one of the two ingredients in the importer and leaves the other unrepresented in the shopping list.

**Duplicate ingredient names across groups.** When the same ingredient appears in two distinct contexts within a recipe (olive oil for cooking and for greasing a tin; soy sauce in the broth and as a table condiment; ground cumin in two different spice groups), use separate rows with distinct IDs and groups. One row per use, not one row aggregated — this keeps step references unambiguous and shopping-list quantities accurate. Identical context but split for legibility doesn't qualify; this is for genuinely distinct uses.

**Leading prep modifiers.** Where an ingredient name leads with a prep verb followed by the ingredient (`grated nutmeg`, `chopped parsley`, `minced garlic`), convert to the trailing-clause form: `nutmeg, grated`, `parsley, chopped`, `garlic, minced`. The trailing form lets the importer's prep-adjective stripping fire — the leading form is treated as a canonical name and does not strip. Prep verbs in scope: chopped, minced, sliced, diced, drained, rinsed, grated, crushed, juiced, peeled, halved, quartered, torn, shredded, mashed, beaten, softened, washed. Do not apply this to canonical-identity modifiers: `dried oregano`, `fresh basil`, `tinned tomatoes`, `ground cumin`, and `whole milk` all stay as written — these aren't prep verbs, they're part of the ingredient's name. Multiple prep verbs on one ingredient are joined with "and" in trailing form (`lemons, zested and juiced`, `garlic cloves, peeled and crushed`) rather than split across rows — one row per ingredient, even when two prep operations are applied.

**Optional ingredients.** Include as full ingredient rows with `notes: "optional, ..."` describing when they're used. Don't drop them and don't invent a new field.

**Range quantities.** "1–2 tbsp", "2–3 tsp", "4–5 patties", "8–10 slices" — use the lower bound for `amount` and note the range in `notes`. Apply the same rule to `base_servings` for range yields ("Serves 4–6" → `base_servings: 4`, with the range in `notes`). The top-level `notes` field is also where context the spec has no dedicated field for goes — e.g. "serves 4 as a main, 6 as a side", or other serving-context information.

**Servings not stated.** Where the source gives no yield ("Serves N", "Makes N", "Cuts into N" or similar is absent), leave `base_servings` as `null` — don't estimate. The operator can fill it in after import if shopping-list scaling matters for that recipe. Inferred yields from scaling notes, variation paragraphs, tin sizes, or photos don't count — the source has to state a canonical yield directly. If you're tempted to override this rule based on circumstantial evidence in the recipe, don't.

**Non-standard and functional quantities.** Pinches, dashes, splashes, drizzles, length descriptors ("1-inch piece"), and functional amounts ("to taste", "to serve", "for frying", "for greasing") all use `amount: null` / `unit: null`, with the original descriptor in `notes`. Don't substitute estimated weights or volumes — the recipe didn't state them.

**Tin weight, not drained weight.** Where a recipe specifies tinned ingredients, use the tin weight (e.g. `400` for "1 × 400g tin of chickpeas"), not the drained weight. The shopping list maps to "buy a tin", and this matches the worked example. Note the tin format in `notes` if useful ("1 × 400g tin").

**Imperial-to-metric.** Use the standard British cookbook conversion table:

| Imperial | Metric |
|---|---|
| 1 oz | 25 g |
| 2 oz | 50 g |
| 3 oz | 85 g |
| 4 oz | 115 g |
| 8 oz | 225 g |
| 1 lb | 450 g |
| 4 fl oz | 115 ml |
| 1 pint | 570 ml |

For amounts not in the table, interpolate to the nearest 5g / 25g step as the table itself does. Keep originals in `notes` for traceability where useful. Where a recipe uses "oz" for liquids without explicit "fl oz", treat as fluid oz unless context makes weight unambiguous (cream, milk, water → volume; flour, sugar, fat → weight).

**Times stated in the source.** `prep_time_minutes` and `cook_time_minutes` come only from values the source actually states. Three permitted sources:

1. **Labelled fields.** "Prep:", "Cook:", "Hands-on:", "Active time:", "Bake:" — used at face value for the field they name.
2. **Stated step durations for in-session cooking.** Explicit times in method steps ("Bake for 30 minutes", "Simmer 20 mins", "Roast 35–40 mins" — lower bound per the range rule) sum into `cook_time_minutes`. Brief active hob steps with stated durations count (e.g. "fry 2 minutes each side" → 4). When stated step durations clearly run in parallel (one step in the oven while another is on the hob; potatoes boiling while veg is air-fried), sum only the longer of the parallel pair. The result is the critical path — the elapsed time an attentive cook would experience. If the critical path can't be determined confidently from the source, leave `cook_time_minutes` `null` and put the individual durations in `notes`. Don't middle-ground between sum and critical-path — null is the correct answer when the structure is unclear.
3. **Single combined time, zero cook activity.** Where the recipe has no cook activity at all (no-cook salads, all-blender dips like houmous), a combined time populates `prep_time_minutes`.

Don't estimate, don't derive one field by subtracting from a stated total, don't split a combined total across both fields where both prep and cook activities exist. If only a total is stated and the recipe involves both prep and cook, both fields stay `null` and the total goes in `notes` if useful. Long out-of-session time (overnight soaks, multi-hour chills, day-ahead marinades) goes in `notes`, never in `cook_time_minutes`. Post-cook rest (resting meat, in-tin cooling after bake) is in-session but not cook time — exclude from `cook_time_minutes`. This is specifically the tail of a cooked dish where the cook isn't meaningfully waiting; in-session passive waits during or before cooking are covered by the inclusive rule above.

## Seeded vocabulary — frameworks, layers, families

`component_layers` codes must match the seeded vocabulary. `recipe_db_install.sql` is canonical; this table is a convenience snapshot — if it drifts from the seed, the seed wins.

| Framework | Layers | Families (layer → families) |
|---|---|---|
| `component_dinner` | `base`, `topping`, `veg`, `finisher` | `topping` → `mash`, `sliced_potato`, `grain_seed`, `pastry`, `carb_alongside` |
| `bento` | `anchor_protein`, `carb`, `veg_salad`, `extras` | none |
| `breakfast_bowl` | `base`, `protein`, `veg`, `extras` | none |
| `mason_jar_salad` | `dressing`, `hardy_veg`, `grain_protein`, `leaves` | none |
| `smorrebrod` | `bread`, `spread`, `topping`, `garnish` | none |
| `mezze` | `dip`, `salad_veg`, `protein`, `bread`, `extras` | none |

Only `component_dinner/topping` has seeded families. For every other layer, `family` must be `null`. A `family` that isn't seeded under its layer is a validation error, not a warning.

## Derived components

When a recipe contains a section that could stand alone as a reusable component (a base, a sauce, a mash, a dip), declare it in the `derived_components` array. The importer creates a separate component entry alongside the main recipe, with its own ingredient and step rows copied from the parent at import time.

After import the recipe and the derived component are independent — editing one does not affect the other. The reference is only for authoring.

Each `derived_components` entry:

| Field | Type | Required | Notes |
|---|---|---|---|
| `external_ref` | string (slug) | yes | Independent of the parent's slug. Must be unique. |
| `name` | string | yes | The component's own name. |
| `description` | string | no | Component-specific description. |
| `notes` | string | no | Component-specific notes. |
| `component_layers` | object[] | yes | Same structure as the top-level field. Which framework layers the component registers against. |
| `cuisine` | string \| null | no | Defaults to parent's value if omitted. |
| `dietary_category` | string \| null | no | **Specify explicitly**. May differ from parent (e.g. a vegan filling extracted from a vegetarian dish with dairy in the mash). |
| `dietary_restrictions` | string[] | no | Same. Specify explicitly. |
| `nutritional_tags` | string[] | no | Specify explicitly. |
| `protein_g` | number \| null | no | Per-serving macro for the component used alone. |
| `carbs_g` | number \| null | no | Same. |
| `gi_index` | integer \| null | no | Same. |
| `base_servings` | integer \| null | no | The component's own serving count when used independently. Often the same as the parent's, sometimes not. Leave `null` if the parent's is null, or if the operator hasn't supplied one. |
| `prep_time_minutes` | integer \| null | no | Time to make this component alone — usually less than the parent's. |
| `cook_time_minutes` | integer \| null | no | Same. |
| `ingredient_ids` | string[] | yes | Parent ingredient `id`s to include. The importer copies these rows into the component's own ingredient list. |
| `step_indices` | integer[] | yes | Parent step positions (0-indexed) to include. Importer copies these into the component's own step list. |

The derived component inherits ingredient `group` labels and step `group` labels from the parent. If the parent's groups don't make sense in component context, edit the copied rows after import.

---

## Validation rules

The importer will check:

- All required fields present and non-empty.
- Unknown top-level keys are rejected, **except** keys prefixed with `_` (e.g. `_fixture_notes`), which are ignored as metadata. This catches typos like `"ingredient"` for `"ingredients"` while allowing comment keys.
- `import_type` is `"recipe"` or `"component"`.
- `external_ref` matches `^[a-z0-9-]+$` and is unique in the database. No minimum length beyond the regex — single-character slugs are permitted.
- Derived components' `external_ref`s are unique, and each must differ from the parent's `external_ref` within the same payload (caught pre-commit, not left to the database constraint).
- All lookup codes match seeded values: `cuisine`, `dietary_category`, items in `dietary_restrictions`, `nutritional_tags`, `meal_types`, `meal_formats`, `component_layers.framework`, `component_layers.layer`, `component_layers.family`. See the Seeded vocabulary section for framework/layer/family codes.
- `component_layers` is empty when `import_type = "recipe"`. Use `derived_components` instead.
- `meal_types` and `meal_formats` are empty when `import_type = "component"`.
- `derived_components` is empty when `import_type = "component"` (components don't derive further).
- A recipe has at least one ingredient and at least one step. A component has at least one ingredient and at least one step. Empty `ingredients` or `steps` arrays are rejected.
- Each derived component has at least one `ingredient_ids` entry and at least one `step_indices` entry. Empty reference arrays are rejected.
- Ingredient `id` matches `^[0-9]{4}$` and is unique within the recipe.
- Every `{NNNN}` placeholder in step `content` resolves to a valid local ingredient id. Placeholder matching is strict (`\{[0-9]{4}\}`); near-miss forms are literal text and are not required to resolve.
- Every `ingredient_ids` entry in a derived component resolves to a valid parent ingredient id. Entries must be unique; order is not significant (rows are copied in parent `sort_order`).
- Every `step_indices` entry is a valid 0-based index into the parent `steps` array. Entries must be unique; order is not significant (steps are copied in parent order).
- A derived component may cover the parent's full ingredient and step range — a recipe that is also wholly a reusable component is valid, no warning.
- Freeform nullable string fields (`description`, `source`, top-level `notes`, `ingredient.notes`, `ingredient.unit`, `ingredient.group`, `step.group`) accept `""` and treat it as equivalent to `null`. This does not apply to lookup-code fields, where `""` is an invalid code.
- A missing optional key is treated as `null` (or the empty array, for array-typed fields). The importer does not require every template key to be present — only the required fields. This keeps imports from unconfigured converters working.
- `timer_seconds`, `base_servings`, `prep_time_minutes`, `cook_time_minutes`, `gi_index` are positive integers when set.
- `protein_g`, `carbs_g` are non-negative numbers when set.
- **Ingredient consistency check** (advisory, not blocking): if every ingredient in the recipe has a `dietary_category_id` set in the master, the importer checks that the declared `dietary_category` is consistent (i.e. not more permissive than what the ingredients allow). Operator can override.

---

## Worked example: North African Spiced Shepherd's Pie

The original `north_african_shepherds_pie.json` converted to the template format, with the lentil base extracted as a derived component for the `component_dinner` framework's `base` layer.

Notable conversions from the original source JSON:
- Added `import_type`, `external_ref`.
- Added cuisine and dietary classification (`vegan`), and `["soy"]` for the miso paste in both parent and derived component.
- Tagged as both a dinner and a microwave lunch (per the lunch options doc).
- Grouped ingredients into "filling" and "mash" — the original was flat.
- Step `group` labels match ingredient groups.
- Added `{NNNN}` placeholders in step content for scaling. Refs derive automatically.
- Salt and pepper split into two rows (one each), `amount: null` with a `"to taste"` note, per the combined-seasonings convention.
- Added a `derived_components` entry for the lentil & bean base.
- Macros left null — would be populated during Claude-assisted recipe development.

```json
{
  "import_type": "recipe",
  "external_ref": "north-african-spiced-shepherds-pie",
  "name": "North African Spiced Shepherd's Pie",
  "description": "A harissa-spiced lentil and mushroom filling with a golden olive oil mash — warming, hearty, and even better the next day.",
  "source": "Claude chat",

  "cuisine": "moroccan",
  "dietary_category": "vegan",
  "dietary_restrictions": ["soy"],
  "nutritional_tags": [],

  "protein_g": null,
  "carbs_g": null,
  "gi_index": null,

  "meal_types": ["dinner", "lunch"],
  "meal_formats": ["microwave"],

  "component_layers": [],

  "base_servings": 4,
  "prep_time_minutes": 25,
  "cook_time_minutes": 70,

  "ingredients": [
    { "id": "0001", "name": "olive oil", "amount": 3, "unit": "tbsp", "group": "filling", "notes": null },
    { "id": "0002", "name": "leek, sliced", "amount": 1, "unit": null, "group": "filling", "notes": null },
    { "id": "0003", "name": "celery stalks, diced", "amount": 2, "unit": null, "group": "filling", "notes": null },
    { "id": "0004", "name": "carrots, diced", "amount": 2, "unit": null, "group": "filling", "notes": null },
    { "id": "0005", "name": "garlic cloves, minced", "amount": 3, "unit": null, "group": "filling", "notes": null },
    { "id": "0006", "name": "cumin seeds", "amount": 1, "unit": "tsp", "group": "filling", "notes": null },
    { "id": "0007", "name": "ground cumin", "amount": 1, "unit": "tsp", "group": "filling", "notes": null },
    { "id": "0008", "name": "rose harissa paste", "amount": 2, "unit": "tbsp", "group": "filling", "notes": null },
    { "id": "0009", "name": "mushrooms, roughly chopped", "amount": 200, "unit": "g", "group": "filling", "notes": null },
    { "id": "0010", "name": "green or brown lentils, dried", "amount": 150, "unit": "g", "group": "filling", "notes": null },
    { "id": "0011", "name": "white beans, drained", "amount": 400, "unit": "g", "group": "filling", "notes": "tinned" },
    { "id": "0012", "name": "tinned tomatoes", "amount": 400, "unit": "g", "group": "filling", "notes": null },
    { "id": "0013", "name": "vegetable stock", "amount": 300, "unit": "ml", "group": "filling", "notes": null },
    { "id": "0014", "name": "miso paste", "amount": 1, "unit": "tbsp", "group": "filling", "notes": null },
    { "id": "0015", "name": "lemon, juiced", "amount": 0.5, "unit": null, "group": "filling", "notes": null },
    { "id": "0016", "name": "floury potatoes, peeled and chopped", "amount": 800, "unit": "g", "group": "mash", "notes": null },
    { "id": "0017", "name": "olive oil", "amount": 3, "unit": "tbsp", "group": "mash", "notes": "for the mash" },
    { "id": "0018", "name": "salt", "amount": null, "unit": null, "group": "mash", "notes": "to taste" },
    { "id": "0019", "name": "black pepper", "amount": null, "unit": null, "group": "mash", "notes": "to taste" }
  ],

  "steps": [
    {
      "title": "Cook the lentils",
      "content": "Rinse {0010} and simmer in plenty of water for 20-25 minutes until just tender but still holding their shape. Drain and set aside.",
      "timer_seconds": 1500,
      "group": "filling"
    },
    {
      "title": "Build the base",
      "content": "Heat {0001} in a large pan over medium heat. Add {0006} and let them sizzle for 30 seconds, then add {0002}, {0003} and {0004}. Cook for 8-10 minutes until softened.",
      "timer_seconds": 540,
      "group": "filling"
    },
    {
      "title": "Add garlic and spices",
      "content": "Add {0005}, {0007} and {0008}. Stir well and cook for 2 minutes until fragrant.",
      "timer_seconds": 120,
      "group": "filling"
    },
    {
      "title": "Add mushrooms",
      "content": "Add {0009} and cook for 5 minutes until they've released their moisture and started to colour.",
      "timer_seconds": 300,
      "group": "filling"
    },
    {
      "title": "Build the sauce",
      "content": "Add {0012}, {0013} and {0014}. Stir to combine, then add the cooked lentils and {0011}. Simmer on a low heat for 15-20 minutes until thick and rich. It should not be sloppy — let it reduce properly. Finish with {0015} and season well.",
      "timer_seconds": 1200,
      "group": "filling"
    },
    {
      "title": "Make the mash",
      "content": "While the filling simmers, boil {0016} in salted water until tender, around 20 minutes. Drain thoroughly, then mash with {0017} and a splash of the cooking water if needed. Season generously with {0018} and {0019}. You want it smooth and spreadable but not too loose.",
      "timer_seconds": 1200,
      "group": "mash"
    },
    {
      "title": "Assemble",
      "content": "Preheat oven to 200°C. Spoon the filling into a baking dish. Spread the mash over the top evenly, then rough up the surface with a fork to create ridges — these will catch and brown nicely. Drizzle a little extra olive oil over the top.",
      "timer_seconds": null,
      "group": "assembly"
    },
    {
      "title": "Bake",
      "content": "Bake for 25-30 minutes until the top is golden and the filling is bubbling at the edges. Rest for 5 minutes before serving.",
      "timer_seconds": 1800,
      "group": "assembly"
    }
  ],

  "notes": "The filling genuinely improves overnight as the harissa and spices develop. If reheating the next day, add a splash of water or stock before putting it back in the oven covered with foil, then uncover for the last 10 minutes to re-crisp the mash. You can add a little extra harissa on top of the mash before baking if you want more heat on the surface.",

  "derived_components": [
    {
      "external_ref": "north-african-spiced-lentil-bean-base",
      "name": "North African Spiced Lentil & Bean Base",
      "description": "Harissa-spiced lentils, white beans and mushrooms in a rich tomato base. A reusable dinner base that pairs with mash, sliced potato, polenta, or grain toppings.",
      "notes": "Improves overnight. Freezes well in portions.",

      "component_layers": [
        { "framework": "component_dinner", "layer": "base", "family": null }
      ],

      "cuisine": "moroccan",
      "dietary_category": "vegan",
      "dietary_restrictions": ["soy"],
      "nutritional_tags": [],

      "protein_g": null,
      "carbs_g": null,
      "gi_index": null,

      "base_servings": 4,
      "prep_time_minutes": 15,
      "cook_time_minutes": 50,

      "ingredient_ids": [
        "0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008",
        "0009", "0010", "0011", "0012", "0013", "0014", "0015"
      ],
      "step_indices": [0, 1, 2, 3, 4]
    }
  ]
}
```

---

## Conversion-time prompt

Drop this into project knowledge (or paste into the conversion chat) so Claude takes the right approach when helping convert a recipe to template form.

```
When converting a recipe into the recipe import template:

1. Produce the main recipe block first.
   - Group ingredients sensibly using the `group` field.
   - Apply matching `group` labels to steps so cooking-mode UI can section
     the method.
   - Use {NNNN} placeholders in step content for every ingredient
     referenced in a step (refs are derived automatically from these).
   - Classify the recipe: cuisine, dietary category (least-restrictive-
     eater rule), restrictions (contains axis), nutritional tags,
     meal types, meal formats.
   - Populate macro fields (protein_g, carbs_g, gi_index) if known from
     the development context; leave null if not.

2. After the main block is drafted, scan the recipe for sections
   that could stand alone as reusable components. Common candidates:
   - Sauces, dressings, dips, spreads, salsas
   - Bases or fillings that pair with multiple toppings
   - Mash, polenta, pastry tops, grain pilafs
   - Pickles, finishers, drizzles
   - Marinades that work across multiple proteins

   Ingredient groups are useful as a first-pass heuristic — a clean
   "filling" group or "sauce" group is usually a derivation candidate.

3. For each candidate, ask the operator before adding it:
     "The [name] looks like it could also be a [layer] component
      for the [framework] framework. Add it as a derived component?"

   Suggest at most 2-3 strongest candidates per recipe. "No derivations"
   is a normal answer — don't push.

4. If the operator confirms, ask:
     - Which framework layer(s) and family (if any) it registers against
     - Whether the dietary classification differs from the parent
       (e.g. vegan filling extracted from a vegetarian dish)
     - Whether nutritional tags differ from the parent
     - A short component-specific name, description, and notes if they
       want different wording

5. Add the derived_components entry. ingredient_ids and step_indices
   reference the parent — do not duplicate the content.

6. Before producing the final JSON, summarise: "This will create one
   recipe and N components: [list]. Proceed?" Wait for confirmation.

Do not invent component derivations the operator hasn't approved.
A recipe with no derivable components is a normal outcome.

If the operator says "just convert it, no components" or similar,
skip step 2-5 entirely. The override is normal.
```
