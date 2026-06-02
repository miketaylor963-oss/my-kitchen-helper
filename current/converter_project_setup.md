# Converter Project — Setup Notes

A dedicated Claude project for recipe development and PDF-to-JSON conversion. Set up via the Claude UI (operator-side; not managed by Claude Code).

## Standing inputs

Add these files to the project's knowledge base:

1. `current/converter_prompt.md` — paste as the project's system prompt (or add as a knowledge file and reference it in the system prompt).
2. `current/recipe_import_spec.md` — the full import specification, including all conventions.
3. `current/recipe_import_template.json` — the JSON template the converter outputs against.

## How to use the project

**Fresh recipe development (interactive mode):** start a new chat in the project, say "interactive mode", paste the source recipe content, and work through it with the converter. The converter will pause at ambiguities and ask for decisions.

**Re-conversion of an existing fixture (batch mode):** start a new chat in the project, say "batch mode", paste the source recipe content, and include the existing `external_ref` slug. Example opening:

> Batch mode. Convert the following recipe. The existing `external_ref` is `aubergine-parmigiana-cloake` — use it verbatim.
> [paste source]

The converter will produce the JSON and a `_fixture_notes` section with all judgement calls. Review the notes before importing.

**Mode toggle.** Say "batch mode" or "interactive mode" in the first message of each chat to set the mode. If you don't specify, the converter defaults to batch mode.

## Notes

- The project setup is operator-side and is not tracked by Claude Code.
- When the spec is updated (new conventions, amended rules), update the knowledge file in the project manually.
- `_fixture_notes` in the output JSON are ignored by the validator — they're for operator review, not for import.
- After conversion, import the fixture through the normal app import flow (`/admin/import`).
