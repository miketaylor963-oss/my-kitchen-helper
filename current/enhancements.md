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