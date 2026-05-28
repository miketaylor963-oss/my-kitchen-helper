# Edge-case fixtures — expected validator outcomes

Synthesised during Pre-2B.1 to exercise the import validator's edges. Each row states the expected outcome when run through 2B.1's validator. "Reject" fixtures are negative tests — they must fail, and for the stated reason.

| Fixture | Expected | Reason |
|---|---|---|
| no-groups | pass | all groups null, valid |
| many-groups-mixed | pass | dense + mixed-null groups, valid |
| max-placeholder-density | pass | 32 placeholder instances all resolve |
| min-placeholder-density | pass | zero placeholders; convention-violating but valid |
| multiple-meal-types-formats | pass | max classification breadth |
| derived-covers-full-recipe | pass | full-coverage derivation explicitly allowed |
| derived-non-contiguous-steps | pass | non-contiguous step_indices [0,3,5] |
| minimal-component | pass | required-only component floor |
| component-multi-framework | pass | three seeded frameworks |
| classification-boundaries | pass | nulls/empties/single-item arrays |
| all-macros-populated | pass | all macro fields set |
| minimal-recipe | pass | optional keys omitted; lenient rule |
| all-amounts-null | pass | every amount null |
| placeholder-parsing-edges | pass | near-misses literal; real refs resolve |
| step-group-not-in-ingredient-groups | pass | step-only groups allowed |
| empty-string-vs-null | pass | "" coerced to null on freeform fields |
| single-char-external-ref | pass | no minimum slug length |
| advisory-consistency-trip | pass (advisory) | imports, but raises non-blocking consistency warning |
| derived-unsorted-duplicated-step-indices | reject | duplicate step_indices (1 appears twice) |
| nonstandard-ingredient-ids | reject | ids don't match ^[0-9]{4}$ |
| derived-slug-collides-with-parent | reject | derived external_ref equals parent's |
| empty-ingredients-array | reject | empty ingredients array |
| empty-steps-array | reject | empty steps array |
| derived-empty-arrays | reject | derived ingredient_ids and step_indices empty |
