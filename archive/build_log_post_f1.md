# Build Log

A running record of issues encountered, fixes applied, and decisions made during the build. Each entry notes the feature, the problem, the fix, and any implications for future work.

---

## Feature 01 — Meal Library

### Issue 1 — Supabase table editor blocked by RLS

**Symptom:** Attempting to insert a meal row via the Supabase table editor returned a permission error.

**Cause:** RLS write policies require an authenticated session. The table editor does not run as `postgres`; it uses the `anon` or `authenticated` role depending on context, so the write policy blocked it.

**Fix:** Use the SQL editor for manual data entry — it runs as the `postgres` role and bypasses RLS. For test data inserts, the SQL editor is the right tool regardless.

**Implication:** Document this clearly for future reference. The table editor is fine for browsing; the SQL editor is the tool for seeding.

---

### Issue 2 — `permission denied for table meal` on library page (unauthenticated)

**Symptom:** The meal library page displayed "Failed to load meals: permission denied for table meal" for unauthenticated users.

**Cause:** RLS policies allow public reads, but Postgres requires the underlying table privilege to also be granted to the role. The install script enables RLS and creates policies but does not run `GRANT SELECT ... TO anon`.

**Fix:** Run the following in the Supabase SQL editor:

```sql
GRANT SELECT ON
  meal, meal_ingredient, meal_step, meal_restriction, meal_nutritional_tag,
  meal_meal_type, meal_meal_format, meal_component,
  component, cuisine, dietary_category, dietary_restriction,
  meal_type, meal_format, nutritional_tag, framework
TO anon;
```

**Implication:** The install script (`recipe_db_install_v2.sql`) is missing these grants. They should be added to the script before the next clean install. Flag for schema maintenance.

---

### Issue 3 — `permission denied for table meal` on library page (authenticated)

**Symptom:** After logging in via magic link, the same permission denied error appeared.

**Cause:** Same as Issue 2 — the `authenticated` role also lacks the underlying table privilege.

**Fix:** Run in the SQL editor:

```sql
GRANT SELECT ON
  meal, meal_ingredient, meal_step, meal_restriction, meal_nutritional_tag,
  meal_meal_type, meal_meal_format, meal_component,
  component, cuisine, dietary_category, dietary_restriction,
  meal_type, meal_format, nutritional_tag, framework
TO authenticated;

GRANT INSERT, UPDATE, DELETE ON
  meal, meal_ingredient, meal_step, meal_restriction, meal_nutritional_tag,
  meal_meal_type, meal_meal_format, meal_component
TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

The `SEQUENCES` grant is required for auto-increment IDs on inserts.

**Implication:** Same as Issue 2 — add to install script.

---

### Issue 4 — Edit button not visible after login

**Symptom:** Signed in as a writer but no edit button appeared on meal cards or detail view.

**Cause:** The app checks for a row in `app_writer` after login to confirm write access. `app_writer` had not been granted SELECT to the `authenticated` role.

**Fix:**

```sql
GRANT SELECT ON app_writer TO authenticated;
```

Then sign out and back in so the app re-checks the table.

**Implication:** `app_writer` should be included in the authenticated grants in the install script.

---

### Issue 5 — `app_writer` row not present for user

**Symptom:** After fixing the grant, edit button still not visible.

**Cause:** No `app_writer` row existed for the authenticated user. The RLS write policy gates on authenticated session, but the *application* logic gates edit visibility on having an `app_writer` row.

**Fix:** Insert the row manually using the UUID from Supabase Authentication → Users:

```sql
INSERT INTO app_writer (household_id, user_id)
VALUES (1, 'your-uuid-here');
```

Sign out and back in after inserting.

---

### Issue 6 — Meal detail routing not working

**Symptom:** Clicking a meal in the library changed the URL to `/meals/1` but the detail view did not render — the library page remained visible.

**Cause:** Lovable generated `meals.$mealId.tsx` as a layout route without an `<Outlet />`, so the child route (the detail view) never rendered.

**Fix prompt sent to Lovable:**

```
Navigating to /meals/[id] is not rendering the meal detail view — the
meal library page renders instead. Fix the routing so that /meals/[id]
correctly renders the detail view for the meal with that id.

Do NOT create or modify any database tables.
```

**Lovable's fix:** Renamed `meals.$mealId.tsx` to `meals.$mealId.index.tsx` so it acts as the index route rather than a layout.

---

### Issue 7 — Edit button on detail view did nothing

**Symptom:** Edit button was visible on the detail view but clicking it had no effect.

**Cause:** Same React Router layout/Outlet issue as Issue 6. The `/meals/$mealId/edit` route was not rendering independently of the parent.

**Fix prompt sent to Lovable:**

```
The edit button on the meal detail view at /meals/[id] is not opening
the edit form. Fix it so the edit button correctly opens the edit form
pre-populated with the existing meal data.

Do NOT create or modify any database tables.
```

**Lovable's fix:** Separated the edit route so it renders independently.

---

### Issue 8 — User account creation / password

**Symptom:** Created a user via Supabase Authentication → Invite User. The invite email arrived and was accepted, but no password was set.

**Resolution:** Magic link / OTP auth does not require a password — login is via email link each time. The login prompt was updated to use magic link auth explicitly (not email/password), which aligns with how Supabase handled the invite.

**Implication:** Updated Prompt 4 in the feature 01 prompts file to specify magic link auth. Password-based auth is not used in this app.

---

## Pending schema fixes

The following grants are missing from `recipe_db_install_v2.sql` and need to be added before the next clean install:

```sql
GRANT SELECT ON
  meal, meal_ingredient, meal_step, meal_restriction, meal_nutritional_tag,
  meal_meal_type, meal_meal_format, meal_component,
  component, cuisine, dietary_category, dietary_restriction,
  meal_type, meal_format, nutritional_tag, framework,
  app_writer
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON
  meal, meal_ingredient, meal_step, meal_restriction, meal_nutritional_tag,
  meal_meal_type, meal_meal_format, meal_component
TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

These should be added as a new section (Section 14) in the install script before the verification queries.
