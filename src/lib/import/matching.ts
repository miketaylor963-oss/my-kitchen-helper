import { supabase } from "@/integrations/supabase/client";

export type MatchType = "exact_canonical" | "exact_alias" | "fuzzy_canonical" | "fuzzy_alias";

export type Candidate = {
  ingredient_id: number;
  canonical_name: string;
  matched_text: string;
  match_type: MatchType;
  similarity_score: number;
  category_id: number | null;
  dietary_category_id: number | null;
};

export type RowOutcome =
  | { kind: "exact"; candidate: Candidate }
  | { kind: "ambiguous"; candidates: Candidate[] }
  | { kind: "fuzzy"; candidates: Candidate[] }
  | { kind: "none" };

export type IngredientMatch = {
  row_id: string;
  row_name: string;
  outcome: RowOutcome;
};

export type MatchingResult = {
  rows: IngredientMatch[];
};

export type AdvisoryResult =
  | { kind: "fires"; declared: string; strictest_ingredient_name: string; strictest_category: string }
  | { kind: "silent"; reason: "not_all_resolved" | "missing_dietary_category_id" | "no_declared_category" | "consistent" };

export type ParsedRecipe = {
  dietary_category?: string | null;
  ingredients?: Array<{ id: string; name: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

type RawMatchRow = {
  ingredient_id: number;
  canonical_name: string;
  match_type: string;
  matched_text: string;
  similarity_score: number;
  category_id: number | null;
  dietary_category_id: number | null;
};

const MATCH_TYPE_PRECEDENCE: Record<string, number> = {
  exact_canonical: 0,
  exact_alias: 1,
  fuzzy_canonical: 2,
  fuzzy_alias: 3,
};

function resolveOutcome(rawRows: RawMatchRow[]): RowOutcome {
  if (rawRows.length === 0) return { kind: "none" };

  const exactIds = new Set(
    rawRows
      .filter((r) => r.match_type === "exact_canonical" || r.match_type === "exact_alias")
      .map((r) => r.ingredient_id),
  );

  // Drop fuzzy rows whose ingredient_id is already covered by an exact row
  const filtered = rawRows.filter((r) => {
    if (r.match_type === "fuzzy_canonical" || r.match_type === "fuzzy_alias") {
      return !exactIds.has(r.ingredient_id);
    }
    return true;
  });

  // Group by ingredient_id; keep highest-precedence match per ingredient
  const byIngredient = new Map<number, RawMatchRow>();
  for (const row of filtered) {
    const existing = byIngredient.get(row.ingredient_id);
    if (
      existing === undefined ||
      MATCH_TYPE_PRECEDENCE[row.match_type] < MATCH_TYPE_PRECEDENCE[existing.match_type]
    ) {
      byIngredient.set(row.ingredient_id, row);
    }
  }

  const deduped = [...byIngredient.values()];
  if (deduped.length === 0) return { kind: "none" };

  const toCandidate = (r: RawMatchRow): Candidate => ({
    ingredient_id: r.ingredient_id,
    canonical_name: r.canonical_name,
    matched_text: r.matched_text,
    match_type: r.match_type as MatchType,
    similarity_score: r.similarity_score,
    category_id: r.category_id,
    dietary_category_id: r.dietary_category_id,
  });

  const exactRows = deduped.filter(
    (r) => r.match_type === "exact_canonical" || r.match_type === "exact_alias",
  );
  if (exactRows.length === 1) return { kind: "exact", candidate: toCandidate(exactRows[0]) };
  if (exactRows.length > 1) return { kind: "ambiguous", candidates: exactRows.map(toCandidate) };

  const fuzzyRows = [...deduped].sort((a, b) => {
    if (b.similarity_score !== a.similarity_score) return b.similarity_score - a.similarity_score;
    return a.canonical_name.localeCompare(b.canonical_name);
  });
  return { kind: "fuzzy", candidates: fuzzyRows.map(toCandidate) };
}

export async function matchIngredients(data: unknown): Promise<MatchingResult> {
  const doc = data as Record<string, unknown>;
  const ingredients = (doc.ingredients as Array<Record<string, unknown>>) ?? [];

  const rows = await Promise.all(
    ingredients.map(async (ing) => {
      const row_id = ing.id as string;
      const row_name = ing.name as string;

      // supabase.rpc types only include generated functions; match_ingredient is custom
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawRows, error } = await (supabase.rpc as any)("match_ingredient", {
        query_name: row_name,
      });

      if (error) throw new Error(error.message);

      const outcome = resolveOutcome((rawRows ?? []) as RawMatchRow[]);
      return { row_id, row_name, outcome } satisfies IngredientMatch;
    }),
  );

  return { rows };
}

// dietaryCategoryRanks: code → rank ('vegan' → 1, 'meat' → 4)
// dietaryCategoryCodeById: dietary_category.id → code
// Both are needed because the Candidate carries dietary_category_id (integer)
// while the declared category is a code string.
export function evaluateConsistencyAdvisory(
  parsed: ParsedRecipe,
  matching: MatchingResult,
  dietaryCategoryRanks: Map<string, number>,
  dietaryCategoryCodeById: Map<number, string>,
): AdvisoryResult {
  const declared = typeof parsed.dietary_category === "string" ? parsed.dietary_category : null;
  if (!declared) return { kind: "silent", reason: "no_declared_category" };

  const declaredRank = dietaryCategoryRanks.get(declared);
  if (declaredRank === undefined) return { kind: "silent", reason: "no_declared_category" };

  const allExact = matching.rows.every((r) => r.outcome.kind === "exact");
  if (!allExact) return { kind: "silent", reason: "not_all_resolved" };

  let strictestRank = -1;
  let strictestIngredientName = "";
  let strictestCode = "";

  for (const match of matching.rows) {
    if (match.outcome.kind !== "exact") throw new Error("unreachable");
    const dcId = match.outcome.candidate.dietary_category_id;
    if (dcId === null) return { kind: "silent", reason: "missing_dietary_category_id" };
    const code = dietaryCategoryCodeById.get(dcId);
    if (!code) return { kind: "silent", reason: "missing_dietary_category_id" };
    const rank = dietaryCategoryRanks.get(code);
    if (rank === undefined) return { kind: "silent", reason: "missing_dietary_category_id" };
    if (rank > strictestRank) {
      strictestRank = rank;
      strictestIngredientName = match.row_name;
      strictestCode = code;
    }
  }

  if (strictestRank === -1) return { kind: "silent", reason: "missing_dietary_category_id" };
  if (declaredRank >= strictestRank) return { kind: "silent", reason: "consistent" };

  return {
    kind: "fires",
    declared,
    strictest_ingredient_name: strictestIngredientName,
    strictest_category: strictestCode,
  };
}
