# Enhancements

Deferred ideas that aren't bugs, aren't in current scope, and aren't tied
to a specific upcoming slice. Logged here so they're not forgotten and
so they don't clutter the planning log's carry-forward block.

Each entry is reviewed at feature close-out. Items either:
- Get pulled into a slice (move to planning log under that slice)
- Get rejected (move to an "abandoned" section with a reason)
- Stay deferred (remain here)

---

## Auth and navigation

### Magic-link return path
Currently, magic-link sign-in returns the user to home regardless of
the page that initiated sign-in. Bookmarking a writer-gated page,
clicking it while signed out, signing in, and being returned to home
is a real friction point — but currently only theoretical, because the
only writer-gated pages are all gated at the page boundary and most
operators sign in once and stay signed in.

Becomes worth fixing when: a real user reports it, or a writer-gated
page becomes one a user is likely to deep-link to.

Mechanism: Supabase `emailRedirectTo` parameter on the sign-in call,
plus a callback handler that respects the return URL.

Originally raised: 2B.3 smoke (planning log finding).

### Pre-auth state preservation
Currently, if a page somehow ends up doing meaningful work before an
auth gate, that state is lost across magic-link sign-in. The 2B.3
slice surfaced this on the import page, then resolved it by moving the
auth gate to the page boundary so no pre-auth work is possible. Pattern
codified in the standing brief.

Becomes worth building when: a future feature genuinely needs pre-auth
interaction. Until then, the rule is "gate at the page boundary".

---

## User experience

### Help / in-app guidance
Non-writers (e.g. Jane) won't see writer-only pages in the menu, so
won't know what's possible. Currently the only documentation is the
project's GitHub repo, which isn't aimed at users. In-app help —
contextual or a separate help page — would let non-writers discover
what writers can do without needing access themselves.

Becomes worth building when: there are non-writer users who would
benefit, and they ask. Currently only Mike and Jane; Jane can be
told things directly.

Originally raised: 2B.3 close-out discussion.

---

## Import / matching

### Prep-adjective stripping in ingredient matching
Many fuzzy matches in real fixtures are driven by prep-related modifiers
attached to the ingredient name — `garlic cloves, minced`, `large onion,
finely diced`, `mushrooms, roughly chopped`, `lemon, juiced`. Stripped
of the modifier, these would land as exact matches against the existing
master vocabulary. The (b2) sweep produced ~50–60% fuzzy bucketing across
130 ingredients; a large fraction of that is the prep-adjective pattern.

The catch: not all modifiers are strippable. `dried`, `fresh`, `tinned`,
`ground`, `whole` are canonical name fragments in this master
(`dried oregano`, `fresh basil`, `tinned tomatoes`, `ground cumin`,
`whole milk`). A blunt strip-list would break those.

Becomes worth building when: F2C, before re-import work. Re-import reruns
matching, so this lands cheaply alongside it and saves disambiguation
clicks on every re-imported fixture. Threshold tuning (Decision-46 carry-
forward) interacts: prep-stripping moves the easy wins into the exact
bucket, so the residual fuzzy bucket becomes the genuinely ambiguous
cases — threshold may look different against that residual.

Mechanism: in `src/lib/import/matching.ts`, generate variants of each
ingredient name (original / strip trailing comma-clause / strip leading
size adjective / strip both) and run `match_ingredient` against each in
parallel. Prefer the best outcome (exact on any variant → fuzzy-high →
fuzzy-low → none). If exact lands on a stripped variant, render the row
in the exact bucket with an annotation showing what got stripped; the
existing override combobox handles "this isn't right".

The strip-list is a curated config — a small versioned vocabulary of
prep verbs (`chopped`, `minced`, `sliced`, `diced`, `drained`, `rinsed`,
`grated`, `crushed`, `juiced`, `peeled`, `halved`, `quartered`, `torn`,
`shredded`, `mashed`, `beaten`, `softened`, `washed`), modifying adverbs
(`finely`, `roughly`, `thinly`, `coarsely`, `lightly`), and size
adjectives (`large`, `medium`, `small`). Lives alongside the alias table
conceptually — both are matching-vocabulary configuration. Expected to
evolve as new fixtures expose new modifier patterns.

Worst case: variant lookups all miss and the row falls through to today's
fuzzy bucket. No regression possible.

Originally raised: (b2) milestone close-out, 2026-05-30.

---

## Tooling

### Supabase `gen:types` workflow

Two RPC functions (`match_ingredient`, `commit_import`) are not in the generated types and are accessed via `(supabase.rpc as any)(…)` with eslint-disable directives at the call sites. The pattern works but means every new custom RPC adds another cast site. Setting up `supabase gen types typescript` as an npm script (requires the Supabase CLI as a devDependency, project ref in config) regenerates the types and removes the casts.

Becomes worth building when: a third custom RPC is added (F2C re-import or F3 component import are likely candidates), or a typed RPC return surface would catch a real bug. Until then the cast pattern is the convention.

Originally raised: F2 close-out, 2026-05-30.