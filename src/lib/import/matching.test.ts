import { describe, it, expect } from "vitest";
import { evaluateConsistencyAdvisory, generateVariants } from "./matching";
import type { MatchingResult, ParsedRecipe } from "./matching";
import { getStripList } from "./strip_list";

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

const stripList = getStripList();

describe("generateVariants", () => {
  // Step 1 — trailing clause extension (connectives, prepositions, cut_descriptors, dimensions)

  it("strips 'drained and rinsed' via connective 'and'", () => {
    expect(generateVariants("black beans, drained and rinsed", stripList)).toContain("black beans");
  });

  it("strips 'peeled and chunked' via connective 'and' and new prep verb 'chunked'", () => {
    expect(generateVariants("sweet potatoes, peeled and chunked", stripList)).toContain("sweet potatoes");
  });

  it("strips 'cut into 1.5cm dice' via prep verb, preposition, dimension, and cut descriptor", () => {
    expect(generateVariants("courgettes, cut into 1.5cm dice", stripList)).toContain("courgettes");
  });

  it("strips 'cut into diagonal slices' via prep verb, preposition, and cut descriptors", () => {
    expect(generateVariants("carrot, cut into diagonal slices", stripList)).toContain("carrot");
  });

  it("does NOT strip 'rind grated and juiced' — 'rind' is a food-part noun, not a prep token", () => {
    expect(generateVariants("lemons, rind grated and juiced", stripList)).not.toContain("lemons");
  });

  it("does NOT strip 'whites sliced on the diagonal' — 'whites' is a food-part noun", () => {
    expect(generateVariants("spring onions, whites sliced on the diagonal", stripList)).not.toContain("spring onions");
  });

  // Step 2 — pluralisation (toSingular applied to each variant)

  it("generates singular 'garlic clove' from stripped 'garlic cloves'", () => {
    expect(generateVariants("garlic cloves", stripList)).toContain("garlic clove");
  });

  it("generates singular 'egg' from 'eggs, beaten' via strip then de-pluralise", () => {
    const variants = generateVariants("eggs, beaten", stripList);
    expect(variants).toContain("eggs");
    expect(variants).toContain("egg");
  });

  it("generates 'sweet potato' from 'sweet potatoes, peeled and chunked' via Step 1 strip then oes→o rule", () => {
    expect(generateVariants("sweet potatoes, peeled and chunked", stripList)).toContain("sweet potato");
  });

  it("does NOT generate 'classic houmou' — houmous ends in -us, excluded from s-strip", () => {
    expect(generateVariants("classic houmous", stripList)).not.toContain("classic houmou");
  });

  // Step 3 — quality qualifier leading strip

  it("strips 'free-range' leading qualifier to produce 'eggs' and then 'egg'", () => {
    const variants = generateVariants("free-range eggs", stripList);
    expect(variants).toContain("eggs");
    expect(variants).toContain("egg");
  });

  // Regression — existing behaviour must be preserved

  it("still strips trailing prep clause: 'garlic clove, peeled' → 'garlic clove'", () => {
    const variants = generateVariants("garlic clove, peeled", stripList);
    expect(variants).toContain("garlic clove");
    expect(variants).not.toContain("garlic clov"); // no false singular on a non-plural word
  });

  it("still strips trailing prep clause: 'lemon, juiced' → 'lemon'", () => {
    expect(generateVariants("lemon, juiced", stripList)).toContain("lemon");
  });

  it("still strips leading size adjective: 'large onion' → 'onion'", () => {
    expect(generateVariants("large onion", stripList)).toContain("onion");
  });
});

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
