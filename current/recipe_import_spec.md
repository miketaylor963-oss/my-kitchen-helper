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
| `nutritional_tags` | string[] | Codes from `nutritional_tag` describing qualitative nutritional properties (`omega3_strong`). Empty array if none. The ★ marker in the source docs maps to `omega3_strong`. |

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
| `base_servings` | integer | Number of servings the ingredient quantities make. Shopping-list scaling multiplies against this. |
| `prep_time_minutes` | integer \| null | Hands-on time. Leave `null` when the source doesn't state it — don't estimate. |
| `cook_time_minutes` | integer \| null | In-session unattended time: oven, hob, fryer, short chills (≤2 hours). Leave `null` when the source doesn't state it — don't estimate. Long out-of-session time (overnight soaks, multi-hour chills, day-ahead marinades) goes in `notes`, not here. |

## Ingredients

Array of ingredient rows. Order matters — used as `sort_order` in the database.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique within this recipe. Convention: 4-char zero-padded (`0001`, `0002`). Referenced by step placeholders and by derived components. |
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
| `group` | string \| null | no | Free-text group label matching the ingredient group vocabulary (`"filling"`, `"mash"`, `"assembly"`). Sections the cooking-mode UI and helps the conversion prompt's derivation heuristic. Leave null for ungrouped recipes. |

**Step-to-ingredient links are derived automatically** from `{NNNN}` placeholders in `content` at import time. No explicit `ingredient_refs` field needed. If an ingredient is used in a step but you don't want the quantity inline ("season to taste"), reference it as `{0018}` anyway — placeholder syntax is the canonical way to express "this step uses this ingredient".

## Conversion conventions

Conventions for converting human-written recipes into template form. None of these are validator rules — they're consistency conventions for converters so fixtures and imports stay comparable.

**Inline alternatives.** When a recipe lists alternatives inline ("tamari or soy sauce", "ricotta or cottage cheese", "kombu or seaweed flakes"), take the first-named option as the canonical ingredient. Put the alternatives in `notes`. Classification (dietary category, restrictions) follows the canonical choice. Alternative ingredients are not first-class in the spec.

**Optional ingredients.** Include as full ingredient rows with `notes: "optional, ..."` describing when they're used. Don't drop them and don't invent a new field.

**Range quantities.** "1–2 tbsp", "2–3 tsp", "4–5 patties", "8–10 slices" — use the lower bound for `amount` and note the range in `notes`. Apply the same rule to `base_servings` for range yields ("Serves 4–6" → `base_servings: 4`, with the range in `notes`).

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

For amounts not in the table, interpolate to the nearest 5g / 25g step as the table itself does. Keep originals in `notes` for traceability where useful.

**Times not stated.** Leave `prep_time_minutes` and `cook_time_minutes` as `null`. Estimating produces dishonest data and breaks downstream "active vs total" filtering.

**Long unattended time.** Overnight soaks, multi-hour chills, day-ahead marinades — don't put these in `cook_time_minutes`. Describe in `notes`.

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
| `base_servings` | integer | yes | The component's own serving count when used independently. Often the same as the parent's, sometimes not. |
| `prep_time_minutes` | integer \| null | no | Time to make this component alone — usually less than the parent's. |
| `cook_time_minutes` | integer \| null | no | Same. |
| `ingredient_ids` | string[] | yes | Parent ingredient `id`s to include. The importer copies these rows into the component's own ingredient list. |
| `step_indices` | integer[] | yes | Parent step positions (0-indexed) to include. Importer copies these into the component's own step list. |

The derived component inherits ingredient `group` labels and step `group` labels from the parent. If the parent's groups don't make sense in component context, edit the copied rows after import.

---

## Validation rules

The importer will check:

- All required fields present and non-empty.
- `import_type` is `"recipe"` or `"component"`.
- `external_ref` matches `^[a-z0-9-]+$` and is unique in the database.
- Derived components' `external_ref`s also unique.
- All lookup codes match seeded values: `cuisine`, `dietary_category`, items in `dietary_restrictions`, `nutritional_tags`, `meal_types`, `meal_formats`, `component_layers.framework`, `component_layers.layer`, `component_layers.family`.
- `component_layers` is empty when `import_type = "recipe"`. Use `derived_components` instead.
- `meal_types` and `meal_formats` are empty when `import_type = "component"`.
- `derived_components` is empty when `import_type = "component"` (components don't derive further).
- Every ingredient `id` is unique within the recipe.
- Every `{NNNN}` placeholder in step `content` resolves to a valid local ingredient id.
- Every `ingredient_ids` entry in a derived component resolves to a valid parent ingredient id.
- Every `step_indices` entry is a valid 0-based index into the parent `steps` array.
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
- Salt and pepper changed to `amount: null` with a `"to taste"` note rather than the placeholder `1 pinch`.
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
    { "id": "0018", "name": "salt and black pepper", "amount": null, "unit": null, "group": "mash", "notes": "to taste" }
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
      "content": "While the filling simmers, boil {0016} in salted water until tender, around 20 minutes. Drain thoroughly, then mash with {0017} and a splash of the cooking water if needed. Season generously with {0018}. You want it smooth and spreadable but not too loose.",
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
