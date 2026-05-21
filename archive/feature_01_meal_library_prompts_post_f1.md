# Feature 01 — Meal Library: Lovable Prompts
_Status: Complete_

---

## Prompt 1 — Meal list page

```
Build the Meal Library page.

Read from the `meal` table. Include a toggle to switch between two display modes:
- List view (default): compact rows showing key fields
- Card/grid view: tile layout with more visual breathing room

Each item (in either view) shows:
- meal name
- status badge (idea / recipe / composition)
- dietary_category
- cuisine (join to `cuisine` lookup)
- meal_type tags (join to `meal_meal_type` + `meal_type`)

Persist the user's last view selection in localStorage so it survives page refresh.

Include a search bar (searches `name` by partial match) and filter controls for:
- status
- dietary_category
- cuisine

No create/edit yet. Read-only, no auth required (RLS is public read on library tables).

Do NOT create or modify any database tables.
```

---

## Prompt 2 — Meal detail view

```
Add a meal detail view, opened when a meal card is clicked.

Show:
- All fields from `meal` (name, description, status, base_serving_count, dietary_category, cuisine, protein_g, carbs_g, gi_index — show macros only if non-null)
- Dietary restrictions (join to `meal_restriction` + `dietary_restriction`)
- Nutritional tags (join to `meal_nutritional_tag` + `nutritional_tag`)
- Meal types and formats (join to `meal_meal_type`/`meal_type`, `meal_meal_format`/`meal_format`)
- If status = recipe: ingredients (from `meal_ingredient` — display `ingredient_name`, quantity, unit) and steps (from `meal_step` ordered by `step_number`, grouped by `group_label` if present)
- If status = composition: list of linked components (from `meal_component` + `component` — names only, no detail yet)
- If status = idea: show a placeholder ("No recipe or components yet")

Do NOT create or modify any database tables.
```

---

## Prompt 3 — Create/edit form (writer-only)

```
Add create and edit functionality for meals. Writers only (check auth via Supabase — a user is a writer if they have a row in `app_writer` matching their auth.users uid and `household_id = 1`).

Create button visible to writers on the library page. Edit button visible on the detail view.

The form covers `meal` core fields only:
- name (required)
- status (required — idea / recipe / composition)
- description
- base_serving_count
- dietary_category (dropdown from `dietary_category` lookup)
- cuisine (dropdown from `cuisine` lookup)
- protein_g, carbs_g, gi_index (optional numeric fields)
- source, external_ref

Multi-select pickers for:
- dietary restrictions (from `dietary_restriction`)
- nutritional tags (from `nutritional_tag`)
- meal types (from `meal_type`)
- meal formats (from `meal_format`)

No ingredient or step editing yet — those come later in the ingredient import feature.

On save: insert/update `meal` row, then replace rows in the four join tables for the multi-selects.

Do NOT create or modify any database tables.
```

---

## Prompt 4 — Login (magic link)

```
Add a login page at /login using Supabase magic link auth (OTP by email —
not email/password). The user enters their email, receives a link, clicks
it, and is redirected to the meal library.

Add a sign-out option in the nav. No sign-up flow — accounts are created
by the operator directly in Supabase.

The edit and create buttons on the meal library and detail view should only
be visible when the user is authenticated AND has a row in the `app_writer`
table matching their uid. Check this on the client side after login and
store the result in app state.

Do NOT create or modify any database tables.
```

---

## Fix prompts applied during build

These were not in the original plan but were needed to resolve issues Lovable introduced.

### Fix 1 — Meal detail routing

**Problem:** Navigating to `/meals/[id]` rendered the meal library page instead of the detail view.

```
Navigating to /meals/[id] is not rendering the meal detail view — the
meal library page renders instead. Fix the routing so that /meals/[id]
correctly renders the detail view for the meal with that id.

Do NOT create or modify any database tables.
```

**Root cause (per Lovable):** `meals.$mealId.tsx` was acting as a layout route without an `<Outlet />`, so the detail view never rendered. Fixed by renaming to `meals.$mealId.index.tsx`.

### Fix 2 — Edit button on detail view

**Problem:** Edit button on the detail view appeared but did nothing.

```
The edit button on the meal detail view at /meals/[id] is not opening
the edit form. Fix it so the edit button correctly opens the edit form
pre-populated with the existing meal data.

Do NOT create or modify any database tables.
```

**Root cause (per Lovable):** Same layout/Outlet issue as Fix 1 — `/meals/$mealId/edit` was not rendering independently of the parent route.

---

## Notes

- Seed at least one meal row manually in Supabase after running prompt 1. Use the SQL editor, not the table editor — RLS blocks the table editor for unauthenticated inserts.
- The writer check assumes `household_id = 1`. Revisit post-v1 if multi-household becomes a concern.
- If Lovable routes the detail view to `/meals/[id]` rather than a modal, that is preferable — don't fight it on layout choices.
- After running prompts, hard-refresh the preview a couple of times if changes appear not to have taken — Lovable's preview can be slow to reflect new builds.
