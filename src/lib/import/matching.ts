import { supabase } from "@/integrations/supabase/client";
import { getStripList, type StripList } from "./strip_list";

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
  matched_variant?: string;
};

export type MatchingResult = {
  rows: IngredientMatch[];
};

export type AdvisoryResult =
  | { kind: "fires"; declared: string; strictest_ingredient_name: string; strictest_category: string }
  | { kind: "silent"; reason: "not_all_resolved" | "no_resolved_rows" | "missing_dietary_category_id" | "no_declared_category" | "consistent" };

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

// Produces a de-pluralised variant by stripping trailing 's'/'oes' from the last word.
// Returns null when the last word has no recognisable plural suffix.
function toSingular(name: string): string | null {
  const words = name.split(" ");
  const last = words[words.length - 1].toLowerCase();
  let singularLast: string | null = null;
  if (last.endsWith("oes") && last.length > 3) {
    singularLast = last.slice(0, -2); // potatoes → potato, tomatoes → tomato
  } else if (last.endsWith("s") && !last.endsWith("ss") && !last.endsWith("us") && last.length > 2) {
    singularLast = last.slice(0, -1); // cloves → clove, stalks → stalk, eggs → egg
    // excludes "-us"/"-ous" endings (houmous, couscous, asparagus) which are not English plurals
  }
  if (singularLast === null) return null;
  return [...words.slice(0, -1), singularLast].join(" ");
}

export function generateVariants(name: string, stripList: StripList): string[] {
  const variants: string[] = [name];
  // allPrep: tokens that anchor a strip — at least one must be present in a trailing clause
  const allPrep = new Set([...stripList.prep_verbs, ...stripList.modifying_adverbs]);
  // allAllowed: all tokens that don't block a strip
  const allAllowed = new Set([
    ...allPrep,
    ...stripList.connectives,
    ...stripList.prepositions,
    ...stripList.cut_descriptors,
  ]);
  // Dimension tokens such as "1.5cm", "500g" are allowed but not added to allAllowed as literals
  const isDimension = (t: string) => /^\d+(\.\d+)?(cm|mm|g|kg|ml|l|inch|inches)$/i.test(t);

  // Strip trailing comma-clause when every token is in allAllowed or is a dimension,
  // and at least one token is an allPrep anchor
  const commaIdx = name.indexOf(", ");
  let strippedTrailing: string | null = null;
  if (commaIdx !== -1) {
    const clause = name.slice(commaIdx + 2).trim();
    const tokens = clause.toLowerCase().split(/\s+/).filter(Boolean);
    if (
      tokens.length > 0 &&
      tokens.some((t) => allPrep.has(t)) &&
      tokens.every((t) => allAllowed.has(t) || isDimension(t))
    ) {
      strippedTrailing = name.slice(0, commaIdx);
    }
  }

  // Strip leading size adjective or quality qualifier: "large onion" → "onion", "free-range eggs" → "eggs"
  const firstSpace = name.indexOf(" ");
  let strippedLeading: string | null = null;
  if (firstSpace !== -1) {
    const firstWord = name.slice(0, firstSpace).toLowerCase();
    if (stripList.size_adjectives.includes(firstWord) || stripList.quality_qualifiers.includes(firstWord)) {
      strippedLeading = name.slice(firstSpace + 1);
    }
  }

  if (strippedTrailing !== null) variants.push(strippedTrailing);
  if (strippedLeading !== null) variants.push(strippedLeading);

  // Strip both: apply leading strip to the trailing-stripped result
  if (strippedTrailing !== null && strippedLeading !== null) {
    const trailingFirstSpace = strippedTrailing.indexOf(" ");
    if (trailingFirstSpace !== -1) {
      const trailingFirstWord = strippedTrailing.slice(0, trailingFirstSpace).toLowerCase();
      if (stripList.size_adjectives.includes(trailingFirstWord) || stripList.quality_qualifiers.includes(trailingFirstWord)) {
        variants.push(strippedTrailing.slice(trailingFirstSpace + 1));
      }
    }
  }

  // Generate singular form for each variant (pluralisation gap: "garlic cloves" → "garlic clove")
  for (const v of [...variants]) {
    const singular = toSingular(v);
    if (singular !== null) variants.push(singular);
  }

  // Deduplicate, preserving insertion order (original always first)
  return [...new Set(variants)];
}

export async function matchIngredients(data: unknown): Promise<MatchingResult> {
  const doc = data as Record<string, unknown>;
  const ingredients = (doc.ingredients as Array<Record<string, unknown>>) ?? [];
  const stripList = getStripList();

  const rows = await Promise.all(
    ingredients.map(async (ing) => {
      const row_id = ing.id as string;
      const row_name = ing.name as string;

      const variants = generateVariants(row_name, stripList);

      const variantResults = await Promise.all(
        variants.map(async (variant) => {
          // supabase.rpc types only include generated functions; match_ingredient is custom
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rawRows, error } = await (supabase.rpc as any)("match_ingredient", {
            query_name: variant,
          });
          if (error) throw new Error(error.message);
          return { variant, outcome: resolveOutcome((rawRows ?? []) as RawMatchRow[]) };
        }),
      );

      // Prefer exact/ambiguous; iterate variants in order so original wins any same-bucket tie
      let bestOutcome: RowOutcome = { kind: "none" };
      let matchedVariant: string | undefined;

      for (const { variant, outcome } of variantResults) {
        if (outcome.kind === "exact" || outcome.kind === "ambiguous") {
          bestOutcome = outcome;
          if (variant !== row_name) matchedVariant = variant;
          break;
        }
      }

      // No exact/ambiguous: merge fuzzy candidates from all variants, dedup by ingredient_id
      if (bestOutcome.kind !== "exact" && bestOutcome.kind !== "ambiguous") {
        const byId = new Map<number, Candidate>();
        for (const { outcome } of variantResults) {
          if (outcome.kind === "fuzzy") {
            for (const c of outcome.candidates) {
              const existing = byId.get(c.ingredient_id);
              if (!existing || c.similarity_score > existing.similarity_score) {
                byId.set(c.ingredient_id, c);
              }
            }
          }
        }
        if (byId.size > 0) {
          const sorted = [...byId.values()].sort((a, b) => {
            if (b.similarity_score !== a.similarity_score) return b.similarity_score - a.similarity_score;
            return a.canonical_name.localeCompare(b.canonical_name);
          });
          bestOutcome = { kind: "fuzzy", candidates: sorted };
        }
      }

      const match: IngredientMatch = { row_id, row_name, outcome: bestOutcome };
      if (matchedVariant !== undefined) match.matched_variant = matchedVariant;
      return match;
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

  let strictestRank = -1;
  let strictestIngredientName = "";
  let strictestCode = "";

  for (const match of matching.rows) {
    let candidate: Candidate | undefined;

    if (match.outcome.kind === "exact") {
      candidate = match.outcome.candidate;
    } else if (match.outcome.kind === "fuzzy") {
      candidate = match.outcome.candidates[0]; // sorted desc by score in resolveOutcome
    } else {
      // ambiguous: no single best candidate by construction — skip
      // none: no candidate — skip
      continue;
    }

    const dcId = candidate.dietary_category_id;
    if (dcId === null) continue;

    const code = dietaryCategoryCodeById.get(dcId);
    if (!code) continue;

    const rank = dietaryCategoryRanks.get(code);
    if (rank === undefined) continue;

    if (rank > strictestRank) {
      strictestRank = rank;
      strictestIngredientName = match.row_name;
      strictestCode = code;
    }
  }

  if (strictestRank === -1) return { kind: "silent", reason: "no_resolved_rows" };
  if (declaredRank >= strictestRank) return { kind: "silent", reason: "consistent" };

  return {
    kind: "fires",
    declared,
    strictest_ingredient_name: strictestIngredientName,
    strictest_category: strictestCode,
  };
}
