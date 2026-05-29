import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { validate, type LookupSets, type ValidationResult } from "@/lib/import/validate";
import {
  matchIngredients,
  evaluateConsistencyAdvisory,
  type MatchingResult,
  type AdvisoryResult,
  type ParsedRecipe,
  type IngredientMatch,
  type Candidate,
} from "@/lib/import/matching";

export const Route = createFileRoute("/admin/import")({
  component: Page,
});

type FrameworkRow = {
  code: string;
  framework_layer: { code: string; component_family: { code: string }[] }[];
};

type ImportLookupsData = {
  sets: LookupSets;
  dietaryCategoryRanks: Map<string, number>;
  dietaryCategoryCodeById: Map<number, string>;
};

function Page() {
  const [text, setText] = useState("");
  const [parsedData, setParsedData] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<ValidationResult | "parse-error" | null>(null);
  const [parseError, setParseError] = useState("");
  const [matchingOutcome, setMatchingOutcome] = useState<MatchingResult | { error: string } | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const lookups = useQuery({
    queryKey: ["import-lookups"],
    queryFn: async (): Promise<ImportLookupsData> => {
      const [
        cuisineRes, dietaryCategoryRes, dietaryRestrictionRes,
        nutritionalTagRes, mealTypeRes, mealFormatRes, frameworkRes,
      ] = await Promise.all([
        supabase.from("cuisine").select("code"),
        supabase.from("dietary_category").select("id, code, rank"),
        supabase.from("dietary_restriction").select("code"),
        supabase.from("nutritional_tag").select("code"),
        supabase.from("meal_type").select("code"),
        supabase.from("meal_format").select("code"),
        supabase.from("framework").select("code, framework_layer(code, component_family(code))"),
      ]);

      if (cuisineRes.error) throw cuisineRes.error;
      if (dietaryCategoryRes.error) throw dietaryCategoryRes.error;
      if (dietaryRestrictionRes.error) throw dietaryRestrictionRes.error;
      if (nutritionalTagRes.error) throw nutritionalTagRes.error;
      if (mealTypeRes.error) throw mealTypeRes.error;
      if (mealFormatRes.error) throw mealFormatRes.error;
      if (frameworkRes.error) throw frameworkRes.error;

      const frameworkLayers = new Map<string, Map<string, Set<string>>>();
      for (const fw of (frameworkRes.data ?? []) as unknown as FrameworkRow[]) {
        const layerMap = new Map<string, Set<string>>();
        for (const layer of fw.framework_layer)
          layerMap.set(layer.code, new Set(layer.component_family.map((f) => f.code)));
        frameworkLayers.set(fw.code, layerMap);
      }

      const dcRows = (dietaryCategoryRes.data ?? []) as { id: number; code: string; rank: number }[];
      const dietaryCategoryRanks = new Map<string, number>(dcRows.map((r) => [r.code, r.rank]));
      const dietaryCategoryCodeById = new Map<number, string>(dcRows.map((r) => [r.id, r.code]));

      return {
        sets: {
          cuisineCodes: new Set((cuisineRes.data ?? []).map((r) => r.code)),
          dietaryCategoryCodes: new Set(dcRows.map((r) => r.code)),
          dietaryRestrictionCodes: new Set((dietaryRestrictionRes.data ?? []).map((r) => r.code)),
          nutritionalTagCodes: new Set((nutritionalTagRes.data ?? []).map((r) => r.code)),
          mealTypeCodes: new Set((mealTypeRes.data ?? []).map((r) => r.code)),
          mealFormatCodes: new Set((mealFormatRes.data ?? []).map((r) => r.code)),
          frameworkLayers,
        },
        dietaryCategoryRanks,
        dietaryCategoryCodeById,
      };
    },
  });

  function handleValidate() {
    if (!lookups.data) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch (e) {
      setParseError((e as Error).message);
      setOutcome("parse-error");
      setParsedData(null);
      setMatchingOutcome(null);
      return;
    }
    setParseError("");
    setParsedData(parsed);
    setMatchingOutcome(null);
    setOutcome(validate(parsed, lookups.data.sets));
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setOutcome(null);
    setParseError("");
    setParsedData(null);
    setMatchingOutcome(null);
  }

  async function handleMatch() {
    if (!parsedData) return;
    setIsMatching(true);
    setMatchingOutcome(null);
    try {
      const result = await matchIngredients(parsedData);
      setMatchingOutcome(result);
    } catch (e) {
      setMatchingOutcome({ error: (e as Error).message });
    } finally {
      setIsMatching(false);
    }
  }

  const canValidate = !!lookups.data && text.trim().length > 0;
  const validationSuccess = outcome !== null && outcome !== "parse-error" && outcome.ok;

  const matchingResult: MatchingResult | null =
    matchingOutcome && !("error" in matchingOutcome) ? matchingOutcome : null;

  const advisory: AdvisoryResult | null =
    matchingResult && lookups.data && parsedData
      ? evaluateConsistencyAdvisory(
          parsedData as ParsedRecipe,
          matchingResult,
          lookups.data.dietaryCategoryRanks,
          lookups.data.dietaryCategoryCodeById,
        )
      : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/admin/ingredients" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to ingredients
        </Link>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin / Import
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Import</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a recipe or component JSON to validate it against the import spec.
          </p>
        </div>

        {lookups.isError && (
          <p className="mt-4 text-sm text-destructive">
            Failed to load reference data: {(lookups.error as Error).message}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <Textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Paste JSON here…"
            className="min-h-[300px] font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleValidate} disabled={!canValidate}>
              Validate
            </Button>
            {lookups.isLoading && (
              <span className="text-xs text-muted-foreground">Loading reference data…</span>
            )}
          </div>
        </div>

        {outcome !== null && (
          <div className="mt-6">
            <ResultPanel outcome={outcome} parseError={parseError} />
          </div>
        )}

        {/* Match button appears only after a successful validation.
            Smoke scripts: seed textarea, click Validate, wait for green panel,
            then wait for this button before clicking Match. */}
        {validationSuccess && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleMatch} disabled={isMatching}>
              Match ingredients
            </Button>
            {isMatching && (
              <span className="text-xs text-muted-foreground">Matching…</span>
            )}
          </div>
        )}

        {matchingOutcome && "error" in matchingOutcome && (
          <div className="mt-6 rounded-md border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              Matching failed: {matchingOutcome.error}
            </p>
          </div>
        )}

        {advisory?.kind === "fires" && (
          <AdvisoryBanner advisory={advisory} />
        )}

        {matchingResult && (
          <MatchingPanel result={matchingResult} />
        )}
      </div>
    </div>
  );
}

function ResultPanel({
  outcome,
  parseError,
}: {
  outcome: ValidationResult | "parse-error";
  parseError: string;
}) {
  if (outcome === "parse-error") {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Not valid JSON</p>
        {parseError && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{parseError}</p>
        )}
      </div>
    );
  }

  if (!outcome.ok) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
        <p className="mb-3 text-sm font-medium text-destructive">
          {outcome.errors.length} validation {outcome.errors.length === 1 ? "error" : "errors"}
        </p>
        <ul className="space-y-1.5 text-sm">
          {outcome.errors.map((err, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
              <span>
                <span className="font-mono text-xs text-muted-foreground">{err.path || "(root)"}</span>
                <span className="mx-1 text-muted-foreground">—</span>
                {err.message}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { summary } = outcome;

  return (
    <div className="rounded-md border border-green-600/30 bg-green-50/50 p-4 dark:border-green-400/30 dark:bg-green-950/20">
      <p className="mb-3 text-sm font-medium text-green-700 dark:text-green-400">
        Valid {summary.import_type} — {summary.name}
      </p>
      <dl className="divide-y rounded-md border bg-background text-sm">
        <SummaryRow label="Cuisine" value={summary.cuisine ?? "—"} />
        <SummaryRow label="Dietary category" value={summary.dietary_category ?? "—"} />
        <SummaryRow
          label="Restrictions"
          value={summary.dietary_restrictions.length > 0 ? summary.dietary_restrictions.join(", ") : "—"}
        />
        <SummaryRow
          label="Tags"
          value={summary.nutritional_tags.length > 0 ? summary.nutritional_tags.join(", ") : "—"}
        />
        <SummaryRow label="Ingredients" value={String(summary.ingredient_count)} />
        <SummaryRow label="Steps" value={String(summary.step_count)} />
        {summary.derived_components.length > 0 && (
          <div className="px-3 py-2">
            <dt className="text-muted-foreground">
              Derived {summary.derived_components.length === 1 ? "component" : "components"}
            </dt>
            <dd className="mt-1 space-y-0.5">
              {summary.derived_components.map((d, i) => (
                <div key={i} className="font-medium">
                  {d.name}
                  <span className="ml-2 font-normal text-xs text-muted-foreground">
                    ({d.ingredient_count} ingredient{d.ingredient_count === 1 ? "" : "s"},{" "}
                    {d.step_count} step{d.step_count === 1 ? "" : "s"})
                  </span>
                </div>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-3 py-2">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function AdvisoryBanner({ advisory }: { advisory: Extract<AdvisoryResult, { kind: "fires" }> }) {
  return (
    <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-50/50 p-4 dark:border-amber-400/30 dark:bg-amber-950/20">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
        Advisory: dietary classification may be too permissive
      </p>
      <p className="mt-1.5 text-sm text-amber-700/90 dark:text-amber-400/90">
        The recipe declares{" "}
        <span className="font-mono">{advisory.declared}</span> as its dietary category. The
        strictest matched ingredient is{" "}
        <span className="font-medium">{advisory.strictest_ingredient_name}</span> (
        <span className="font-mono">{advisory.strictest_category}</span>). The declared category
        is less restrictive than the ingredients allow.
      </p>
    </div>
  );
}

function MatchingPanel({ result }: { result: MatchingResult }) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium">Ingredient matching preview</p>
      <div className="divide-y rounded-md border">
        {result.rows.map((match) => (
          <MatchRow key={match.row_id} match={match} />
        ))}
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: IngredientMatch }) {
  const { row_id, row_name, outcome } = match;

  return (
    <div className="px-3 py-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{`{${row_id}}`}</span>
        <div className="min-w-0 flex-1">
          <span className="font-medium">{row_name}</span>
          <div className="mt-1">
            {outcome.kind === "exact" && <ExactRow candidate={outcome.candidate} />}
            {outcome.kind === "ambiguous" && <AmbiguousRow candidates={outcome.candidates} />}
            {outcome.kind === "fuzzy" && <FuzzyRow candidates={outcome.candidates} />}
            {outcome.kind === "none" && <NoneRow />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExactRow({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
      <span className="text-xs">✓</span>
      <span className="text-xs">
        {candidate.canonical_name}
        {candidate.match_type === "exact_alias" && (
          <span className="ml-1 text-muted-foreground">
            (via alias &ldquo;{candidate.matched_text}&rdquo;)
          </span>
        )}
      </span>
    </div>
  );
}

function AmbiguousRow({ candidates }: { candidates: Candidate[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        Multiple exact matches — needs disambiguation (2B.3)
      </p>
      <ul className="mt-1 space-y-0.5">
        {candidates.map((c) => (
          <li key={c.ingredient_id} className="text-xs text-muted-foreground">
            {c.canonical_name}
            {c.match_type === "exact_alias" && (
              <span className="ml-1">(via alias &ldquo;{c.matched_text}&rdquo;)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FuzzyRow({ candidates }: { candidates: Candidate[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        Fuzzy match — no exact hit
      </p>
      <ul className="mt-1 space-y-0.5">
        {candidates.map((c) => (
          <li key={c.ingredient_id} className="text-xs text-muted-foreground">
            {c.canonical_name}{" "}
            <span className="tabular-nums">({c.similarity_score.toFixed(1)})</span>{" "}
            <span className="opacity-60">
              {c.match_type === "fuzzy_alias" ? `alias: ${c.matched_text}` : "canonical"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoneRow() {
  return <p className="text-xs text-destructive/80">No match found — create new in 2B.3</p>;
}
