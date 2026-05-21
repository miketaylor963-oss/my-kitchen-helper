# Migration Log

A running record of the Lovable → local Claude Code + Vercel cutover that happened between F1 (Meal Library) and F2 (Ingredient Master + Import Flow). Same format as `build_log_post_f1.md`: each entry has the problem (or decision), the fix, and any implication for future work.

The strategic reasoning sits in `planning_log_post_migration.md`, Stage 6. This file is the tactical sequence: what we did, in what order, and what bit us.

---

## Starting state

- **Editor:** Lovable's web IDE.
- **Codebase:** Lovable-managed, with GitHub sync enabled (paid plan feature).
- **Hosting:** Lovable's preview URL.
- **Database:** Supabase, but provisioned inside Lovable Cloud — not in a separate Supabase account.
- **Repo:** existed via Lovable's GitHub integration but had not been cloned locally.

---

## Target state

- **Editor:** Claude Code running locally against a clone of the GitHub repo.
- **Codebase:** GitHub becomes the source of truth. Lovable falls out of the picture.
- **Hosting:** Vercel, auto-deploy on push to `main`.
- **Database:** Supabase project in Mike's own account, with the v2_post_f1 schema reinstalled.
- **Repo:** `miketaylor963-oss/my-kitchen-helper`, cloned locally under `~/dev/my-kitchen-helper`.

---

## Sequence

1. Connect Lovable to GitHub via OAuth; let Lovable push the current state to a new repo.
2. Install Node.js (LTS) and Claude Code locally.
3. Clone the repo, install dependencies, get `npm run dev` running locally.
4. Discover the database is in Lovable Cloud; create a fresh Supabase project under Mike's own account.
5. Run the v2_post_f1 install script against the new Supabase project.
6. Apply the F1 and F2 grant blocks (overlapping; idempotent).
7. Seed `app_writer` with Mike's UUID.
8. Wire local dev to the new Supabase via `.env.local`.
9. Confirm local dev can read and write against the new database.
10. Connect Vercel to the GitHub repo, set env vars, deploy.
11. Add the Vercel URL to Supabase's auth URL configuration.
12. Smoke-test the production URL: load, sign in, read, write.

---

## Decisions made during the cutover

### Decision M1 — Move hosting at the same time as the editor

**Context:** The editor move (Lovable IDE → Claude Code) and the hosting move (Lovable preview → Vercel) could have been staged. Doing them together meant more change at once but a clean break.

**Choice:** Move both. Continuing to use Lovable's hosting after moving editing locally would have left Lovable trying to redeploy commits it didn't author, which is exactly the round-tripping problem the migration was meant to escape.

**Implication:** Once production was on Vercel, Lovable had no remaining role. Closed the loop cleanly.

---

### Decision M2 — Fresh Supabase project, not a Lovable Cloud export

**Context:** The database lived inside Lovable Cloud. Options: try to migrate the existing Lovable Cloud Supabase into Mike's account, or stand up a fresh project and reinstall the schema.

**Choice:** Fresh project. The v2_post_f1 install script is one paste; the F1 data was small (a handful of test meals) and trivial to re-enter.

**Implication:** The old Lovable Cloud Supabase is left intact but unused. No data migration headache. The cost — losing the F1 test data — was negligible.

---

### Decision M3 — Magic-link auth only

**Context:** During F1, account creation via Supabase's "Invite User" produced an email but no password — login was via the magic link. This was initially a confusion (no password set), then a deliberate choice.

**Choice:** Lock to magic link / OTP. No password auth in this app.

**Implication:** Updated the project knowledge file and the F1 prompts file to reference magic link auth explicitly. Simplifies onboarding (no password reset flows to build) and is fine for a small writer set.

---

## Issues encountered

### Issue M1 — Database wasn't where we thought it was

**Symptom:** Tried to point local dev at "the" Supabase URL and the URL Mike had didn't match what Lovable was using. Sign-in attempts failed; queries returned errors.

**Cause:** Lovable provisions Supabase implicitly inside Lovable Cloud. There was no separate Supabase project in Mike's account to point at.

**Fix:** Created a new Supabase project under Mike's own account, copied the URL and anon key into `.env.local`, ran the install script against the new project.

**Implication:** Anyone doing this cutover should expect the same surprise. The Supabase-in-Lovable-Cloud arrangement is invisible until you try to leave. Flag it up-front for future migrations.

---

### Issue M2 — Three SQL blocks for a clean install, not one

**Symptom:** Setting up the new Supabase project required:
1. Run `recipe_db_install_v2_post_f1.sql`.
2. Run the consolidated F1 grant block.
3. Run the F2 grant extension block.

Three pastes for a clean install. Easy to forget the order. The F1 and F2 grant blocks overlap (intentionally — `GRANT` is idempotent) but the cognitive load of "did I run them all?" was real.

**Fix:** Rolled both grant blocks into `recipe_db_install_v3.sql` as Section 14. A clean install is now a single paste.

**Implication:** Earlier scripts (`recipe_db_install_v2.sql`, `recipe_db_install_v2_post_f1.sql`) are superseded. Documentation referenced from them ("apply the F1 grants" etc.) should be redirected at v3.

---

### Issue M3 — `app_writer.note` column doesn't exist

**Symptom:** The first attempt to insert an `app_writer` row included a `note` column. Postgres returned `column "note" of relation "app_writer" does not exist`.

**Cause:** Drafting error. The `app_writer` table doesn't have a `note` column in v2 schema.

**Fix:** Insert with just `user_id` (and `household_id` defaults to 1).

**Implication:** Worth adding a `note TEXT` column later when there are several writers and remembering which UUID belongs to whom matters. Not urgent. Flagged for the writer-management feature build.

---

### Issue M4 — Routine git noise after first `npm run dev`

**Symptom:** First `git status` after running the dev server showed `src/routeTree.gen.ts` modified and `package-lock.json` untracked.

**Cause:** Both are routine. TanStack Router regenerates `routeTree.gen.ts` on dev-server start (`.gen.ts` is a "do not hand-edit" convention). `package-lock.json` exists because npm wrote one; if it's not in `.gitignore`, it should be committed.

**Fix:** Commit both. Don't worry about the routeTree changes; they're deterministic.

**Implication:** Worth mentally noting which files are generated so they don't show up as "did I change something?" panic in future. The list for this project: `src/routeTree.gen.ts`. Anything else flagged as modified is genuinely modified.

---

### Issue M5 — Cross-origin sign-in on production

**Symptom:** Vercel deployment loaded, but sign-in via magic link redirected back to a URL Supabase didn't recognise.

**Cause:** Supabase's Auth → URL Configuration whitelists redirect URLs. The Vercel production URL hadn't been added.

**Fix:** Add `https://my-kitchen-helper.vercel.app/` to Supabase's allowed URL list.

**Implication:** Any future deployment URL — preview environments, custom domains — needs the same step. Worth a note in any deployment runbook.

---

## End state (smoke-tested and confirmed)

- **Database:** Supabase project in Mike's own account, `recipe_db_install_v2_post_f1.sql` schema installed, F1 and F2 grants applied (now rolled into `recipe_db_install_v3.sql` for any future clean install).
- **Code:** GitHub repo `miketaylor963-oss/my-kitchen-helper`, in sync with local clone at `~/dev/my-kitchen-helper`.
- **Local dev:** `npm run dev` on `http://localhost:8080/`, pointing at the new Supabase. Reads and writes confirmed working.
- **Production:** `https://my-kitchen-helper.vercel.app/`, auto-deploys from `main`. Sign-in working; reads and writes confirmed working.
- **Lovable:** out of the picture. The Lovable project still exists but is no longer the source of truth.
- **`app_writer` rows:** Mike's UUID (`f041b93c-7187-4920-a297-13b421b4c614`) inserted. Jane to be added once she's onboarded as part of the writer-management feature build.

---

## Carry-forward into F2

- Roll the F1 and F2 grant blocks into `recipe_db_install_v3.sql`. **Done.**
- Update project knowledge docs to reflect the new tooling and remove the Lovable framing. **Done** (`requirements_post_migration.md`, `planning_log_post_migration.md`, `lovable_project_knowledge_post_migration.md`).
- Decide production smoke-test cadence — manual check after every Vercel deploy, or trust local dev? Defer to F2 retro.
- Add a `note` column to `app_writer` when convenient. Flagged for the writer-management feature build.

F2 planning proper — slicing, Claude Code prompt patterns, the ingredient-master warm-up — starts in the next session.
