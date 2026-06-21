import { describe, it, expect } from "vitest";
import { evaluateConsistencyAdvisory } from "./matching";
import type { MatchingResult, ParsedRecipe } from "./matching";

const ranks = new Map([
  ["vegan", 1],
  ["vegetarian", 2],
  ["pescatarian", 3],
  ["meat", 4],
]);
const codeById = new Map([
  [1, "vegan"],
  [2, "vegetarian"],
  [3, "pescatarian"],
  [4, "meat"],
]);

function exactRow(name: string, dcId: number | null): MatchingResult["rows"][0] {
  return {
    row_id: name,
    row_name: name,
    outcome: {
      kind: "exact",
      candidate: {
        ingredient_id: 1,
        canonical_name: name,
        matched_text: name,
        match_type: "exact_canonical",
        similarity_score: 1,
        category_id: null,
        dietary_category_id: dcId,
      },
    },
  };
}

function fuzzyRow(name: string, dcId: number | null): MatchingResult["rows"][0] {
  return {
    row_id: name,
    row_name: name,
    outcome: {
      kind: "fuzzy",
      candidates: [
        {
          ingredient_id: 1,
          canonical_name: name,
          matched_text: name,
          match_type: "fuzzy_canonical",
          similarity_score: 0.5,
          category_id: null,
          dietary_category_id: dcId,
        },
      ],
    },
  };
}

function ambiguousRow(name: string): MatchingResult["rows"][0] {
  return {
    row_id: name,
    row_name: name,
    outcome: {
      kind: "ambiguous",
      candidates: [
        {
          ingredient_id: 1,
          canonical_name: "candidate a",
          matched_text: name,
          match_type: "exact_canonical",
          similarity_score: 1,
          category_id: null,
          dietary_category_id: 1,
        },
        {
          ingredient_id: 2,
          canonical_name: "candidate b",
          matched_text: name,
          match_type: "exact_alias",
          similarity_score: 1,
          category_id: null,
          dietary_category_id: 4,
        },
      ],
    },
  };
}

function noneRow(name: string): MatchingResult["rows"][0] {
  return { row_id: name, row_name: name, outcome: { kind: "none" } };
}

function parsed(category: string): ParsedRecipe {
  return { dietary_category: category };
}

describe("evaluateConsistencyAdvisory", () => {
  it("fires on all-exact rows when a conflict exists (regression)", () => {
    const result = evaluateConsistencyAdvisory(
      parsed("vegan"),
      { rows: [exactRow("olive oil", 1), exactRow("chicken breast", 4)] },
      ranks,
      codeById,
    );
    expect(result).toEqual({
      kind: "fires",
      declared: "vegan",
      strictest_ingredient_name: "chicken breast",
      strictest_category: "meat",
    });
  });

  it("fires when the top fuzzy candidate introduces a conflict", () => {
    const result = evaluateConsistencyAdvisory(
      parsed("vegan"),
      { rows: [exactRow("olive oil", 1), fuzzyRow("bacon lardons", 4)] },
      ranks,
      codeById,
    );
    expect(result).toEqual({
      kind: "fires",
      declared: "vegan",
      strictest_ingredient_name: "bacon lardons",
      strictest_category: "meat",
    });
  });

  it("skips ambiguous rows and evaluates remaining rows", () => {
    const result = evaluateConsistencyAdvisory(
      parsed("vegan"),
      { rows: [ambiguousRow("mystery ingredient"), exactRow("chicken breast", 4)] },
      ranks,
      codeById,
    );
    expect(result).toEqual({
      kind: "fires",
      declared: "vegan",
      strictest_ingredient_name: "chicken breast",
      strictest_category: "meat",
    });
  });

  it("returns no_resolved_rows when all rows are none or ambiguous", () => {
    const result = evaluateConsistencyAdvisory(
      parsed("vegan"),
      { rows: [noneRow("unknown thing"), ambiguousRow("ambiguous thing")] },
      ranks,
      codeById,
    );
    expect(result).toEqual({ kind: "silent", reason: "no_resolved_rows" });
  });
});
