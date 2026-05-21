# Planning Log

A record of decisions, revisions, and issues across the life of the project. Covers tool choice, domain modelling, the schema v1/v2 work, the F1 build's tooling lessons, the cutover from Lovable to local Claude Code + Vercel, and F2 planning.

Format mirrors the feature build log: decisions and issues each get an entry with the problem (or decision), what was chosen, and any implication for future work. Stages are ordered roughly chronologically. Earlier stages are preserved as written — decisions later overtaken by events are flagged with a `[Superseded]` line rather than rewritten.

---

[Stages 1 through 6 carry forward unchanged from `planning_log_post_migration.md`. The text below covers Stage 7 — F2 planning — and amendments to the carry-forward list at the foot of that file.]

---

## Stage 7 — F2 planning

F1 (Meal Library) shipped from Lovable, then the codebase migrated to local Claude Code + Vercel + self-owned Supabase (Stage 6). F2 planning started against the clean post-migration state.

The four open items from "Carry-forward into F2" framed the agenda. Three resolved cleanly; one (Claude Code prompt patterns) was explicitly deferred until 2A is underway.

### Decision 17 — Ingredient-master warm-up done in chat before any 2A code

**Context:** v3's seeded ingredient list was 55 entries — drawn entirely from the four example recipes already converted (houmous, shepherd's pie, butter bean loaf, black bean patties). The breakfast/lunch/dinner source docs name a much wider vocabulary that the warm-up was always meant to cover.

**Choice:** Work through the gaps category by category in chat, confirming canonical names, default units, dietary categories, aliases. No app UI involved — pure hand work between Mike and Claude, then output as SQL.

**Output:** 227 canonical ingredients + 26 aliases, up from 55 + 4. Two SQL files produced:
- `recipe_db_install_v3_ingredients_warmup.sql` — additive, safe to run against the live v3 database (every insert is `ON CONFLICT DO NOTHING`).
- `recipe_db_install_v3_1.sql` — full canonical install script for from-scratch installs, with the warm-up folded into Section 12 in place.

**Reasoning:** First-import auto-match rate goes up sharply when the canonical vocabulary already covers the household's actual eating patterns. The cost is one chat session; the alternative is the importer's create-new flow firing on ~80% of lines during the first dozen imports.

**Implication:** v3.1 supersedes v3 as the canonical install script. v3 stays in archive for lineage. The schema is unchanged between v3 and v3.1 — only Section 12 seed content differs.

---

### Decision 18 — F2 split into three slices, not two

**Context:** Original plan was two slices: ingredient master + importer combined (2A), then deferred items (2B). Standalone ingredient master CRUD was treated as an inline component of the importer.

**Revised choice:** Three slices.
- **Slice 2A: Standalone ingredient master CRUD page.** Browse, search, filter by category/dietary, view detail, edit, add, alias management, prevent-delete-if-referenced.
- **Slice 2B: Recipe importer.** Paste → validate against contract → match → preview → commit. Reuses Slice 2A's patterns. Recipe-only at this stage; components defer to F3.
- **Slice 2C: Deferred items.** Re-import handling, derived components from recipes, anything surfaced during 2B that wasn't worth blocking on.

**Reasoning:** Slice 2A first means (a) the operator can tidy the 227-row warm-up vocabulary before any importer code runs against it, (b) the importer's "create new ingredient" branch becomes a reuse of an existing CRUD pattern rather than bespoke inline code that gets thrown away later, (c) the vertical slice is genuinely simpler — one entity, no parser, no contract validation, no matching algorithm.

**Implication:** F2 is bigger than originally scoped but lands in three smaller pieces rather than two large ones. Slice 2A is the cleanest possible "first feature on the new stack" — single table, no integration with other features, demonstrably useful on its own.

---

### Decision 19 — Recipes only for F2; components wait for F3

**Decision:** Slice 2B targets `import_type: "recipe"` only. The importer's `import_type: "component"` branch stays unimplemented until F3.

**Reasoning:** Components carry more complexity (registration against framework layers, families, the question of "is this component a meal in its own right"). The composition builder is the natural home for that complexity. Mixing it into F2 inflates scope without a corresponding payoff — recipes are what the household actually cooks day-to-day, and getting them in the library is the higher-leverage F2 outcome.

**Implication:** The JSON import contract stays component-aware (the spec retains the `import_type` field and the component-shape fields). The importer ignores those paths for now. F3 picks them up when components land.

---

### Decision 20 — Content milestone defines "F2 done"

**Decision:** F2 is complete when:
1. All four hand-converted JSONs (houmous, shepherd's pie, butter bean loaf, black bean patties) land cleanly in the library.
2. A set of synthesised edge-case JSONs (no `timer_seconds`, no `notes`, ingredient groups, single-serving, large-batch, 20+ ingredients, unicode in names, etc) all land cleanly.
3. Five web-sourced recipes — sourced as PDFs by Mike, converted to JSON by Claude in a fresh chat — land cleanly.

**Reasoning:** A technical milestone ("the pipeline works") would let a fragile importer pass. The content milestone forces variety: pre-cleaned templates work, synthesised edge cases test the contract's robustness, web-sourced PDFs test the conversion step *and* exercise the matching UI against vocabulary the warm-up didn't seed.

**Two failure modes that come out of the content milestone:**
- *Conversion fails or fudges.* The PDF-to-JSON step (a Claude chat) produces output that doesn't match the template — wrong field names, missing required fields, unresolvable `ingredient_id` references. Signals the template needs clearer guidance or better examples.
- *Conversion succeeds, importer struggles.* Template-valid JSON lands but the matching UI shows lots of red. Signals the importer UX needs work, or warm-up vocabulary gaps.

Both signals are useful; worth logging which one fires when running the test set.

**Implication:** Slice 2A and Slice 2B both have their own "done" definitions:
- *2A done:* CRUD page in production, 227 seeded ingredients browseable, edit/add/alias work end-to-end, prevent-delete-if-referenced enforced.
- *2B done:* the three-source test set above all land.

---

### Decision 21 — Soft delete vs hard delete: prevent delete if referenced

**Context:** Once a recipe references an ingredient via `meal_ingredient.ingredient_id`, deleting that ingredient orphans the reference. Options were prevent (cleanest, most annoying), soft delete with an `is_archived` flag (most flexible), cascade delete (dangerous).

**Choice:** Prevent deletion if referenced. Database-level enforcement via the existing FK constraint; UI surfaces the constraint as a clean error rather than letting the operator try.

**Reasoning:** Soft delete adds a state machine (active/archived) that propagates into every query, search, and shopping-list aggregation. Cascade delete is unsafe. Prevent-if-referenced is the simplest enforceable rule and matches the actual workflow — if you genuinely need to remove a referenced ingredient, you go and clean up the references first.

**Implication:** Slice 2A delete UI shows a clear "in use by N recipes, cannot delete" message when the constraint blocks. Optional follow-up (slice 2C or later): a UI affordance to list the referencing recipes so the operator can decide what to do.

---

### Decision 22 — Merge operation deferred, requirements doc to be updated

**Context:** Two ingredients that should be one ("salt" vs "fine salt", "tomato puree" vs "tomato purée") will eventually appear. The fix is a merge — move all `meal_ingredient.ingredient_id` references from source to target, move all aliases, delete the source.

**Choice:** Defer. Genuinely complicated (transactional, audit-trail-relevant, irreversible) and not blocking for F2. Until merge exists, the only recovery for duplicates is prevention at create-time.

**Implication:** Add to the requirements deferred-items list at F2 close-out. Worth surfacing now so it isn't quietly forgotten.

---

### Decision 23 — JSON conversion happens in fresh chats per stage

**Decision:** PDF → JSON conversion for the web-sourced test recipes happens in a *fresh* chat, not in the chat that builds the importer. Similarly for any other stage that wants AI-assisted work (between 2A and 2B for the conversion pass; during 2B for actual importer build).

**Reasoning:** A fresh Claude with no warm template context tests the conversion path more honestly than this chat, which has been steeped in template details for hours. The point of the test is "what does the AI converter actually produce when it doesn't already know the template inside-out" — that requires a Claude that has to read the spec from the project knowledge / repo, not one that wrote it.

**Implication:** Fresh chats per stage become a habit, not a one-off. Each new chat starts by loading the standing brief + requirements from the GitHub repo (per Decision 25). Less risk of context drift across long sessions, and a cleaner test of whether the project's standing instructions are actually sufficient.

---

### Decision 24 — Web-sourced test recipes target shape variety, not volume

**Decision:** Aim for five web-sourced PDFs deliberately chosen for shape difference. Suggested mix:
- One short recipe (under 8 ingredients, 3–4 steps).
- One long recipe (15+ ingredients, multiple groups).
- One with sub-recipes ("for the marinade…", "for the sauce…").
- One non-British / non-Mediterranean (Korean or Indian — stresses ingredient vocabulary).
- One baking recipe (different unit conventions, weight-precise).

**Reasoning:** Five PDFs chosen for difference beats fifteen of the same shape. The point of the web-sourced set is to stress shapes the four existing JSONs don't already test.

**Implication:** Cookbook-style PDFs produce cleaner conversions than blog-style PDFs (blog recipes carry pre-recipe noise: 2000-word backstory, "Jump to Recipe" anchors, comments). Both are useful inputs — the blog-style ones additionally test conversion robustness against noisy source material.

---

### Decision 25 — GitHub as source-of-truth for project artefacts; folder structure replaces filename suffixes

**Context:** Claude.ai project knowledge is a flat file list — no subfolder support. After F1 and the migration, project knowledge had 27 files at root with `_post_f1` / `_post_migration` / `_v2` / `_v3` suffixes encoding lineage in filenames. The pattern has worked but degrades as features accumulate.

**Options considered:**
- **Continue with filename-suffix versioning.** Defensible — has worked through six stages. But suffix soup grows fastest exactly when context-switching is most expensive (start of a new feature, new chat).
- **Use GitHub as source-of-truth for the artefacts, alongside the existing GitHub-hosted app code.**

**Choice:** GitHub. Public repo. App code and planning artefacts share one source of truth.

**Folder structure:**
```
/
├── current/            ← active source-of-truth files
│   ├── standing_brief.md
│   ├── requirements.md
│   ├── recipe_db_install.sql (currently v3.1)
│   ├── recipe_import_spec.md
│   └── recipe_import_template.json
├── source_recipes/     ← docx source material for the library
├── library_recipes/    ← hand-converted JSONs for production import
├── test_fixtures/
│   ├── edge_cases/     ← synthesised JSONs for Slice 2B testing
│   └── web_sourced/    ← PDFs + converted JSONs
└── archive/            ← superseded versions, kept for lineage
```

**Loading mechanism:** A line in project instructions points fresh chats at the repo and asks for `web_fetch` against the raw URLs of `current/standing_brief.md` and `current/requirements.md` at chat start. Other files fetched as needed.

**Reasoning:** Real folders, real diffs (git log on `recipe_db_install.sql` replaces the v1/v2/v3 filename chain), one place for everything, fresh chats load cleanly via a one-line instruction rather than navigating suffix soup.

**Implication:**
- v3.1 becomes `current/recipe_db_install.sql`; v3 moves to archive.
- `lovable_project_knowledge_post_migration.md` becomes `current/standing_brief.md` (Lovable-free name for a Lovable-free document).
- `requirements_post_migration.md` becomes `current/requirements.md`.
- Older versions retain their suffix-laden names in `archive/` — names carry timeline information that renaming to v1/v2/v3 would lose.
- The warm-up SQL (`recipe_db_install_v3_ingredients_warmup.sql`) moves to archive once the live database has been brought to v3.1 state — it's served its purpose.
- GitHub repo setup happens as a standalone short chat between this one and Slice 2A. Slice 2A starts fresh against the clean structure.

---

### Decision 26 — Slice-done checklist in project instructions

**Decision:** A four-item checklist for "slice done" goes into project instructions, applying across all chats in the project.

**The checklist:**
1. Code shipped to production (Vercel deploy completes, manual smoke-test passes).
2. Slice's specific demo runs cleanly (e.g. for 2A: all 227 ingredients browseable; for 2B: the full test set lands).
3. Build log updated with decisions and issues from the slice.
4. Standing brief updated if anything material changed.

**Reasoning:** Item 4 is the one most easily skipped and most expensive to skip — silent drift between the brief and reality is what made the suffix-soup project-knowledge state worse over time. Forcing an explicit check at slice-end is the cheapest preventive measure.

**Implication:** Project instructions take one update at GitHub-setup time covering: the repo URL + load-on-startup line (Decision 25), the slice-done checklist (this decision), and a light version of the Claude Code prompt discipline (one-paragraph, refined later — see Decision 27).

---

### Decision 27 — Claude Code prompt patterns: defer and discover during 2A

**Context:** F1's `feature_01_meal_library_prompts.md` emerged from doing F1, not from planning it — patterns crystallised after running into things that didn't work. Pre-writing equivalent patterns for Claude Code carries the same risk inverted: planning patterns before knowing what fails.

**Choice:** Start 2A with a light one-paragraph standing-brief note on prompt discipline ("narrow scope, commit per working chunk, surface schema-touching questions, don't act on them") and let proper patterns emerge from actual 2A work. Write them up properly at 2A close-out when there's real material to draw on.

**Reasoning:** Defer-and-discover beats plan-and-hope when the tooling specifics aren't yet familiar. Claude Code is different enough from Lovable that pre-writing patterns risks being wrong in ways that can't be predicted from outside.

**Implication:** Light prompt-discipline paragraph goes into project instructions at GitHub-setup time. Full prompt-pattern document gets written at the F2 close-out as part of the Slice 2A build log retro.

---

### Decision 28 — Process commitments: smoke-test cadence and log continuity

**Decision:** Three small process commitments going into Slice 2A:
- **Smoke-test cadence.** Manual click-through in the deployed Vercel app after every deploy. Five minutes per deploy. Lightweight, but explicit — the question "did the thing I built actually reach production" gets a deliberate answer rather than an assumed one.
- **Build logs and planning logs continue.** Same format as F1 (`build_log_post_f1.md` as template). One planning log per feature, one build log per feature. Both live in `current/` alongside the standing brief and requirements.
- **Slice-done checklist enforced** (per Decision 26).

**Reasoning:** None of these is a new idea. The point of writing them down is so they're not quietly skipped during a busy build.

**Implication:** Nothing new to build; just commitments to keep.

---

## Carry-forward into Slice 2A

Open items going into Slice 2A:

- GitHub repo setup as a standalone short chat: create repo, structure folders (per Decision 25), upload existing artefacts into them, push v3.1 as `current/recipe_db_install.sql`, archive v3 and the warm-up add-on.
- Update project instructions: repo URL + load-on-startup line, slice-done checklist, light prompt-discipline paragraph.
- Slice 2A scope confirmed: browse / search / filter / view / edit / add / alias management / prevent-delete-if-referenced. Explicitly out: merge, soft delete, bulk operations, audit trail.

## Carry-forward to F2 close-out

Items flagged for capture when F2 is done:

- Add **merge operation** to the requirements deferred-items list (per Decision 22).
- Add **soft-delete / archive flag** consideration to the requirements deferred-items list — only relevant if prevent-delete-if-referenced becomes annoying in practice.
- Add **bulk operations on ingredients** (bulk edit, bulk re-categorise) to the deferred-items list.
- Write the **full Claude Code prompt patterns document** as the F2 close-out artefact, replacing the light paragraph in project instructions with a proper feature-prompts file (mirroring F1's `feature_01_meal_library_prompts_post_f1.md`).
- **Update the standing brief and requirements** to reflect the F2 ingredient master and recipe importer as built — including any decisions taken during 2A and 2B that don't appear here.
- **Move the warm-up add-on SQL to archive** once the live database is on v3.1 state.
